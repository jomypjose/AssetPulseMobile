import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, RefreshControl,
  TouchableOpacity, ActivityIndicator,
  Animated, ToastAndroid, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Svg, { Circle } from 'react-native-svg';
import {
  Server, Bell, MessageCircle, BarChart3,
  ChevronRight, Activity, Cpu, MemoryStick,
  Ticket, ClipboardList, ScanLine, Search, Building2, CalendarClock,
  AlertTriangle,
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getDashboardStats, getDevices, getAlerts, getUnreadMessageCount } from '../services/api';
import { POLL_INTERVAL } from '../config';
import { themed, C, R, S, elevation, CHROME } from '../theme';
import UserAvatar from '../components/UserAvatar';
import MiniMap from '../components/MiniMap';
import WeatherChip from '../components/WeatherChip';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const greeting = () => {
  const h = new Date().getHours();
  if (h < 5)  return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

const showToast = (msg) => {
  if (Platform.OS === 'android') ToastAndroid.show(msg, ToastAndroid.SHORT);
};

// ─── Section header ───────────────────────────────────────────────────────────
const SectionHeader = ({ title, action, onAction }) => (
  <View style={sec.row}>
    <Text style={sec.title}>{title}</Text>
    {action && (
      <TouchableOpacity onPress={onAction} style={sec.actionBtn} activeOpacity={0.7}>
        <Text style={sec.actionText}>{action}</Text>
        <ChevronRight color={C.primary} size={14} strokeWidth={2.5} />
      </TouchableOpacity>
    )}
  </View>
);
const sec = themed(() => ({
  row:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: S.md, marginTop: S.xl },
  title:      { fontSize: 13, fontWeight: '800', color: C.text, letterSpacing: 0.2 },
  actionBtn:  { flexDirection: 'row', alignItems: 'center', gap: 1 },
  actionText: { fontSize: 12.5, color: C.primary, fontWeight: '700' },
}));

// ─── Health Ring (hero) ─────────────────────────────────────────────────────
const HealthRing = ({ online = 0, warning = 0, offline = 0, total = 0 }) => {
  const pct    = total ? Math.round((online / total) * 100) : 0;
  const color  = pct >= 90 ? C.online : pct >= 70 ? C.warning : C.offline;
  const size   = 116;
  const stroke = 11;
  const r      = (size - stroke) / 2;
  const circ   = 2 * Math.PI * r;
  const dash   = (pct / 100) * circ;

  const rows = [
    { label: 'Online',  count: online,  color: C.online  },
    { label: 'Warning', count: warning, color: C.warning },
    { label: 'Offline', count: offline, color: C.offline },
  ];

  return (
    <View style={hr.card}>
      <View style={hr.inner}>
        {/* Ring */}
        <View style={hr.ringWrap}>
          <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <Circle cx={size / 2} cy={size / 2} r={r} stroke={C.cardAlt} strokeWidth={stroke} fill="none" />
            <Circle
              cx={size / 2} cy={size / 2} r={r}
              stroke={color} strokeWidth={stroke} fill="none"
              strokeDasharray={`${dash} ${circ - dash}`}
              strokeDashoffset={circ * 0.25}
              strokeLinecap="round"
            />
          </Svg>
          <View style={hr.ringCenter}>
            <Text style={[hr.pct, { color }]}>{pct}%</Text>
            <Text style={hr.pctLabel}>health</Text>
          </View>
        </View>

        {/* Breakdown rows */}
        <View style={hr.rows}>
          {rows.map(({ label, count, color: c }) => (
            <View key={label} style={hr.statRow}>
              <View style={[hr.dot, { backgroundColor: c }]} />
              <Text style={hr.statCount}>{count}</Text>
              <Text style={hr.statLabel}>{label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Footer */}
      <View style={hr.footer}>
        <View style={hr.footerLeft}>
          <Activity color={color} size={15} strokeWidth={2.2} />
          <Text style={hr.footerTitle}>Network Health</Text>
        </View>
        <View style={[hr.pill, { backgroundColor: `${color}1e`, borderColor: `${color}55` }]}>
          <Text style={[hr.pillText, { color }]}>
            {pct >= 90 ? 'Excellent' : pct >= 70 ? 'Degraded' : 'Critical'}
          </Text>
        </View>
      </View>
    </View>
  );
};
const hr = themed(() => ({
  card: {
    backgroundColor: C.card, borderRadius: R.xl,
    padding: S.xl,
    borderWidth: 1, borderColor: C.border,
    ...elevation(2),
  },
  inner:     { flexDirection: 'row', alignItems: 'center', gap: S.xl },
  ringWrap:  { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  ringCenter:{ position: 'absolute', alignItems: 'center' },
  pct:       { fontSize: 26, fontWeight: '800', lineHeight: 30 },
  pctLabel:  { fontSize: 10, color: C.textMuted, fontWeight: '600', letterSpacing: 0.5 },
  rows:      { flex: 1, gap: S.md },
  statRow:   { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  dot:       { width: 9, height: 9, borderRadius: R.full },
  statCount: { fontSize: 18, fontWeight: '800', color: C.text, minWidth: 34 },
  statLabel: { fontSize: 13, color: C.textSub, fontWeight: '500' },
  footer:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
               marginTop: S.lg, paddingTop: S.lg, borderTopWidth: 1, borderTopColor: C.borderFaint },
  footerLeft:{ flexDirection: 'row', alignItems: 'center', gap: S.sm },
  footerTitle:{ fontSize: 14, fontWeight: '700', color: C.text },
  pill:      { paddingHorizontal: S.md, paddingVertical: 4, borderRadius: R.full, borderWidth: 1 },
  pillText:  { fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
}));

// ─── KPI strip ────────────────────────────────────────────────────────────────
const KpiCard = ({ icon: Icon, value, label, color, onPress }) => (
  <TouchableOpacity style={kpi.card} activeOpacity={0.8} onPress={onPress} disabled={!onPress}>
    <View style={[kpi.iconChip, { backgroundColor: `${color}1c` }]}>
      <Icon color={color} size={16} strokeWidth={2.2} />
    </View>
    <Text style={kpi.value}>{value}</Text>
    <Text style={kpi.label} numberOfLines={1}>{label}</Text>
  </TouchableOpacity>
);
const kpi = themed(() => ({
  card: {
    flex: 1, backgroundColor: C.card, borderRadius: R.lg,
    borderWidth: 1, borderColor: C.border,
    paddingVertical: S.md, paddingHorizontal: S.md, gap: 5,
    ...elevation(1),
  },
  iconChip: { width: 30, height: 30, borderRadius: R.sm, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  value:    { fontSize: 22, fontWeight: '800', color: C.text },
  label:    { fontSize: 11, color: C.textMuted, fontWeight: '600' },
}));

// ─── Quick Action tile (4-col) ────────────────────────────────────────────────
const ActionTile = ({ icon: Icon, label, color, badge, onPress }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn  = () => Animated.spring(scale, { toValue: 0.9, useNativeDriver: true, speed: 40, bounciness: 0 }).start();
  const onPressOut = () => Animated.spring(scale, { toValue: 1,   useNativeDriver: true, speed: 20, bounciness: 8 }).start();

  return (
    <TouchableOpacity
      style={at.wrap} onPress={onPress}
      onPressIn={onPressIn} onPressOut={onPressOut} activeOpacity={1}
    >
      <Animated.View style={[at.iconBox, { backgroundColor: `${color}18`, borderColor: `${color}30`, transform: [{ scale }] }]}>
        <Icon color={color} size={23} strokeWidth={1.9} />
        {badge > 0 && (
          <View style={at.badge}>
            <Text style={at.badgeText}>{badge > 99 ? '99+' : badge}</Text>
          </View>
        )}
      </Animated.View>
      <Text style={at.label} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
};
const at = themed(() => ({
  wrap:    { width: '25%', alignItems: 'center', gap: 7, marginBottom: S.lg },
  iconBox: {
    width: 56, height: 56, borderRadius: R.lg,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, position: 'relative',
  },
  badge: {
    position: 'absolute', top: -5, right: -5,
    minWidth: 18, height: 18, borderRadius: R.full,
    backgroundColor: C.offline, paddingHorizontal: 4,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: C.bg,
  },
  badgeText: { color: C.white, fontSize: 9, fontWeight: '800' },
  label:     { fontSize: 11, color: C.textSub, fontWeight: '600' },
}));

// ─── Alert chip (horizontal scroll) ──────────────────────────────────────────
const AlertChip = ({ alert, onPress }) => {
  const colors = { critical: C.critical, warning: C.warning, info: C.info };
  const color  = colors[alert.severity] || C.textMuted;

  return (
    <TouchableOpacity style={ach.chip} onPress={onPress} activeOpacity={0.8}>
      <View style={[ach.stripe, { backgroundColor: color }]} />
      <View style={ach.body}>
        <View style={ach.top}>
          <View style={[ach.sevDot, { backgroundColor: color }]} />
          <Text style={[ach.sev, { color }]}>{(alert.severity || '').toUpperCase()}</Text>
        </View>
        <Text style={ach.msg} numberOfLines={2}>{alert.message}</Text>
        {alert.device_ip && <Text style={ach.ip}>{alert.device_ip}</Text>}
      </View>
    </TouchableOpacity>
  );
};
const ach = themed(() => ({
  chip: {
    flexDirection: 'row', overflow: 'hidden',
    backgroundColor: C.card, borderRadius: R.lg,
    borderWidth: 1, borderColor: C.border,
    width: 230, ...elevation(1),
  },
  stripe: { width: 4 },
  body:   { flex: 1, padding: S.md, gap: 4 },
  top:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sevDot: { width: 6, height: 6, borderRadius: R.full },
  sev:    { fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  msg:    { fontSize: 12.5, color: C.text, fontWeight: '500', lineHeight: 17 },
  ip:     { fontSize: 10, color: C.textMuted, marginTop: 1 },
}));

// ─── Device row ───────────────────────────────────────────────────────────────
const MiniBar = ({ value = 0, color }) => (
  <View style={mb.track}><View style={[mb.fill, { width: `${Math.min(100, value)}%`, backgroundColor: color }]} /></View>
);
const mb = themed(() => ({
  track: { flex: 1, height: 4, backgroundColor: C.cardAlt, borderRadius: R.full, overflow: 'hidden' },
  fill:  { height: '100%', borderRadius: R.full },
}));

const DeviceRow = ({ device, isLast }) => {
  const statusColor = { Online: C.online, Offline: C.offline, Warning: C.warning }[device.monitoring_status] || C.textDim;
  const cpu  = device.cpu_usage   != null ? Math.round(device.cpu_usage) : null;
  const mem  = device.memory_used != null && device.memory_total > 0
    ? Math.round((device.memory_used / device.memory_total) * 100) : null;
  const cpuColor = cpu >= 80 ? C.offline : cpu >= 60 ? C.warning : C.online;
  const memColor = mem >= 80 ? C.offline : mem >= 60 ? C.warning : C.info;

  return (
    <View style={[dr.row, isLast && { borderBottomWidth: 0 }]}>
      <View style={[dr.bar, { backgroundColor: statusColor }]} />
      <View style={dr.body}>
        <View style={dr.top}>
          <View style={dr.topLeft}>
            <View style={[dr.dot, { backgroundColor: statusColor }]} />
            <Text style={dr.ip}>{device.ip_address}</Text>
          </View>
          <Text style={dr.name} numberOfLines={1}>{device.sys_name || device.hostname || '—'}</Text>
        </View>
        {(cpu != null || mem != null) && (
          <View style={dr.bars}>
            {cpu != null && (
              <View style={dr.barRow}>
                <Cpu color={C.textDim} size={10} strokeWidth={2} />
                <MiniBar value={cpu} color={cpuColor} />
                <Text style={[dr.barPct, { color: cpuColor }]}>{cpu}%</Text>
              </View>
            )}
            {mem != null && (
              <View style={dr.barRow}>
                <MemoryStick color={C.textDim} size={10} strokeWidth={2} />
                <MiniBar value={mem} color={memColor} />
                <Text style={[dr.barPct, { color: memColor }]}>{mem}%</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </View>
  );
};
const dr = themed(() => ({
  row:     { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.borderFaint, paddingVertical: S.md },
  bar:     { width: 3, borderRadius: R.full, marginRight: S.md, flexShrink: 0 },
  body:    { flex: 1 },
  top:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  topLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot:     { width: 7, height: 7, borderRadius: R.full },
  ip:      { fontSize: 13, fontWeight: '700', color: C.text },
  name:    { fontSize: 11, color: C.textMuted, flex: 1, textAlign: 'right', paddingLeft: S.sm },
  bars:    { gap: 5 },
  barRow:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  barPct:  { fontSize: 10, fontWeight: '700', minWidth: 28, textAlign: 'right' },
}));

// ─── Screen ───────────────────────────────────────────────────────────────────
const DashboardScreen = ({ navigation }) => {
  const { user, serverUrl } = useAuth();
  const { isDark } = useTheme();
  const insets     = useSafeAreaInsets();

  const [stats,        setStats]        = useState(null);
  const [devices,      setDevices]      = useState([]);
  const [alerts,       setAlerts]       = useState([]);
  const [unreadMsgs,   setUnreadMsgs]   = useState(0);
  const [unackedCount, setUnackedCount] = useState(0);
  const [isLoading,    setIsLoading]    = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error,        setError]        = useState('');

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    setError('');
    try {
      const [statsData, devicesData, alertsData, msgCount] = await Promise.all([
        getDashboardStats(),
        getDevices(),
        getAlerts(),
        getUnreadMessageCount().catch(() => ({ count: 0 })),
      ]);
      setStats(statsData);
      setDevices((devicesData.assets || []).slice(0, 6));

      const allAlerts = alertsData.alerts || [];
      setUnackedCount(allAlerts.filter((a) => !a.is_acknowledged).length);

      const sevOrder = { critical: 0, warning: 1, info: 2 };
      const topAlerts = allAlerts
        .filter((a) => !a.is_acknowledged)
        .sort((a, b) => (sevOrder[a.severity] ?? 3) - (sevOrder[b.severity] ?? 3))
        .slice(0, 6);
      setAlerts(topAlerts);
      setUnreadMsgs(msgCount.count || 0);
    } catch (err) {
      setError(err.message || 'Failed to load dashboard.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const t = setInterval(() => fetchData(), POLL_INTERVAL);
    return () => clearInterval(t);
  }, [fetchData]);

  const navigateTo = useCallback((tab) => {
    const parent = navigation.getParent();
    if (parent) parent.navigate(tab);
    else navigation.navigate(tab);
  }, [navigation]);

  const mon = stats?.monitoring ?? {};
  const pendingTickets = stats?.tickets?.pending ?? 0;

  const actions = [
    { icon: Server,        label: 'Devices',  color: C.primary, badge: 0,            onPress: () => navigateTo('Devices') },
    { icon: Bell,          label: 'Alerts',   color: C.offline, badge: unackedCount, onPress: () => navigateTo('Alerts') },
    { icon: MessageCircle, label: 'Messages', color: C.online,  badge: unreadMsgs,   onPress: () => navigateTo('Messages') },
    { icon: ScanLine,      label: 'Scan',     color: C.cyan,    badge: 0,            onPress: () => navigation.navigate('Scanner') },
    { icon: Ticket,        label: 'Tickets',  color: C.primary, badge: 0,            onPress: () => navigation.navigate('Tickets') },
    { icon: ClipboardList, label: 'Jobs',     color: C.warning, badge: 0,            onPress: () => navigation.navigate('DailyJobs') },
    { icon: Search,        label: 'Search',   color: C.info,    badge: 0,            onPress: () => navigation.navigate('Search') },
    { icon: CalendarClock, label: 'Expiry',   color: C.purple,  badge: 0,            onPress: () => navigation.navigate('Expiry') },
    { icon: Building2,     label: 'Branches', color: C.teal,    badge: 0,            onPress: () => navigation.navigate('Branches') },
    { icon: BarChart3,     label: 'Reports',  color: C.purple,  badge: 0,            onPress: () => showToast('Reports — Coming soon') },
  ];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar style="auto" />

      {/* ── Hero Header ── */}
      <View style={styles.hero}>
        <View style={styles.heroLeft}>
          <UserAvatar user={user} serverUrl={serverUrl} size={46} />
          <View style={{ flexShrink: 1 }}>
            <Text style={styles.greeting}>{greeting()},</Text>
            <Text style={styles.userName} numberOfLines={1}>
              {user?.full_name || user?.username || 'User'}
            </Text>
          </View>
        </View>
        <WeatherChip />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + S.xxxxl }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => fetchData(true)}
            tintColor={C.primary}
            colors={[C.primary]}
          />
        }
      >
        {/* Error */}
        {!!error && (
          <View style={styles.errorBanner}>
            <AlertTriangle color={C.offline} size={15} strokeWidth={2.2} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Health hero */}
        {isLoading ? (
          <View style={styles.heroPlaceholder}>
            <ActivityIndicator color={C.primary} size="large" />
          </View>
        ) : (
          <HealthRing
            online={mon.online ?? 0}
            warning={mon.warning ?? 0}
            offline={mon.offline ?? 0}
            total={mon.total ?? 0}
          />
        )}

        {/* KPI strip */}
        {!isLoading && (
          <View style={styles.kpiRow}>
            <KpiCard icon={Server} value={mon.total ?? 0} label="Devices" color={C.primary} onPress={() => navigateTo('Devices')} />
            <KpiCard icon={Bell}   value={unackedCount}   label="Alerts"  color={C.offline} onPress={() => navigateTo('Alerts')} />
            <KpiCard icon={Ticket} value={pendingTickets} label="Tickets" color={C.warning} onPress={() => navigation.navigate('Tickets')} />
          </View>
        )}

        {/* Mini Map */}
        <SectionHeader title="Branch Network Map" action="Full map" onAction={() => navigation.navigate('Map')} />
        <MiniMap height={210} isDark={isDark} onPress={() => navigation.navigate('Map')} />

        {/* Quick Actions */}
        <SectionHeader title="Quick Actions" />
        <View style={styles.actionsGrid}>
          {actions.map((a) => (
            <ActionTile key={a.label} icon={a.icon} label={a.label} color={a.color} badge={a.badge} onPress={a.onPress} />
          ))}
        </View>

        {/* Active Alerts */}
        {alerts.length > 0 && (
          <>
            <SectionHeader title="Active Alerts" action="View all" onAction={() => navigateTo('Alerts')} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.alertsScroll}>
              {alerts.map((a) => (
                <AlertChip key={a.id} alert={a} onPress={() => navigateTo('Alerts')} />
              ))}
            </ScrollView>
          </>
        )}

        {/* Top Devices */}
        <SectionHeader title="Top Devices" action="View all" onAction={() => navigateTo('Devices')} />
        <View style={styles.devicesCard}>
          {isLoading ? (
            <ActivityIndicator color={C.primary} style={{ marginVertical: S.xl }} />
          ) : devices.length === 0 ? (
            <View style={styles.emptyInCard}>
              <Server color={C.textDim} size={28} strokeWidth={1.2} />
              <Text style={styles.emptyText}>No devices found.</Text>
            </View>
          ) : (
            devices.map((d, i) => (
              <DeviceRow key={d.id} device={d} isLast={i === devices.length - 1} />
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = themed(() => ({
  root: { flex: 1, backgroundColor: C.bg },

  hero: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: S.xl, paddingVertical: S.lg,
    backgroundColor: CHROME.bg,
    borderBottomWidth: 1, borderBottomColor: CHROME.border,
    gap: S.md,
  },
  heroLeft:   { flexDirection: 'row', alignItems: 'center', gap: S.md, flexShrink: 1 },
  greeting:   { fontSize: 11, color: CHROME.textMuted },
  userName:   { fontSize: 18, fontWeight: '800', color: CHROME.text },

  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: S.lg, paddingTop: S.lg },

  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: S.sm,
    backgroundColor: C.offlineBg, borderRadius: R.md, padding: S.md,
    marginBottom: S.lg, borderLeftWidth: 3, borderLeftColor: C.offline,
  },
  errorText: { color: '#fca5a5', fontSize: 13, flex: 1 },

  heroPlaceholder: { height: 180, alignItems: 'center', justifyContent: 'center' },

  kpiRow: { flexDirection: 'row', gap: S.md, marginTop: S.md },

  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap' },

  alertsScroll: { gap: S.md, paddingBottom: S.xs, paddingRight: S.lg },

  devicesCard: {
    backgroundColor: C.card, borderRadius: R.xl,
    paddingHorizontal: S.lg, paddingVertical: S.sm,
    borderWidth: 1, borderColor: C.border,
    ...elevation(2),
  },
  emptyInCard: { paddingVertical: S.xl, alignItems: 'center', gap: S.sm },
  emptyText:   { color: C.textDim, fontSize: 13, textAlign: 'center' },
}));

export default DashboardScreen;
