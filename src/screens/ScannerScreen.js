import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
  Alert, Linking, TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ChevronLeft, ScanLine, Camera as CameraIcon, Keyboard } from 'lucide-react-native';
import { themed, C, R, S, elevation, CHROME } from '../theme';
import { globalSearch, getHardwareAssetById, uploadAssetPhoto } from '../services/api';

// Lazy-load expo-camera so the app still runs if the native module is missing.
let Camera = null;
try { Camera = require('expo-camera'); } catch (_) {}
let ImagePicker = null;
try { ImagePicker = require('expo-image-picker'); } catch (_) {}

// Snap a photo of an asset and PUT it to /hardware/:id/photo.
const attachAssetPhoto = async (hardwareId) => {
  if (!ImagePicker) {
    Alert.alert('Camera unavailable', 'expo-image-picker is not installed.');
    return;
  }
  try {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission required', 'Camera permission was denied.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.6 });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    await uploadAssetPhoto(hardwareId, {
      uri: asset.uri,
      mimeType: asset.mimeType || 'image/jpeg',
      name: asset.fileName || `asset-${hardwareId}-${Date.now()}.jpg`,
    });
    Alert.alert('Uploaded', 'Photo attached to this asset.');
  } catch (err) {
    Alert.alert('Upload failed', err?.message || 'Could not upload photo.');
  }
};

const ScannerScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();

  const [perm, setPerm] = useState(null);     // 'granted' | 'denied' | null
  const [scanned, setScanned] = useState(false);
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState('');
  const [showManual, setShowManual] = useState(false);
  const cooldownRef = useRef(false);

  useEffect(() => {
    (async () => {
      if (!Camera?.Camera?.requestCameraPermissionsAsync) {
        setPerm('denied');
        return;
      }
      const { status } = await Camera.Camera.requestCameraPermissionsAsync();
      setPerm(status);
    })();
  }, []);

  const resolveCode = useCallback(async (raw) => {
    if (!raw || cooldownRef.current) return;
    cooldownRef.current = true;
    setBusy(true);
    try {
      // QR codes sometimes embed a full URL ("https://app/asset/AP-001"). Extract
      // the most-likely identifier: query-string id, last path segment, or the
      // raw string when it's already a plain code.
      let cleaned = String(raw).trim();
      try {
        if (/^https?:\/\//i.test(cleaned)) {
          const u = new URL(cleaned);
          const qsId = u.searchParams.get('id') || u.searchParams.get('item_id') || u.searchParams.get('asset');
          if (qsId) cleaned = qsId;
          else {
            const seg = u.pathname.split('/').filter(Boolean).pop();
            if (seg) cleaned = seg;
          }
        }
      } catch (_) { /* not a URL — keep raw */ }

      // If the scanned value is purely numeric, it may be a hardware DB id —
      // try the direct lookup first since it's authoritative.
      let directHit = null;
      if (/^\d+$/.test(cleaned)) {
        try {
          const r = await getHardwareAssetById(cleaned);
          directHit = r?.data || r;
        } catch { /* fall through */ }
      }

      // Otherwise (or if direct didn't hit) run the global search — which
      // matches item_id / serial_number / brand / model / IP / branch etc.
      let firstResult = null;
      let answer      = null;
      if (!directHit) {
        try {
          const search = await globalSearch(cleaned);
          answer      = search?.answer || null;
          const list  = search?.results || [];
          // Prefer concrete asset hits over template / summary entries.
          firstResult = list.find((r) =>
            ['hardware', 'software', 'network'].includes(r.type) && typeof r.id === 'number'
          ) || list[0] || null;
        } catch { /* ignore */ }
      }

      if (directHit) {
        const assignee = directHit.emp_name
          ? `👤 ${directHit.emp_name}${directHit.emp_code ? ` (${directHit.emp_code})` : ''}`
          : '👤 Unassigned';
        const title = directHit.item_id
          ? `${directHit.item_id} — ${assignee}`
          : assignee;
        Alert.alert(
          title,
          [
            [directHit.brand_name, directHit.model_name].filter(Boolean).join(' '),
            directHit.serial_number && `SN: ${directHit.serial_number}`,
            directHit.asset_type && `Type: ${directHit.asset_type}`,
            directHit.department && `Department: ${directHit.department}`,
            (directHit.branch_code || directHit.branch_name) &&
              `Branch: ${[directHit.branch_code, directHit.branch_name].filter(Boolean).join(' · ')}`,
            directHit.asset_status && `Status: ${directHit.asset_status}`,
          ].filter(Boolean).join('\n'),
          [
            { text: 'Done', style: 'cancel' },
            { text: '📷 Attach photo', onPress: () => attachAssetPhoto(directHit.id) },
          ],
        );
        return;
      }

      if (firstResult) {
        // Network device → navigate straight to its DeviceDetail
        if (firstResult.type === 'network' && firstResult.id) {
          navigation.replace('DeviceDetail', {
            deviceId: firstResult.id,
            deviceIp: firstResult.details?.ip_address || firstResult.title,
          });
          return;
        }
        const d = firstResult.details || {};
        const assignee = d.emp_name
          ? `👤 ${d.emp_name}${d.emp_code ? ` (${d.emp_code})` : ''}`
          : '👤 Unassigned';
        // Photo upload only makes sense for hardware (server endpoint is
        // /hardware/:id/photo). Other entity types just get a "Done" button.
        const isHardware = firstResult.type === 'hardware' && typeof firstResult.id === 'number';
        const buttons = isHardware
          ? [
              { text: 'Done', style: 'cancel' },
              { text: '📷 Attach photo', onPress: () => attachAssetPhoto(firstResult.id) },
            ]
          : undefined;
        Alert.alert(
          `${firstResult.title || 'Asset'} — ${assignee}`,
          [
            firstResult.subtitle,
            d.item_id && `ID: ${d.item_id}`,
            d.serial_number && `SN: ${d.serial_number}`,
            d.asset_type && `Type: ${d.asset_type}`,
            d.department && `Department: ${d.department}`,
            (d.branch_code || d.branch_name) &&
              `Branch: ${[d.branch_code, d.branch_name].filter(Boolean).join(' · ')}`,
            d.asset_status && `Status: ${d.asset_status}`,
            answer && `\n${answer}`,
          ].filter(Boolean).join('\n'),
          buttons,
        );
        return;
      }

      Alert.alert('No match', `Nothing found for "${cleaned}".`);
    } catch (err) {
      Alert.alert('Lookup failed', err.message || 'Try again.');
    } finally {
      setBusy(false);
      setTimeout(() => { cooldownRef.current = false; setScanned(false); }, 1500);
    }
  }, [navigation]);

  const handleBarCode = ({ data }) => {
    if (scanned) return;
    setScanned(true);
    resolveCode(data);
  };

  const renderBody = () => {
    if (perm === null) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator color={C.primary} size="large" />
          <Text style={styles.dim}>Requesting camera permission…</Text>
        </View>
      );
    }

    if (perm !== 'granted' || !Camera?.CameraView) {
      return (
        <View style={styles.centered}>
          <CameraIcon color={C.textDim} size={40} />
          <Text style={styles.dim}>Camera is not available.</Text>
          <Text style={styles.dimSmall}>
            Install / rebuild with expo-camera, or enter the asset code manually.
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => setShowManual(true)}>
            <Keyboard color={C.white} size={14} />
            <Text style={styles.primaryBtnText}>Enter code manually</Text>
          </TouchableOpacity>
          {perm === 'denied' && (
            <TouchableOpacity style={styles.linkBtn} onPress={() => Linking.openSettings?.()}>
              <Text style={styles.link}>Open settings</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }

    const CamView = Camera.CameraView || Camera.Camera;

    return (
      <View style={styles.cameraWrap}>
        <CamView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{
            barcodeTypes: ['qr', 'ean13', 'ean8', 'code128', 'code39', 'upc_a', 'upc_e'],
          }}
          onBarcodeScanned={scanned ? undefined : handleBarCode}
        />
        {/* Reticle overlay */}
        <View pointerEvents="none" style={styles.overlay}>
          <View style={styles.reticle}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>
          <Text style={styles.hint}>
            {busy ? 'Looking up…' : 'Align the asset barcode / QR inside the box.'}
          </Text>
        </View>
        <TouchableOpacity style={styles.manualOverlayBtn} onPress={() => setShowManual(true)}>
          <Keyboard color={C.white} size={14} />
          <Text style={styles.manualOverlayText}>Manual entry</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <ChevronLeft color={CHROME.text} size={22} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Scan asset</Text>
          <Text style={styles.headerSub}>QR or barcode</Text>
        </View>
        <View style={styles.iconChip}>
          <ScanLine color={C.primary} size={16} />
        </View>
      </View>

      {renderBody()}

      {showManual && (
        <View style={styles.manualSheet}>
          <Text style={styles.fieldLabel}>Enter asset ID / serial</Text>
          <TextInput
            style={styles.input}
            value={manual}
            onChangeText={setManual}
            autoFocus
            placeholder="e.g. AP-BLR01-LAP-0042"
            placeholderTextColor={C.textDim}
            autoCapitalize="characters"
          />
          <View style={styles.actions}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => setShowManual(false)}>
              <Text style={styles.actionBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: C.primary }]}
              onPress={() => { setShowManual(false); resolveCode(manual); setManual(''); }}
            >
              <Text style={[styles.actionBtnText, { color: C.white }]}>Search</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = themed(() => ({
  root: { flex: 1, backgroundColor: '#000' },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: S.sm,
    paddingHorizontal: S.md, paddingVertical: S.md,
    backgroundColor: CHROME.bg, borderBottomWidth: 1, borderBottomColor: CHROME.border,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: R.sm,
    backgroundColor: CHROME.buttonBg, borderWidth: 1, borderColor: CHROME.buttonBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: CHROME.text },
  headerSub:   { fontSize: 11, color: CHROME.textMuted, marginTop: 2 },
  iconChip: {
    width: 38, height: 38, borderRadius: R.sm,
    backgroundColor: C.primaryBg, borderWidth: 1, borderColor: `${C.primary}33`,
    alignItems: 'center', justifyContent: 'center',
  },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: S.md, padding: S.xl },
  dim:      { color: C.textMuted, fontSize: 13 },
  dimSmall: { color: C.textDim, fontSize: 11, textAlign: 'center' },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: S.xs,
    backgroundColor: C.primary, paddingHorizontal: S.lg, paddingVertical: 10,
    borderRadius: R.sm, marginTop: S.md, ...elevation(2),
  },
  primaryBtnText: { color: C.white, fontWeight: '700', fontSize: 13 },
  linkBtn: { padding: S.sm },
  link:    { color: C.primary, fontWeight: '600', fontSize: 12 },

  cameraWrap: { flex: 1, backgroundColor: '#000' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  reticle: {
    width: 240, height: 240, position: 'relative',
  },
  corner: { position: 'absolute', width: 28, height: 28, borderColor: C.primary, borderWidth: 0 },
  cornerTL: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 8 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 8 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 8 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 8 },
  hint:    { marginTop: S.xl, color: '#fff', fontSize: 12 },
  manualOverlayBtn: {
    position: 'absolute', bottom: 32, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: S.xs,
    backgroundColor: 'rgba(0,0,0,0.65)', paddingHorizontal: S.lg, paddingVertical: 10,
    borderRadius: R.full, borderWidth: 1, borderColor: '#ffffff44',
  },
  manualOverlayText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  manualSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: C.bg, padding: S.lg, gap: S.sm,
    borderTopLeftRadius: R.xxl, borderTopRightRadius: R.xxl,
    borderTopWidth: 1, borderTopColor: C.border,
  },
  fieldLabel: { fontSize: 11, color: C.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  input: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: R.sm, paddingHorizontal: S.md, paddingVertical: 10,
    fontSize: 14, color: C.text,
  },
  actions: { flexDirection: 'row', gap: S.sm, justifyContent: 'flex-end' },
  actionBtn: {
    paddingHorizontal: S.lg, paddingVertical: 10,
    borderRadius: R.sm, backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
  },
  actionBtnText: { color: C.text, fontWeight: '700', fontSize: 13 },
}));

export default ScannerScreen;
