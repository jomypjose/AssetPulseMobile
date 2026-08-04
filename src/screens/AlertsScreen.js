import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, ScrollView,
  RefreshControl, StyleSheet, ActivityIndicator, Alert,
  Animated, Modal, Dimensions, PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  CheckCheck, Bell, AlertTriangle, Info, ShieldAlert, BellOff,
  X, Cpu, Thermometer, Wifi, WifiOff, RotateCcw, MemoryStick,
  MapPin, Tag, Clock, Calendar, Gauge, Activity, Users,
} from 'lucide-react-native';
import { getAlerts, acknowledgeAlerts } from '../services/api';
import { POLL_INTERVAL } from '../config';
import { themed, C, R, S, cardShadow, elevation, CHROME } from '../theme';

const { height: SCREEN_H } = Dimensions.get('window');

// Kept in sync with the web app (client/src/pages/AlertsPage.jsx) so alerts
// look identical across mobile and web.
const METRIC_ICON = {
  cpu: Cpu,
  memory: MemoryStick,
  temperature: Thermometer,
  latency: Gauge,
  ping_down: WifiOff,
  ping_up: Wifi,
  device_reboot: RotateCcw,
  network_flap: Activity,
  down_reminder: Clock,
  group_down: Users,
  unreachable: WifiOff,
  reboot: RotateCcw,
  ill_outage: WifiOff,
  ill_outage_cluster: WifiOff,
  ill_outage_state: WifiOff,
  network_recovery: Wifi,
};

const METRIC_LABEL = {
  cpu: 'CPU',
  memory: 'Memory',
  temperature: 'Temperature',
  latency: 'Latency',
  ping_down: 'Device Down',
  ping_up: 'Device Up',
  device_reboot: 'Device Reboot',
  network_flap: 'Network Flap',
  down_reminder: 'Still Offline (Reminder)',
  group_down: 'Group Down',
  unreachable: 'Unreachable (event)',
  reboot: 'Reboot (event)',
  ill_outage: 'ISP / ILL Outage',
  ill_outage_cluster: 'Cluster ISP Outage',
  ill_outage_state: 'State-wide ISP Outage',
  network_recovery: 'Network Recovery',
};

const metricLabel = (m) => METRIC_LABEL[m] || m || 'Alert';

const fmtDate = (ts) => {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// ─── Alert Detail Bottom Sheet ────────────────────────────────────────────────
const AlertDetailSheet = ({ alert, onClose, onAcknowledge }) => {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(SCREEN_H)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const [acking, setAcking] = useState(false);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 200 }),
      Animated.timing(backdropAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }, []);

  const close = useCallback(() => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: SCREEN_H, duration: 250, useNativeDriver: true }),
      Animated.timing(backdropAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => onClose());
  }, []);

  const panResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => g.dy > 8,
    onPanResponderMove: (_, g) => { if (g.dy > 0) slideAnim.setValue(g.dy); },
    onPanResponderRelease: (_, g) => {
      if (g.dy > 80 || g.vy > 0.8) close();
      else Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 20 }).start();
    },
  })).current;

  const handleAck = useCallback(async () => {
    setAcking(true);
    try { await onAcknowledge([alert.id]); close(); }
    finally { setAcking(false); }
  }, [alert.id]);

  if (!alert) return null;

  const { color, bg, Icon } = getSev(alert.severity);
  const MetricIcon = METRIC_ICON[alert.metric] || Bell;
  const device = alert.network_asset || {};

  const Row = ({ label, value, icon: RowIcon }) => value ? (
    <View style={ds.row}>
      {RowIcon && <RowIcon size={13} color={C.textMuted} strokeWidth={2} style={{ marginTop: 1 }} />}
      <Text style={ds.rowLabel}>{label}</Text>
      <Text style={ds.rowValue}>{value}</Text>
    </View>
  ) : null;

  return (
    <Modal transparent animationType="none" onRequestClose={close}>
      {/* Backdrop */}
      <Animated.View style={[ds.backdrop, { opacity: backdropAnim }]}>
        <TouchableOpacity style={{ flex: 1 }} onPress={close} activeOpacity={1} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View style={[ds.sheet, { transform: [{ translateY: slideAnim }], paddingBottom: insets.bottom + S.xl }]}>
        {/* Drag handle */}
        <View {...panResponder.panHandlers} style={ds.handleArea}>
          <View style={ds.handle} />
        </View>

        {/* Header */}
        <View style={[ds.header, { borderLeftColor: color }]}>
          <View style={[ds.sevIcon, { backgroundColor: `${color}20` }]}>
            <Icon color={color} size={20} strokeWidth={2} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
              <View style={[ds.sevBadge, { backgroundColor: `${color}22`, borderColor: `${color}55` }]}>
                <Text style={[ds.sevText, { color }]}>{(alert.severity || 'unknown').toUpperCase()}</Text>
              </View>
              {alert.is_acknowledged && (
                <View style={ds.ackedBadge}>
                  <CheckCheck size={10} color={C.online} strokeWidth={2.5} />
                  <Text style={ds.ackedText}>Acknowledged</Text>
                </View>
              )}
            </View>
            <Text style={ds.metric}>{metricLabel(alert.metric || alert.type)}</Text>
          </View>
          <TouchableOpacity onPress={close} style={ds.closeBtn}>
            <X size={18} color={C.textMuted} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={ds.body} showsVerticalScrollIndicator={false}>
          {/* Message */}
          <View style={[ds.messageBox, { backgroundColor: `${color}0f`, borderColor: `${color}30` }]}>
            <MetricIcon size={15} color={color} strokeWidth={2} />
            <Text style={[ds.messageText, { color: C.text }]}>{alert.message || 'No message provided.'}</Text>
          </View>

          {/* Device info */}
          {(device.sys_name || alert.device_name || device.ip_address || alert.device_ip) && (
            <View style={ds.section}>
              <Text style={ds.sectionTitle}>DEVICE</Text>
              <Row label="IP"       value={device.ip_address || alert.device_ip} icon={Wifi} />
              <Row label="Location" value={device.branch_name || alert.branch_name} icon={MapPin} />
              <Row label="Name"     value={device.sys_name || alert.device_name} icon={Tag} />
              <Row label="Category" value={device.category || alert.category} icon={Tag} />
            </View>
          )}

          {/* Alert info */}
          <View style={ds.section}>
            <Text style={ds.sectionTitle}>DETAILS</Text>
            <Row label="Metric"   value={metricLabel(alert.metric)} icon={Tag} />
            <Row label="Status"   value={alert.status}    icon={Bell} />
            <Row label="Triggered" value={fmtDate(alert.created_at)} icon={Calendar} />
            {alert.resolved_at && <Row label="Resolved"  value={fmtDate(alert.resolved_at)} icon={Clock} />}
          </View>
        </ScrollView>

        {/* Acknowledge button */}
        {!alert.is_acknowledged && (
          <View style={ds.footer}>
            <TouchableOpacity
              style={[ds.ackBtn, acking && { opacity: 0.6 }]}
              onPress={handleAck}
              disabled={acking}
              activeOpacity={0.8}
            >
              {acking
                ? <ActivityIndicator size="small" color={C.white} />
                : <><CheckCheck size={16} color={C.white} strokeWidth={2.5} /><Text style={ds.ackBtnText}>Acknowledge</Text></>
              }
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>
    </Modal>
  );
};

const ds = themed(() => ({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: C.card, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: SCREEN_H * 0.85, ...elevation(8),
  },
  handleArea: { alignItems: 'center', paddingVertical: S.md },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: C.border },
  header: {
    flexDirection: 'row', alignItems: 'flex-start', gap: S.md,
    paddingHorizontal: S.xl, paddingBottom: S.md,
    borderLeftWidth: 4, borderLeftColor: C.border,
    marginHorizontal: S.lg, borderRadius: R.sm,
    backgroundColor: C.cardAlt, padding: S.md,
  },
  sevIcon: { width: 40, height: 40, borderRadius: R.md, alignItems: 'center', justifyContent: 'center' },
  sevBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: R.xs, borderWidth: 1 },
  sevText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  ackedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: C.onlineBg, paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: R.xs, borderWidth: 1, borderColor: `${C.online}44`,
  },
  ackedText: { color: C.online, fontSize: 10, fontWeight: '700' },
  metric: { color: C.textMuted, fontSize: 12, fontWeight: '600', marginTop: 3 },
  closeBtn: { padding: S.xs },
  body: { paddingHorizontal: S.xl, paddingTop: S.md, gap: S.lg, paddingBottom: S.md },
  messageBox: {
    flexDirection: 'row', gap: S.sm, alignItems: 'flex-start',
    padding: S.md, borderRadius: R.md, borderWidth: 1,
  },
  messageText: { flex: 1, fontSize: 14, lineHeight: 22, fontWeight: '500' },
  section: { gap: S.sm },
  sectionTitle: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, color: C.textDim, marginBottom: 2 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: S.sm, paddingVertical: 3 },
  rowLabel: { width: 70, fontSize: 12, color: C.textMuted, fontWeight: '600' },
  rowValue: { flex: 1, fontSize: 13, color: C.text, fontWeight: '500' },
  footer: { paddingHorizontal: S.xl, paddingTop: S.md },
  ackBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm,
    backgroundColor: C.online, borderRadius: R.lg, paddingVertical: S.md,
  },
  ackBtnText: { color: C.white, fontSize: 15, fontWeight: '700' },
}));

// ─── Severity config ──────────────────────────────────────────────────────────
const SEV = {
  critical: { color: C.critical, bg: C.criticalBg, dim: '#3d1018', Icon: ShieldAlert  },
  warning:  { color: C.warning,  bg: C.warningBg,  dim: C.warningDim, Icon: AlertTriangle },
  info:     { color: C.info,     bg: C.infoBg,     dim: '#1a3460',    Icon: Info        },
};
const getSev = (s) => SEV[s] || { color: C.textMuted, bg: C.card, dim: C.border, Icon: Bell };

const FILTER_TABS = [
  { key: 'all',            label: 'All',      color: C.primary  },
  { key: 'critical',       label: 'Critical', color: C.critical },
  { key: 'warning',        label: 'Warning',  color: C.warning  },
  { key: 'info',           label: 'Info',     color: C.info     },
  { key: 'unacknowledged', label: 'Unacked',  color: C.online   },
];

const relTime = (ts) => {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

// ─── Summary stat chip (clean KPI-card style) ────────────────────────────────
const SummaryChip = ({ label, count, color, Icon }) => (
  <View style={sc.chip}>
    <View style={[sc.iconBox, { backgroundColor: `${color}1c` }]}>
      <Icon color={color} size={15} strokeWidth={2.2} />
    </View>
    <Text style={[sc.count, { color }]}>{count}</Text>
    <Text style={sc.label}>{label}</Text>
  </View>
);
const sc = themed(() => ({
  chip: {
    flex: 1, backgroundColor: C.card,
    borderRadius: R.lg, borderWidth: 1, borderColor: C.border,
    paddingVertical: S.md, paddingHorizontal: S.md, gap: 5,
    ...elevation(1),
  },
  iconBox: { width: 30, height: 30, borderRadius: R.sm, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  count:   { fontSize: 22, fontWeight: '800', lineHeight: 26 },
  label:   { fontSize: 11, color: C.textMuted, fontWeight: '600' },
}));

// ─── Alert Card ───────────────────────────────────────────────────────────────
const AlertCard = ({ alert, onAcknowledge, isSelected, onLongPress, onPress, selectionMode }) => {
  const { color, bg } = getSev(alert.severity);
  const Icon = METRIC_ICON[alert.metric] || AlertTriangle;
  const device = alert.network_asset || {};
  const deviceIp = device.ip_address || alert.device_ip;
  const location = device.branch_name || alert.branch_name;
  const [acking, setAcking] = useState(false);
  const fadeAnim = useRef(new Animated.Value(alert.is_acknowledged ? 0.65 : 1)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: alert.is_acknowledged ? 0.65 : 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [alert.is_acknowledged, fadeAnim]);

  const handleAck = useCallback(async () => {
    if (alert.is_acknowledged) return;
    setAcking(true);
    try { await onAcknowledge([alert.id]); }
    finally { setAcking(false); }
  }, [alert.id, alert.is_acknowledged, onAcknowledge]);

  return (
    <TouchableOpacity
      onPress={() => onPress(alert.id)}
      onLongPress={() => onLongPress(alert.id)}
      delayLongPress={350}
      activeOpacity={selectionMode ? 0.8 : 1}
    >
      <Animated.View
        style={[
          styles.card,
          { borderLeftColor: color, opacity: fadeAnim },
          isSelected && { backgroundColor: `${color}12`, borderColor: `${color}66` },
        ]}
      >
        {/* Selection checkbox */}
        {selectionMode && (
          <View style={[styles.checkbox, isSelected && { backgroundColor: color, borderColor: color }]}>
            {isSelected && <CheckCheck color={C.white} size={10} strokeWidth={3} />}
          </View>
        )}

        {/* Top row */}
        <View style={styles.cardTop}>
          <View style={[styles.sevIcon, { backgroundColor: `${color}18` }]}>
            <Icon color={color} size={16} strokeWidth={2} />
          </View>
          <View style={styles.cardTopMid}>
            <View style={[styles.sevBadge, { backgroundColor: `${color}22`, borderColor: `${color}55` }]}>
              <Text style={[styles.sevText, { color }]}>
                {(alert.severity || 'unknown').toUpperCase()}
              </Text>
            </View>
            {(alert.metric || alert.type) && (
              <Text style={styles.metricLabel} numberOfLines={1}>{metricLabel(alert.metric || alert.type)}</Text>
            )}
            {deviceIp && (
              <Text style={styles.deviceIp}>{deviceIp}</Text>
            )}
          </View>
          {alert.is_acknowledged ? (
            <View style={styles.ackedPill}>
              <CheckCheck color={C.online} size={11} strokeWidth={2.5} />
              <Text style={styles.ackedText}>Acked</Text>
            </View>
          ) : (
            <View style={[styles.unackedDot, { backgroundColor: color }]} />
          )}
        </View>

        {/* Message */}
        <Text style={styles.message} numberOfLines={2}>{alert.message || 'No message provided.'}</Text>

        {/* Location */}
        {location && (
          <View style={styles.locationRow}>
            <MapPin size={11} color={C.textMuted} strokeWidth={2} />
            <Text style={styles.deviceName} numberOfLines={1}>{location}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.cardFooter}>
          <View style={styles.footerLeft}>
            {alert.type && <Text style={styles.metaChip}>{alert.type}</Text>}
            <Text style={styles.time}>{relTime(alert.created_at)}</Text>
          </View>
          {!alert.is_acknowledged && !selectionMode && (
            <TouchableOpacity
              style={[styles.ackBtn, acking && { opacity: 0.5 }]}
              onPress={handleAck}
              disabled={acking}
              activeOpacity={0.7}
            >
              {acking
                ? <ActivityIndicator size="small" color={C.online} />
                : (
                  <>
                    <CheckCheck color={C.online} size={13} strokeWidth={2} />
                    <Text style={styles.ackBtnText}>Ack</Text>
                  </>
                )}
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
};

// ─── Screen ───────────────────────────────────────────────────────────────────
const AlertsScreen = () => {
  const insets = useSafeAreaInsets();

  const [alerts,        setAlerts]        = useState([]);
  const [isLoading,     setIsLoading]     = useState(true);
  const [isRefreshing,  setIsRefreshing]  = useState(false);
  const [error,         setError]         = useState('');
  const [activeTab,     setActiveTab]     = useState('all');
  const [ackingAll,     setAckingAll]     = useState(false);
  const [selectedIds,   setSelectedIds]   = useState(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [detailAlert,   setDetailAlert]   = useState(null);
  const bulkBarAnim = useRef(new Animated.Value(0)).current;

  const fetchAlerts = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    setError('');
    try {
      const data = await getAlerts();
      setAlerts(data.alerts || []);
    } catch (err) {
      setError(err.message || 'Failed to load alerts.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
    const t = setInterval(() => fetchAlerts(), POLL_INTERVAL);
    return () => clearInterval(t);
  }, [fetchAlerts]);

  // Animate bulk action bar
  useEffect(() => {
    Animated.spring(bulkBarAnim, {
      toValue: selectionMode && selectedIds.size > 0 ? 1 : 0,
      useNativeDriver: true,
      speed: 18,
      bounciness: 4,
    }).start();
  }, [selectionMode, selectedIds.size, bulkBarAnim]);

  const counts = useMemo(() => {
    const c = { all: alerts.length, unacknowledged: 0 };
    alerts.forEach((a) => {
      if (a.severity) c[a.severity] = (c[a.severity] || 0) + 1;
      if (!a.is_acknowledged) c.unacknowledged++;
    });
    return c;
  }, [alerts]);

  const filtered = useMemo(() => {
    if (activeTab === 'all')            return alerts;
    if (activeTab === 'unacknowledged') return alerts.filter((a) => !a.is_acknowledged);
    return alerts.filter((a) => a.severity === activeTab);
  }, [alerts, activeTab]);

  const handleAcknowledge = useCallback(async (ids) => {
    try {
      await acknowledgeAlerts(ids);
      setAlerts((prev) =>
        prev.map((a) =>
          ids.includes(a.id)
            ? { ...a, status: 'acknowledged', is_acknowledged: true }
            : a,
        ),
      );
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to acknowledge.');
    }
  }, []);

  const handleAckAll = useCallback(() => {
    const unacked = filtered.filter((a) => !a.is_acknowledged);
    if (!unacked.length) return;
    Alert.alert(
      'Acknowledge All',
      `Mark ${unacked.length} alert${unacked.length !== 1 ? 's' : ''} as acknowledged?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setAckingAll(true);
            try {
              await handleAcknowledge(unacked.map((a) => a.id));
            } finally {
              setAckingAll(false);
            }
          },
        },
      ],
    );
  }, [filtered, handleAcknowledge]);

  const handleLongPress = useCallback((id) => {
    setSelectionMode(true);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const handleCardPress = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (next.size === 0) setSelectionMode(false);
      return next;
    });
  }, []);

  const handleBulkAck = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    setSelectionMode(false);
    setSelectedIds(new Set());
    await handleAcknowledge(ids);
  }, [selectedIds, handleAcknowledge]);

  const cancelSelection = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const renderItem = useCallback(({ item }) => (
    <AlertCard
      alert={item}
      onAcknowledge={handleAcknowledge}
      isSelected={selectedIds.has(item.id)}
      onLongPress={handleLongPress}
      onPress={selectionMode ? handleCardPress : (id) => setDetailAlert(alerts.find(a => a.id === id))}
      selectionMode={selectionMode}
    />
  ), [handleAcknowledge, selectedIds, handleLongPress, handleCardPress, selectionMode, alerts]);

  const keyExtractor = useCallback((item) => String(item.id), []);

  const ListEmpty = () => (
    isLoading ? null : (
      <View style={styles.emptyState}>
        <BellOff color={C.textDim} size={52} strokeWidth={1.1} />
        <Text style={styles.emptyTitle}>No alerts</Text>
        <Text style={styles.emptySub}>
          {activeTab === 'unacknowledged'
            ? 'All caught up — no unacknowledged alerts.'
            : 'No alerts match the selected filter.'}
        </Text>
      </View>
    )
  );

  const unackedInView = useMemo(() => filtered.filter((a) => !a.is_acknowledged), [filtered]);
  const criticalCount  = counts.critical || 0;
  const warningCount   = counts.warning  || 0;
  const infoCount      = counts.info     || 0;

  const bulkBarTranslate = bulkBarAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [100, 0],
  });

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar style="auto" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>Alerts</Text>
            {counts.unacknowledged > 0 && (
              <Text style={styles.headerSub}>{counts.unacknowledged} unacknowledged</Text>
            )}
          </View>
          <View style={styles.headerRight}>
            {selectionMode ? (
              <TouchableOpacity style={styles.cancelBtn} onPress={cancelSelection} activeOpacity={0.7}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            ) : (
              unackedInView.length > 0 && (
                <TouchableOpacity
                  style={[styles.ackAllBtn, ackingAll && { opacity: 0.5 }]}
                  onPress={handleAckAll}
                  disabled={ackingAll}
                  activeOpacity={0.7}
                >
                  {ackingAll
                    ? <ActivityIndicator size="small" color={C.online} />
                    : (
                      <>
                        <CheckCheck color={C.online} size={15} strokeWidth={2} />
                        <Text style={styles.ackAllText}>Ack All</Text>
                      </>
                    )}
                </TouchableOpacity>
              )
            )}
          </View>
        </View>

        {/* Summary chips */}
        <View style={styles.summaryRow}>
          <SummaryChip label="Critical" count={criticalCount} color={C.critical} Icon={ShieldAlert} />
          <SummaryChip label="Warning"  count={warningCount}  color={C.warning}  Icon={AlertTriangle} />
          <SummaryChip label="Info"     count={infoCount}     color={C.info}     Icon={Info} />
        </View>
      </View>

      {/* ── Filter tabs ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabScroll}
        contentContainerStyle={styles.tabRow}
      >
        {FILTER_TABS.map(({ key, label, color }, i) => {
          const active = activeTab === key;
          const count  = counts[key] ?? 0;
          return (
            <TouchableOpacity
              key={key}
              style={[
                styles.tab,
                { marginRight: i === FILTER_TABS.length - 1 ? S.lg : S.sm },
                active && { backgroundColor: `${color}20`, borderColor: color },
              ]}
              onPress={() => setActiveTab(key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabLabel, active && { color }]}>{label}</Text>
              {count > 0 && (
                <View style={[styles.tabBadge, { backgroundColor: active ? `${color}30` : C.cardAlt }]}>
                  <Text style={[styles.tabBadgeText, { color: active ? color : C.textMuted }]}>{count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Error ── */}
      {!!error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {isLoading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={C.primary} />
          <Text style={styles.loadingText}>Loading alerts…</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + S.xxxxl + (selectionMode ? 80 : 0) },
          ]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={ListEmpty}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => fetchAlerts(true)}
              tintColor={C.primary}
              colors={[C.primary]}
            />
          }
          ItemSeparatorComponent={() => <View style={{ height: S.sm }} />}
        />
      )}

      {/* ── Bulk action floating bar ── */}
      <Animated.View
        style={[
          styles.bulkBar,
          { bottom: insets.bottom + S.lg, transform: [{ translateY: bulkBarTranslate }] },
        ]}
        pointerEvents={selectionMode && selectedIds.size > 0 ? 'auto' : 'none'}
      >
        <View style={styles.bulkBarInner}>
          <Text style={styles.bulkBarText}>
            {selectedIds.size} alert{selectedIds.size !== 1 ? 's' : ''} selected
          </Text>
          <TouchableOpacity
            style={styles.bulkAckBtn}
            onPress={handleBulkAck}
            activeOpacity={0.8}
          >
            <CheckCheck color={C.white} size={15} strokeWidth={2.5} />
            <Text style={styles.bulkAckText}>Acknowledge {selectedIds.size}</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* ── Alert Detail Sheet ── */}
      {detailAlert && (
        <AlertDetailSheet
          alert={detailAlert}
          onClose={() => setDetailAlert(null)}
          onAcknowledge={async (ids) => {
            await handleAcknowledge(ids);
            setDetailAlert(prev => prev ? { ...prev, is_acknowledged: true, status: 'acknowledged' } : null);
          }}
        />
      )}
    </View>
  );
};

const styles = themed(() => ({
  root: { flex: 1, backgroundColor: C.bg },

  header: {
    backgroundColor: CHROME.bg,
    borderBottomWidth: 1, borderBottomColor: CHROME.border,
    paddingHorizontal: S.xl,
    paddingTop: S.lg,
    paddingBottom: S.md,
    gap: S.md,
  },
  headerTop: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: CHROME.text },
  headerSub:   { fontSize: 11, color: C.offline, marginTop: 2, fontWeight: '500' },
  headerRight: { paddingTop: 4 },

  cancelBtn: {
    paddingHorizontal: S.md, paddingVertical: S.xs + 2,
    borderRadius: R.sm, borderWidth: 1, borderColor: C.border,
  },
  cancelText: { color: C.textMuted, fontSize: 13, fontWeight: '600' },

  ackAllBtn: {
    flexDirection: 'row', alignItems: 'center', gap: S.xs,
    paddingHorizontal: S.md, paddingVertical: S.xs + 2,
    backgroundColor: C.onlineBg,
    borderRadius: R.sm, borderWidth: 1, borderColor: `${C.online}55`,
  },
  ackAllText: { color: C.online, fontSize: 13, fontWeight: '600' },

  summaryRow: { flexDirection: 'row', gap: S.sm },

  tabScroll: { flexGrow: 0, flexShrink: 0 },
  tabRow:    { flexDirection: 'row', paddingLeft: S.lg, paddingVertical: S.sm },
  tab: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: S.md, paddingVertical: S.xs + 2,
    borderRadius: R.full, borderWidth: 1, borderColor: C.border,
    gap: 5, flexShrink: 0,
  },
  tabLabel:     { fontSize: 12, color: C.textMuted, fontWeight: '600' },
  tabBadge:     { borderRadius: R.full, paddingHorizontal: 6, paddingVertical: 1 },
  tabBadgeText: { fontSize: 10, fontWeight: '700' },

  errorBanner: {
    backgroundColor: C.offlineBg, marginHorizontal: S.lg, marginTop: S.sm,
    borderRadius: R.md, padding: S.md,
    borderLeftWidth: 3, borderLeftColor: C.offline,
  },
  errorText: { color: '#fca5a5', fontSize: 13 },

  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: S.md },
  loadingText:  { color: C.textMuted, fontSize: 14 },

  listContent: { paddingHorizontal: S.lg, paddingTop: S.sm },

  // ── Alert card ──────────────────────────────────────────────────────────────
  card: {
    backgroundColor: C.card,
    borderRadius: R.lg, padding: S.lg,
    borderWidth: 1, borderColor: C.border,
    borderLeftWidth: 3,
    ...elevation(1),
  },
  checkbox: {
    width: 20, height: 20, borderRadius: R.xs,
    borderWidth: 2, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: S.sm,
  },
  cardTop:    { flexDirection: 'row', alignItems: 'center', gap: S.sm, marginBottom: S.sm },
  sevIcon:    { width: 32, height: 32, borderRadius: R.sm, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardTopMid: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: S.sm, flexWrap: 'wrap' },
  sevBadge:   { paddingHorizontal: 7, paddingVertical: 2, borderRadius: R.xs, borderWidth: 1 },
  sevText:    { fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  metricLabel:{ fontSize: 11, color: C.textMuted, fontWeight: '700', flexShrink: 1 },
  deviceIp:   { fontSize: 11, color: C.textMuted, fontWeight: '500' },

  ackedPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: C.onlineBg,
    paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: R.xs, borderWidth: 1, borderColor: `${C.online}44`,
    flexShrink: 0,
  },
  ackedText:  { color: C.online, fontSize: 10, fontWeight: '600' },
  unackedDot: { width: 8, height: 8, borderRadius: R.full, flexShrink: 0 },

  message:    { fontSize: 14, color: C.text, lineHeight: 20, fontWeight: '500', marginBottom: S.xs },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: S.sm },
  deviceName: { fontSize: 11, color: C.textMuted },

  cardFooter:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: S.sm, borderTopWidth: 1, borderTopColor: C.borderFaint },
  footerLeft:  { flexDirection: 'row', alignItems: 'center', gap: S.sm, flex: 1 },
  metaChip:    { fontSize: 10, color: C.textDim, backgroundColor: C.surface, borderRadius: R.xs, paddingHorizontal: 6, paddingVertical: 2, fontWeight: '500' },
  time:        { fontSize: 11, color: C.textDim },

  ackBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: S.md, paddingVertical: S.xs + 1,
    backgroundColor: C.onlineBg,
    borderRadius: R.xs, borderWidth: 1, borderColor: `${C.online}66`,
  },
  ackBtnText: { color: C.online, fontSize: 12, fontWeight: '600' },

  emptyState: { paddingTop: 80, alignItems: 'center', gap: S.sm },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: C.textMuted, marginTop: S.sm },
  emptySub:   { fontSize: 13, color: C.textDim, textAlign: 'center', paddingHorizontal: S.xxxl },

  // ── Bulk bar ──────────────────────────────────────────────────────────────
  bulkBar: {
    position: 'absolute', left: S.lg, right: S.lg,
  },
  bulkBarInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.card,
    borderRadius: R.xl, paddingHorizontal: S.lg, paddingVertical: S.md,
    borderWidth: 1, borderColor: C.border,
    ...elevation(4),
  },
  bulkBarText:  { fontSize: 13, color: C.textSub, fontWeight: '500' },
  bulkAckBtn: {
    flexDirection: 'row', alignItems: 'center', gap: S.xs,
    backgroundColor: C.online, borderRadius: R.lg,
    paddingHorizontal: S.lg, paddingVertical: S.sm,
  },
  bulkAckText: { color: C.white, fontSize: 13, fontWeight: '700' },
}));

export default AlertsScreen;
