import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  ChevronLeft, User, Tag, Hash, Layers, Building2, Calendar,
  KeyRound, ShieldCheck, Camera as CameraIcon, Package, MonitorSmartphone,
  Armchair, Pencil,
} from 'lucide-react-native';
import {
  getHardwareAssetById, getSoftwareAssetById, uploadAssetPhoto,
} from '../services/api';
import { themed, C, R, S, cardShadow, CHROME, DANGER_TEXT } from '../theme';

let ImagePicker = null;
try { ImagePicker = require('expo-image-picker'); } catch (_) {}

const STATUS_TONE = {
  get(status) {
    const s = (status || '').toLowerCase();
    if (/damag|lost|retir/i.test(s)) return { color: C.offline, bg: C.offlineBg };
    if (/ready|stock|available/i.test(s)) return { color: C.online, bg: C.onlineBg };
    if (/allocat|assign|active/i.test(s)) return { color: C.info, bg: C.infoBg };
    return { color: C.textMuted, bg: C.cardAlt };
  },
};

// ─── Section header ───────────────────────────────────────────────────────────
const SectionLabel = ({ title }) => <Text style={styles.sectionLabel}>{title}</Text>;

// ─── Info row ─────────────────────────────────────────────────────────────────
const InfoRow = ({ Icon, label, value, last }) => (
  <View style={[styles.infoRow, last && styles.infoRowLast]}>
    <View style={styles.infoIcon}>
      <Icon color={C.textDim} size={14} strokeWidth={2} />
    </View>
    <View style={styles.infoBody}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={2}>{value || '—'}</Text>
    </View>
  </View>
);

const fmtDate = (ts) => (!ts ? null : String(ts).slice(0, 10));

const AssetDetailScreen = ({ route, navigation }) => {
  const { assetId, kind, initialAsset } = route.params || {};
  // Fixed assets live in the same table as hardware (same fields, same
  // /hardware/:id endpoint) — only the asset-type category differs.
  const isFixed    = kind === 'fixed';
  const isHardware = kind !== 'software';
  const insets = useSafeAreaInsets();

  const [asset,      setAsset]      = useState(initialAsset || null);
  const [isLoading,  setIsLoading]  = useState(!initialAsset);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error,      setError]      = useState('');
  const [photoBusy,  setPhotoBusy]  = useState(false);

  const fetchDetail = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    setError('');
    try {
      const fetcher = isHardware ? getHardwareAssetById : getSoftwareAssetById;
      const res = await fetcher(assetId);
      setAsset(res?.data || res);
    } catch (err) {
      if (!initialAsset) setError(err.message || 'Failed to load asset.');
      // If we already have initialAsset, keep showing it and swallow the
      // refresh error silently — the row data is still useful.
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [assetId, isHardware, initialAsset]);

  useEffect(() => { if (assetId) fetchDetail(); }, [fetchDetail, assetId]);

  const capturePhoto = async () => {
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
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions?.Images || ['Images'],
        quality: 0.6,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const photo = result.assets[0];
      setPhotoBusy(true);
      await uploadAssetPhoto(assetId, {
        uri: photo.uri,
        mimeType: photo.mimeType || 'image/jpeg',
        name: photo.fileName || `asset-${assetId}-${Date.now()}.jpg`,
      });
      Alert.alert('Uploaded', 'Photo attached to this asset.');
    } catch (err) {
      Alert.alert('Upload failed', err.message || 'Try again.');
    } finally {
      setPhotoBusy(false);
    }
  };

  const title = isHardware
    ? (asset?.item_id || [asset?.brand_name, asset?.model_name].filter(Boolean).join(' ') || 'Asset')
    : (asset?.software_name || asset?.item_id || 'Software');
  const subtitle = [asset?.branch_code, asset?.branch_name].filter(Boolean).join(' · ');
  const tone = STATUS_TONE.get(asset?.asset_status);
  const HeaderIcon = isFixed ? Armchair : isHardware ? MonitorSmartphone : Package;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar style="auto" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <ChevronLeft color={CHROME.text} size={22} strokeWidth={2} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
          {!!subtitle && <Text style={styles.headerSub} numberOfLines={1}>{subtitle}</Text>}
        </View>

        {!!asset?.asset_status && (
          <View style={[styles.statusChip, { backgroundColor: tone.bg }]}>
            <Text style={[styles.statusChipText, { color: tone.color }]} numberOfLines={1}>
              {asset.asset_status}
            </Text>
          </View>
        )}

        {/* Edit needs the fully-loaded record, not the list row this screen
            may have been opened with — the update endpoint rewrites every
            field it is handed, so a partial record would erase the rest. */}
        {!!asset?.id && (
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => navigation.navigate('AssetForm', { kind, asset })}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Edit this asset"
          >
            <Pencil color={C.primary} size={15} />
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={C.primary} />
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      ) : error && !asset ? (
        <View style={styles.centered}>
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchDetail()}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + S.xxxxl }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => fetchDetail(true)}
              tintColor={C.primary}
              colors={[C.primary]}
            />
          }
        >
          <View style={styles.heroCard}>
            <View style={styles.heroIcon}>
              <HeaderIcon color={C.primary} size={22} strokeWidth={1.8} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle} numberOfLines={2}>{title}</Text>
              {isHardware
                ? <Text style={styles.heroSub} numberOfLines={1}>
                    {[asset?.brand_name, asset?.model_name].filter(Boolean).join(' ') || asset?.asset_type || '—'}
                  </Text>
                : <Text style={styles.heroSub} numberOfLines={1}>{asset?.subscription_type || '—'}</Text>}
            </View>
          </View>

          {/* ── Assignee ── */}
          <SectionLabel title="Assigned To" />
          <View style={styles.infoCard}>
            {asset?.emp_name ? (
              <>
                <InfoRow Icon={User} label="Employee" value={asset.emp_name} />
                <InfoRow Icon={Hash} label="Employee code" value={asset.emp_code} />
                <InfoRow Icon={Building2} label="Department" value={asset.department} last />
              </>
            ) : (
              <View style={styles.unassignedRow}>
                <User color={C.textDim} size={16} strokeWidth={2} />
                <Text style={styles.unassignedText}>Unassigned</Text>
              </View>
            )}
          </View>

          {/* ── Asset info ── */}
          <SectionLabel title={isFixed ? 'Asset Info' : isHardware ? 'Hardware Info' : 'License Info'} />
          <View style={styles.infoCard}>
            {isHardware ? (
              <>
                <InfoRow Icon={Tag} label="Asset ID" value={asset?.item_id} />
                <InfoRow Icon={Layers} label="Type" value={asset?.asset_type} />
                <InfoRow Icon={Hash} label="Serial number" value={asset?.serial_number} />
                <InfoRow Icon={Calendar} label="Purchase date" value={fmtDate(asset?.purchase_date)} last />
              </>
            ) : (
              <>
                <InfoRow Icon={Tag} label="Asset ID" value={asset?.item_id} />
                <InfoRow Icon={KeyRound} label="License key" value={asset?.license_key} />
                <InfoRow Icon={ShieldCheck} label="Subscription" value={asset?.subscription_type} />
                <InfoRow Icon={Calendar} label="Expires" value={fmtDate(asset?.expiry_date)} last />
              </>
            )}
          </View>

          {/* ── Branch ── */}
          {!!(asset?.branch_code || asset?.branch_name) && (
            <>
              <SectionLabel title="Branch" />
              <View style={styles.infoCard}>
                <InfoRow Icon={Building2} label="Branch" value={subtitle} last />
              </View>
            </>
          )}

          {/* ── Actions ── */}
          {isHardware && (
            <>
              <SectionLabel title="Actions" />
              <TouchableOpacity
                style={styles.actionTile}
                onPress={capturePhoto}
                activeOpacity={0.85}
                disabled={photoBusy}
              >
                {photoBusy
                  ? <ActivityIndicator size="small" color={C.primary} />
                  : <CameraIcon color={C.text} size={18} />}
                <Text style={styles.actionLabel}>
                  {photoBusy ? 'Uploading…' : 'Attach photo'}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
};

const styles = themed(() => ({
  root: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: S.md, paddingVertical: S.md,
    backgroundColor: CHROME.bg,
    borderBottomWidth: 1, borderBottomColor: CHROME.border,
    gap: S.sm,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: R.sm,
    backgroundColor: CHROME.buttonBg, borderWidth: 1, borderColor: CHROME.buttonBorder,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  headerCenter: { flex: 1 },
  headerTitle:  { fontSize: 16, fontWeight: '700', color: CHROME.text },
  editBtn: {
    width: 34, height: 34, borderRadius: R.sm, marginLeft: S.xs,
    backgroundColor: CHROME.buttonBg, borderWidth: 1, borderColor: CHROME.buttonBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  headerSub:    { fontSize: 11, color: CHROME.textMuted, marginTop: 2 },
  statusChip: {
    paddingHorizontal: S.sm, paddingVertical: 5,
    borderRadius: R.sm, flexShrink: 0, maxWidth: 110,
  },
  statusChipText: { fontSize: 11, fontWeight: '700' },

  centered:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: S.lg },
  loadingText: { color: C.textDim, fontSize: 14 },
  errorCard: {
    backgroundColor: C.offlineBg,
    borderRadius: R.md, padding: S.lg,
    borderLeftWidth: 3, borderLeftColor: C.offline,
    maxWidth: '80%',
  },
  errorText: { color: DANGER_TEXT, fontSize: 13 },
  retryBtn: {
    paddingHorizontal: S.xxl, paddingVertical: S.sm,
    backgroundColor: C.primaryBg,
    borderRadius: R.sm, borderWidth: 1, borderColor: C.primary,
  },
  retryText: { color: C.primary, fontWeight: '700', fontSize: 14 },

  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: S.lg, paddingTop: S.lg },

  heroCard: {
    flexDirection: 'row', alignItems: 'center', gap: S.md,
    backgroundColor: C.card, borderRadius: R.lg, padding: S.lg,
    borderWidth: 1, borderColor: C.border, ...cardShadow,
    marginBottom: S.md,
  },
  heroIcon: {
    width: 44, height: 44, borderRadius: R.md,
    backgroundColor: C.primaryBg, borderWidth: 1, borderColor: `${C.primary}33`,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  heroTitle: { fontSize: 16, fontWeight: '800', color: C.text },
  heroSub:   { fontSize: 12, color: C.textMuted, marginTop: 2 },

  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: C.textDim,
    letterSpacing: 1.2, textTransform: 'uppercase',
    marginBottom: S.sm, marginTop: S.lg,
  },

  infoCard: {
    backgroundColor: C.card,
    borderRadius: R.md, borderWidth: 1, borderColor: C.border,
    overflow: 'hidden',
    ...cardShadow,
  },
  infoRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    padding: S.lg, gap: S.md,
    borderBottomWidth: 1, borderBottomColor: C.borderFaint,
  },
  infoRowLast: { borderBottomWidth: 0 },
  infoIcon: {
    width: 30, height: 30, borderRadius: R.xs,
    backgroundColor: C.surface,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, marginTop: 1,
  },
  infoBody:  { flex: 1 },
  infoLabel: { fontSize: 10, fontWeight: '700', color: C.textDim, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 3 },
  infoValue: { fontSize: 14, color: C.text, fontWeight: '500' },

  unassignedRow: {
    flexDirection: 'row', alignItems: 'center', gap: S.sm,
    padding: S.lg,
  },
  unassignedText: { fontSize: 13, color: C.textMuted, fontWeight: '500' },

  actionTile: {
    flexDirection: 'row', alignItems: 'center', gap: S.sm,
    paddingHorizontal: S.md, paddingVertical: 12,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: R.md, ...cardShadow,
  },
  actionLabel: { flex: 1, fontSize: 13, fontWeight: '700', color: C.text },
}));

export default AssetDetailScreen;
