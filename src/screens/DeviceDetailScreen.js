import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Switch,
  RefreshControl, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  ChevronLeft, Clock, MapPin,
  Building2, Layers, Calendar, Cpu, MemoryStick,
  Wrench, Camera as CameraIcon, Activity,
} from 'lucide-react-native';
import {
  getDeviceDetail, getDeviceMetrics, setMaintenanceMode, uploadAssetPhoto,
} from '../services/api';
import StatusBadge from '../components/StatusBadge';
import CircularGauge from '../components/CircularGauge';
import Sparkline from '../components/Sparkline';
import { themed, C, R, S, cardShadow, CHROME } from '../theme';

let ImagePicker = null;
try { ImagePicker = require('expo-image-picker'); } catch (_) {}

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

// ─── Gauge card ───────────────────────────────────────────────────────────────
const GaugeCard = ({ value, label, icon: Icon, note, color }) => (
  <View style={styles.gaugeCard}>
    <View style={styles.gaugeHeader}>
      <Icon color={color} size={14} strokeWidth={2} />
      <Text style={[styles.gaugeTitle, { color }]}>{label}</Text>
    </View>
    <CircularGauge value={value ?? 0} size={110} label={label} color={color} />
    {note ? <Text style={styles.gaugeNote}>{note}</Text> : null}
  </View>
);

const gaugeColor = (v) => {
  if (v == null) return C.textDim;
  if (v >= 80)   return C.offline;
  if (v >= 60)   return C.warning;
  return C.online;
};

const fmtBytes = (b) => {
  if (b == null) return '—';
  if (b >= 1073741824) return `${(b / 1073741824).toFixed(1)} GB`;
  if (b >= 1048576)    return `${(b / 1048576).toFixed(1)} MB`;
  if (b >= 1024)       return `${(b / 1024).toFixed(1)} KB`;
  return `${b} B`;
};

const fmtUptime = (val) => {
  if (val == null || val === '') return '—';
  if (typeof val === 'string') return val;
  const sec = Number(val);
  if (isNaN(sec)) return String(val);
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

const fmtDate = (ts) => (!ts ? '—' : new Date(ts).toLocaleString());

const DeviceDetailScreen = ({ route, navigation }) => {
  const { deviceId, deviceIp } = route.params;
  const insets                 = useSafeAreaInsets();

  const [device,       setDevice]       = useState(null);
  const [isLoading,    setIsLoading]    = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error,        setError]        = useState('');
  const [metrics,      setMetrics]      = useState(null);
  const [maintBusy,    setMaintBusy]    = useState(false);
  const [photoBusy,    setPhotoBusy]    = useState(false);

  const fetchDetail = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    setError('');
    try {
      const data = await getDeviceDetail(deviceId);
      setDevice(data.device);
    } catch (err) {
      setError(err.message || 'Failed to load device details.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [deviceId]);

  const fetchMetrics = useCallback(async () => {
    try {
      const data = await getDeviceMetrics(deviceId, '1h');
      setMetrics(data);
    } catch { /* silently ignore — sparklines just won't render */ }
  }, [deviceId]);

  useEffect(() => { fetchDetail(); fetchMetrics(); }, [fetchDetail, fetchMetrics]);

  const cpuPct = device?.cpu_usage != null ? Math.round(device.cpu_usage) : null;
  const memPct = (() => {
    const used  = device?.extra?.memory_used;
    const total = device?.extra?.memory_total;
    if (!used || !total || total === 0) return null;
    return Math.round((used / total) * 100);
  })();

  const inMaintenance = !!device?.maintenance_mode;

  const toggleMaintenance = async () => {
    if (!device) return;
    setMaintBusy(true);
    try {
      await setMaintenanceMode(deviceId, { maintenance_mode: !inMaintenance });
      setDevice({ ...device, maintenance_mode: !inMaintenance });
    } catch (err) {
      Alert.alert('Could not toggle maintenance', err.message || 'Try again.');
    } finally {
      setMaintBusy(false);
    }
  };

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
      const asset = result.assets[0];
      setPhotoBusy(true);
      await uploadAssetPhoto(deviceId, {
        uri: asset.uri,
        mimeType: asset.mimeType || 'image/jpeg',
        name: asset.fileName || `device-${deviceId}-${Date.now()}.jpg`,
      });
      Alert.alert('Uploaded', 'Photo attached to this asset.');
    } catch (err) {
      Alert.alert('Upload failed', err.message || 'Try again.');
    } finally {
      setPhotoBusy(false);
    }
  };

  // Extract sparkline series — server returns { points: [{ts, cpu, mem, ...}] } or arrays
  const cpuSeries  = metrics?.cpu_history || metrics?.points?.map((p) => p.cpu) || metrics?.cpu || [];
  const memSeries  = metrics?.memory_history || metrics?.points?.map((p) => p.memory) || metrics?.memory || [];
  const inSeries   = metrics?.throughput_in  || metrics?.points?.map((p) => p.in)  || [];
  const outSeries  = metrics?.throughput_out || metrics?.points?.map((p) => p.out) || [];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar style="auto" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <ChevronLeft color={CHROME.text} size={22} strokeWidth={2} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{deviceIp || 'Device'}</Text>
          {device?.sys_name ? (
            <Text style={styles.headerSub} numberOfLines={1}>{device.sys_name}</Text>
          ) : null}
        </View>

        <View style={styles.headerRight}>
          {device ? <StatusBadge status={device.monitoring_status} size="sm" /> : null}
        </View>
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={C.primary} />
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      ) : error ? (
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
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => { fetchDetail(true); fetchMetrics(); }}
              tintColor={C.primary} colors={[C.primary]}
            />
          }
        >
          {/* ── Performance gauges ── */}
          <SectionLabel title="Performance" />
          <View style={styles.gaugesRow}>
            <GaugeCard
              value={cpuPct}
              label="CPU"
              icon={Cpu}
              color={gaugeColor(cpuPct)}
              note={device?.extra?.cpu_count != null
                ? `${device.extra.cpu_count} core${device.extra.cpu_count !== 1 ? 's' : ''}`
                : null}
            />
            <GaugeCard
              value={memPct}
              label="Memory"
              icon={MemoryStick}
              color={gaugeColor(memPct)}
              note={device?.extra?.memory_used != null && device?.extra?.memory_total != null
                ? `${fmtBytes(device.extra.memory_used)} / ${fmtBytes(device.extra.memory_total)}`
                : null}
            />
          </View>

          {/* ── Trend sparklines ── */}
          {(cpuSeries.length || memSeries.length || inSeries.length || outSeries.length) > 0 && (
            <>
              <SectionLabel title="Trend (last hour)" />
              <View style={{ gap: S.sm }}>
                {cpuSeries.length > 0 && <Sparkline data={cpuSeries} label="CPU %"     color={C.primary} suffix="%" />}
                {memSeries.length > 0 && <Sparkline data={memSeries} label="Memory %"  color={C.cyan}    suffix="%" />}
                {inSeries.length  > 0 && <Sparkline data={inSeries}  label="In"        color={C.online} />}
                {outSeries.length > 0 && <Sparkline data={outSeries} label="Out"       color={C.warning} />}
              </View>
            </>
          )}

          {/* ── Quick actions ── */}
          <SectionLabel title="Actions" />
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.actionTile, inMaintenance && { borderColor: C.warning, backgroundColor: C.warningBg }]}
              onPress={toggleMaintenance}
              activeOpacity={0.85}
              disabled={maintBusy}
            >
              <Wrench color={inMaintenance ? C.warning : C.text} size={18} />
              <Text style={[styles.actionLabel, inMaintenance && { color: C.warning }]}>
                {inMaintenance ? 'Maintenance on' : 'Maintenance'}
              </Text>
              <Switch
                value={inMaintenance}
                onValueChange={toggleMaintenance}
                disabled={maintBusy}
                thumbColor={inMaintenance ? C.warning : '#888'}
                trackColor={{ false: C.cardAlt, true: `${C.warning}55` }}
              />
            </TouchableOpacity>

          </View>

          {/* ── Device info ── */}
          <SectionLabel title="Device Info" />
          <View style={styles.infoCard}>
            <InfoRow Icon={Building2} label="Vendor"     value={device?.vendor} />
            <InfoRow Icon={Layers}    label="OS Version" value={device?.os_version} />
            <InfoRow Icon={MapPin}    label="Location"   value={device?.sys_location} />
            <InfoRow Icon={Clock}     label="Uptime"     value={fmtUptime(device?.snmp_uptime)} />
            <InfoRow Icon={Calendar}  label="Last Seen"  value={fmtDate(device?.last_seen)} last />
          </View>

          <View style={{ height: S.xxl }} />
        </ScrollView>
      )}
    </View>
  );
};

const styles = themed(() => ({
  root:  { flex: 1, backgroundColor: C.bg },

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
  headerSub:    { fontSize: 11, color: CHROME.textMuted, marginTop: 2 },
  headerRight:  { flexShrink: 0, minWidth: 60, alignItems: 'flex-end' },

  centered:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: S.lg },
  loadingText: { color: C.textDim, fontSize: 14 },
  errorCard:   {
    backgroundColor: C.offlineBg,
    borderRadius: R.md, padding: S.lg,
    borderLeftWidth: 3, borderLeftColor: C.offline,
    maxWidth: '80%',
  },
  errorText: { color: '#fca5a5', fontSize: 13 },
  retryBtn:  {
    paddingHorizontal: S.xxl, paddingVertical: S.sm,
    backgroundColor: C.primaryBg,
    borderRadius: R.sm, borderWidth: 1, borderColor: C.primary,
  },
  retryText: { color: C.primary, fontWeight: '700', fontSize: 14 },

  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: S.lg, paddingTop: S.lg },

  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: C.textDim,
    letterSpacing: 1.2, textTransform: 'uppercase',
    marginBottom: S.sm, marginTop: S.lg,
  },

  gaugesRow: { flexDirection: 'row', gap: S.sm },
  gaugeCard: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: R.md, padding: S.lg,
    alignItems: 'center', borderWidth: 1, borderColor: C.border,
    ...cardShadow,
  },
  gaugeHeader: {
    flexDirection: 'row', alignItems: 'center', gap: S.xs,
    marginBottom: S.sm, alignSelf: 'flex-start',
  },
  gaugeTitle: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  gaugeNote:  { fontSize: 10, color: C.textDim, marginTop: S.sm, textAlign: 'center' },

  actionsRow: { flexDirection: 'row', gap: S.sm },
  actionTile: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: S.sm,
    paddingHorizontal: S.md, paddingVertical: 12,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: R.md, ...cardShadow,
  },
  actionLabel: { flex: 1, fontSize: 13, fontWeight: '700', color: C.text },

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
}));

export default DeviceDetailScreen;
