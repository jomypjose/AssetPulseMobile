import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
  Alert, Linking, TextInput, Modal, FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  ChevronLeft, ScanLine, Camera as CameraIcon, Keyboard,
  Building2, CheckCircle2, AlertTriangle, X as XIcon,
} from 'lucide-react-native';
import { themed, C, R, S, elevation, CHROME } from '../theme';
import { globalSearch, getHardwareAssetById, uploadAssetPhoto } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { classifyScan, applyRelocation, recordSurplus } from '../services/assetVerification';

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

const ScannerScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  // Which branch a scan is being checked against.
  //
  // Opened from a branch page, that branch is the target. Otherwise it falls
  // back to the user's own first branch — the same default DailyJobs and
  // TicketsHub already use — and can be changed or switched off from the bar
  // at the top. With no target, scanning keeps its original behaviour of just
  // showing the asset's details.
  const branchParam = route?.params?.branch || null;
  const myBranches = user?.branches || [];
  const [verifyBranch, setVerifyBranch] = useState(
    branchParam || myBranches[0] || null,
  );
  const [showBranchPicker, setShowBranchPicker] = useState(false);

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

  /**
   * Check a resolved asset against the verification branch and act on the
   * outcome. Returns true if it handled the scan (so the caller skips the
   * plain details alert), false to fall through.
   */
  const runVerification = useCallback(async (asset, kind) => {
    const target = verifyBranch;
    if (!target?.branch_code || !asset?.id) return false;

    let outcome;
    try {
      outcome = await classifyScan({ asset, kind, branchCode: target.branch_code });
    } catch (err) {
      Alert.alert('Verification failed', err?.message || 'Could not verify this asset.');
      return true;
    }

    const where = [target.branch_code, target.branch_name].filter(Boolean).join(' · ');
    const label = asset.item_id || asset.serial_number || `#${asset.id}`;

    // Audit running: the item was ticked off as FOUND already.
    if (outcome.mode === 'audit' && outcome.action === 'found') {
      Alert.alert('Verified ✓', `${label} marked FOUND in the audit for ${where}.`);
      return true;
    }

    // Audit running, asset not in the snapshot — it does not belong here.
    if (outcome.mode === 'audit' && outcome.action === 'surplus') {
      if (!outcome.serial) {
        Alert.alert(
          'Cannot record',
          `${label} is not in the audit for ${where}, and has no serial number — `
          + 'the audit needs one to record a surplus find. Add a serial to the asset first.',
        );
        return true;
      }
      Alert.alert(
        'Not in this audit',
        `${label} is not on the checklist for ${where}.\n\n`
        + 'Record it as a surplus find? The asset record is left unchanged — '
        + 'the audit approval decides what happens to it.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Record surplus',
            onPress: async () => {
              try {
                await recordSurplus(outcome.audit, asset, kind);
                Alert.alert('Recorded', `${label} logged as a surplus find.`);
              } catch (err) {
                Alert.alert('Failed', err?.message || 'Could not record the surplus find.');
              }
            },
          },
        ],
      );
      return true;
    }

    if (outcome.mode === 'audit' && outcome.action === 'error') {
      Alert.alert('Audit error', outcome.error || 'Could not update the audit.');
      return true;
    }

    // No audit: already recorded here.
    if (outcome.mode === 'direct' && outcome.action === 'confirmed') {
      Alert.alert('Confirmed ✓', `${label} is recorded at ${where}.`);
      return true;
    }

    // No audit: recorded elsewhere. Offer to move it.
    if (outcome.mode === 'direct' && outcome.action === 'relocate') {
      const isHardware = kind === 'hardware' || kind === 'fixed';
      const from = outcome.from
        ? `is listed at ${outcome.from}`
        : 'has no branch recorded';

      if (!isHardware) {
        Alert.alert(
          'Branch mismatch',
          `${label} ${from}, not ${where}.\n\n`
          + `Moving ${kind} assets from the scanner is not supported — `
          + 'change it from the asset page.',
        );
        return true;
      }

      Alert.alert(
        'Branch mismatch',
        `${label} ${from}.\n\nMove it to ${where}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Move here',
            onPress: async () => {
              try {
                // The update endpoint rewrites every field it is given and
                // nulls the dates it is not, so relocation needs the asset's
                // full current record — a search hit is not enough.
                let full = asset;
                try {
                  const r = await getHardwareAssetById(asset.id);
                  full = r?.data || r || asset;
                } catch { /* fall back to what we have */ }
                await applyRelocation(full, kind, target.branch_code, target.branch_name);
                Alert.alert('Moved', `${label} is now recorded at ${where}.`);
              } catch (err) {
                Alert.alert('Move failed', err?.message || 'Could not update the asset.');
              }
            },
          },
        ],
      );
      return true;
    }

    return false;
  }, [verifyBranch]);

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
        // Verification takes precedence: when a branch is targeted, a scan is
        // a presence check, not a lookup.
        if (await runVerification(directHit, 'hardware')) return;

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
        if (firstResult.type === 'network' && firstResult.id) {
          // startAudit() snapshots network assets too, so a network scan is a
          // valid presence check — verify before navigating away, or an audit
          // could never tick off a switch or router.
          if (await runVerification({ ...(firstResult.details || {}), id: firstResult.id }, 'network')) return;

          navigation.replace('DeviceDetail', {
            deviceId: firstResult.id,
            deviceIp: firstResult.details?.ip_address || firstResult.title,
          });
          return;
        }
        const d = firstResult.details || {};

        // Search results carry an id and a partial record, which is enough to
        // classify; the relocation path refetches the full asset before it
        // writes anything.
        if (['hardware', 'software'].includes(firstResult.type) && typeof firstResult.id === 'number') {
          const kind = firstResult.type === 'hardware'
            ? 'hardware'
            : 'software';
          if (await runVerification({ ...d, id: firstResult.id }, kind)) return;
        }

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
  }, [navigation, runVerification]);

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
          <Text style={styles.headerTitle}>
            {verifyBranch ? 'Verify assets' : 'Scan asset'}
          </Text>
          <Text style={styles.headerSub}>
            {verifyBranch ? 'Scan to confirm presence' : 'QR or barcode'}
          </Text>
        </View>
        <View style={styles.iconChip}>
          <ScanLine color={C.primary} size={16} />
        </View>
      </View>

      {/* Verification target. Always visible so it is never ambiguous which
          branch a scan is being checked against — a scan that silently
          relocated an asset to the wrong branch would be worse than no
          verification at all. */}
      <View style={styles.verifyBar}>
        {verifyBranch ? (
          <>
            <CheckCircle2 color={C.online} size={14} />
            <Text style={styles.verifyText} numberOfLines={1}>
              Verifying at{' '}
              <Text style={styles.verifyStrong}>{verifyBranch.branch_code}</Text>
              {verifyBranch.branch_name ? ` · ${verifyBranch.branch_name}` : ''}
            </Text>
          </>
        ) : (
          <>
            <AlertTriangle color={C.textDim} size={14} />
            <Text style={styles.verifyText} numberOfLines={1}>
              Lookup only — no branch selected
            </Text>
          </>
        )}
        {myBranches.length > 0 && (
          <TouchableOpacity
            onPress={() => setShowBranchPicker(true)}
            activeOpacity={0.7}
            style={styles.verifyAction}
          >
            <Text style={styles.verifyActionText}>
              {verifyBranch ? 'Change' : 'Set branch'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {renderBody()}

      {/* Branch picker — sourced from the user's own scope, which login
          already returns, so there is no extra request and no branch the user
          is not allowed to touch. */}
      <Modal
        visible={showBranchPicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowBranchPicker(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHead}>
              <Building2 color={C.primary} size={16} />
              <Text style={styles.modalTitle}>Verify against</Text>
              <TouchableOpacity onPress={() => setShowBranchPicker(false)} activeOpacity={0.7}>
                <XIcon color={C.textDim} size={18} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.branchRow}
              activeOpacity={0.7}
              onPress={() => { setVerifyBranch(null); setShowBranchPicker(false); }}
            >
              <Text style={styles.branchOff}>Lookup only (no verification)</Text>
            </TouchableOpacity>

            <FlatList
              data={myBranches}
              keyExtractor={(b) => String(b.branch_code)}
              style={{ maxHeight: 340 }}
              renderItem={({ item }) => {
                const active = item.branch_code === verifyBranch?.branch_code;
                return (
                  <TouchableOpacity
                    style={styles.branchRow}
                    activeOpacity={0.7}
                    onPress={() => { setVerifyBranch(item); setShowBranchPicker(false); }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.branchCode, active && { color: C.primary }]}>
                        {item.branch_code}
                      </Text>
                      {!!item.branch_name && (
                        <Text style={styles.branchName} numberOfLines={1}>{item.branch_name}</Text>
                      )}
                    </View>
                    {active && <CheckCircle2 color={C.primary} size={16} />}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>

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

  // ── Verification bar + branch picker ──
  verifyBar: {
    flexDirection: 'row', alignItems: 'center', gap: S.xs,
    paddingHorizontal: S.md, paddingVertical: S.sm,
    backgroundColor: CHROME.bg,
    borderBottomWidth: 1, borderBottomColor: CHROME.border,
  },
  verifyText:   { flex: 1, fontSize: 12, color: C.textMuted },
  verifyStrong: { color: C.text, fontWeight: '700' },
  verifyAction: {
    paddingHorizontal: S.sm, paddingVertical: 4,
    borderRadius: R.xs, borderWidth: 1, borderColor: CHROME.buttonBorder,
    backgroundColor: CHROME.buttonBg,
  },
  verifyActionText: { fontSize: 11, fontWeight: '700', color: C.primary },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: C.surface,
    borderTopLeftRadius: R.lg, borderTopRightRadius: R.lg,
    paddingBottom: S.xl, ...elevation(3),
  },
  modalHead: {
    flexDirection: 'row', alignItems: 'center', gap: S.sm,
    paddingHorizontal: S.lg, paddingVertical: S.md,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  modalTitle: { flex: 1, fontSize: 14, fontWeight: '800', color: C.text },
  branchRow: {
    flexDirection: 'row', alignItems: 'center', gap: S.sm,
    paddingHorizontal: S.lg, paddingVertical: S.md,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  branchCode: { fontSize: 13, fontWeight: '700', color: C.text },
  branchName: { fontSize: 11, color: C.textMuted, marginTop: 1 },
  branchOff:  { fontSize: 13, color: C.textMuted, fontWeight: '600' },

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
