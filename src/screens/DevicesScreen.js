import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity, ScrollView,
  RefreshControl, StyleSheet, ActivityIndicator, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import {
  Search, X, Server, Cpu, MemoryStick,
  Clock, WifiOff, AlertTriangle,
} from 'lucide-react-native';
import PulseLogo from '../components/PulseLogo';
import StaleBanner from '../components/StaleBanner';
import { getDevices } from '../services/api';
import { POLL_INTERVAL } from '../config';
import { themed, C, R, S, elevation, CHROME, DANGER_TEXT } from '../theme';

// ─── Constants ────────────────────────────────────────────────────────────────
// PulseLogo wrapper sized like a lucide icon (accepts color + size props)
const PulseIcon = ({ color, size }) => <PulseLogo color={color} size={size} />;

const STATUS_CONFIG = {
  Online:  { color: C.online,  bg: C.onlineBg,  dim: C.onlineDim,  Icon: PulseIcon      },
  Warning: { color: C.warning, bg: C.warningBg, dim: C.warningDim, Icon: AlertTriangle   },
  Offline: { color: C.offline, bg: C.offlineBg, dim: C.offlineDim, Icon: WifiOff         },
};

const FILTER_TABS = [
  { key: 'All',     label: 'All',     color: C.primary },
  { key: 'Online',  label: 'Online',  color: C.online  },
  { key: 'Warning', label: 'Warning', color: C.warning },
  { key: 'Offline', label: 'Offline', color: C.offline },
];

const relTime = (ts) => {
  if (!ts) return 'never';
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

// ─── Animated status dot (pulsing for Online) ────────────────────────────────
const StatusDot = ({ status }) => {
  const cfg   = STATUS_CONFIG[status] || { color: C.textDim };
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (status !== 'Online') return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.8, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,   duration: 900, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [status, pulse]);

  return (
    <View style={sd.wrap}>
      {status === 'Online' && (
        <Animated.View
          style={[
            sd.ring,
            { borderColor: cfg.color, transform: [{ scale: pulse }] },
          ]}
        />
      )}
      <View style={[sd.dot, { backgroundColor: cfg.color }]} />
    </View>
  );
};
const sd = themed(() => ({
  wrap: { width: 14, height: 14, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, opacity: 0.4 },
  dot:  { width: 8, height: 8, borderRadius: 4 },
}));

// ─── Mini progress bar ────────────────────────────────────────────────────────
const MiniBar = ({ value = 0, color, label }) => (
  <View style={bar.row}>
    <Text style={bar.label}>{label}</Text>
    <View style={bar.track}>
      <View style={[bar.fill, { width: `${Math.min(100, value)}%`, backgroundColor: color }]} />
    </View>
    <Text style={[bar.pct, { color }]}>{value}%</Text>
  </View>
);
const bar = themed(() => ({
  row:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { fontSize: 9, color: C.textDim, fontWeight: '600', width: 24, textTransform: 'uppercase', letterSpacing: 0.5 },
  track: { flex: 1, height: 4, backgroundColor: C.cardAlt, borderRadius: R.full, overflow: 'hidden' },
  fill:  { height: '100%', borderRadius: R.full },
  pct:   { fontSize: 10, fontWeight: '700', minWidth: 30, textAlign: 'right' },
}));

// ─── Device Card ──────────────────────────────────────────────────────────────
const DeviceCard = ({ device, onPress }) => {
  const cfg      = STATUS_CONFIG[device.monitoring_status] || { color: C.textDim, bg: C.card };
  const cpu      = device.cpu_usage    != null ? Math.round(device.cpu_usage) : null;
  const memPct   = device.memory_used  != null && device.memory_total > 0
    ? Math.round((device.memory_used / device.memory_total) * 100)
    : null;
  const cpuColor = cpu  >= 80 ? C.offline : cpu  >= 60 ? C.warning : C.online;
  const memColor = memPct >= 80 ? C.offline : memPct >= 60 ? C.warning : C.info;
  const lastSeen = device.last_seen || device.updated_at;

  const scale = useRef(new Animated.Value(1)).current;
  const onIn  = () => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 40, bounciness: 0 }).start();
  const onOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 20, bounciness: 6 }).start();

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={onIn}
      onPressOut={onOut}
      activeOpacity={1}
    >
      <Animated.View style={[dc.card, { transform: [{ scale }] }]}>
        {/* Left colored bar */}
        <View style={[dc.sideBar, { backgroundColor: cfg.color }]} />

        <View style={dc.body}>
          {/* Top row */}
          <View style={dc.topRow}>
            <View style={dc.topLeft}>
              <StatusDot status={device.monitoring_status} />
              <Text style={dc.ip}>{device.ip_address}</Text>
            </View>
            <View style={[dc.statusBadge, { backgroundColor: `${cfg.color}18`, borderColor: `${cfg.color}44` }]}>
              <Text style={[dc.statusText, { color: cfg.color }]}>
                {device.monitoring_status || 'Unknown'}
              </Text>
            </View>
          </View>

          {/* Hostname / sys_name */}
          <Text style={dc.hostname} numberOfLines={1}>
            {device.hostname || device.sys_name || 'Unnamed device'}
          </Text>
          {device.sys_name && device.hostname && device.sys_name !== device.hostname && (
            <Text style={dc.sysname} numberOfLines={1}>{device.sys_name}</Text>
          )}

          {/* Metric bars */}
          {(cpu != null || memPct != null) && (
            <View style={dc.bars}>
              {cpu != null && <MiniBar value={cpu} color={cpuColor} label="CPU" />}
              {memPct != null && <MiniBar value={memPct} color={memColor} label="MEM" />}
            </View>
          )}

          {/* Footer */}
          <View style={dc.footer}>
            <View style={dc.footerItem}>
              <Clock color={C.textDim} size={10} strokeWidth={2} />
              <Text style={dc.footerText}>{relTime(lastSeen)}</Text>
            </View>
            {device.latency != null && (
              <View style={dc.footerItem}>
                <Cpu color={C.textDim} size={10} strokeWidth={2} />
                <Text style={dc.footerText}>{device.latency}ms</Text>
              </View>
            )}
            {device.sys_location && (
              <Text style={dc.location} numberOfLines={1}>{device.sys_location}</Text>
            )}
          </View>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
};
const dc = themed(() => ({
  card: {
    flexDirection: 'row',
    backgroundColor: C.card,
    borderRadius: R.lg,
    borderWidth: 1, borderColor: C.border,
    overflow: 'hidden',
    ...elevation(1),
  },
  sideBar: { width: 4, flexShrink: 0 },
  body:    { flex: 1, padding: S.lg },

  topRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  topLeft: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  ip:      { fontSize: 15, fontWeight: '800', color: C.text },

  statusBadge: {
    paddingHorizontal: S.sm, paddingVertical: 2,
    borderRadius: R.sm, borderWidth: 1,
  },
  statusText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },

  hostname: { fontSize: 13, color: C.textSub, fontWeight: '500', marginBottom: 2 },
  sysname:  { fontSize: 11, color: C.textMuted, marginBottom: S.sm },

  bars:   { gap: 6, marginTop: S.sm, marginBottom: S.sm },

  footer:     { flexDirection: 'row', alignItems: 'center', gap: S.md, marginTop: S.xs },
  footerItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  footerText: { fontSize: 10, color: C.textDim },
  location:   { flex: 1, fontSize: 10, color: C.textDim, textAlign: 'right' },
}));

// ─── Section group header ─────────────────────────────────────────────────────
const GroupHeader = ({ status, count }) => {
  const cfg = STATUS_CONFIG[status] || { color: C.textMuted };
  return (
    <View style={gh.row}>
      <View style={[gh.bar, { backgroundColor: cfg.color }]} />
      <Text style={[gh.title, { color: cfg.color }]}>{status}</Text>
      <View style={[gh.badge, { backgroundColor: `${cfg.color}18`, borderColor: `${cfg.color}44` }]}>
        <Text style={[gh.count, { color: cfg.color }]}>{count}</Text>
      </View>
    </View>
  );
};
const gh = themed(() => ({
  row:   { flexDirection: 'row', alignItems: 'center', gap: S.sm, marginTop: S.lg, marginBottom: S.sm },
  bar:   { width: 3, height: 14, borderRadius: R.full },
  title: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: R.sm, borderWidth: 1 },
  count: { fontSize: 11, fontWeight: '800' },
}));

// ─── Screen ───────────────────────────────────────────────────────────────────
const DevicesScreen = () => {
  const navigation = useNavigation();
  const insets     = useSafeAreaInsets();

  const [devices,      setDevices]      = useState([]);
  const [isLoading,    setIsLoading]    = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error,        setError]        = useState('');
  const [query,        setQuery]        = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [cachedAt,     setCachedAt]     = useState(null);   // set when data.fromCache

  const fetchDevices = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    setError('');
    try {
      const data = await getDevices();
      setDevices(data.assets || []);
      setCachedAt(data.fromCache ? data.cachedAt : null);
    } catch (err) {
      setError(err.message || 'Failed to load devices.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDevices();
    const t = setInterval(() => fetchDevices(), POLL_INTERVAL);
    return () => clearInterval(t);
  }, [fetchDevices]);

  const counts = useMemo(() => {
    const c = { All: devices.length };
    devices.forEach((d) => {
      const s = d.monitoring_status;
      if (s) c[s] = (c[s] || 0) + 1;
    });
    return c;
  }, [devices]);

  const filteredGroups = useMemo(() => {
    let list = activeFilter === 'All' ? devices : devices.filter((d) => d.monitoring_status === activeFilter);
    const q  = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (d) =>
          (d.ip_address    || '').toLowerCase().includes(q) ||
          (d.sys_name      || '').toLowerCase().includes(q) ||
          (d.hostname      || '').toLowerCase().includes(q) ||
          (d.sys_location  || '').toLowerCase().includes(q),
      );
    }

    if (activeFilter !== 'All') {
      return [{ status: activeFilter, data: list }];
    }

    // Group by status: Online first, then Warning, then Offline, then others
    const order = ['Online', 'Warning', 'Offline'];
    const grouped = {};
    list.forEach((d) => {
      const s = d.monitoring_status || 'Unknown';
      if (!grouped[s]) grouped[s] = [];
      grouped[s].push(d);
    });
    return order
      .filter((s) => grouped[s]?.length > 0)
      .map((s) => ({ status: s, data: grouped[s] }))
      .concat(
        Object.keys(grouped)
          .filter((s) => !order.includes(s) && grouped[s].length > 0)
          .map((s) => ({ status: s, data: grouped[s] })),
      );
  }, [devices, activeFilter, query]);

  // Flatten groups into FlatList-friendly items with type markers
  const flatData = useMemo(() => {
    const items = [];
    filteredGroups.forEach(({ status, data }) => {
      items.push({ type: 'header', status, count: data.length, id: `h_${status}` });
      data.forEach((d) => items.push({ type: 'device', device: d, id: String(d.id) }));
    });
    return items;
  }, [filteredGroups]);

  const handleDevicePress = useCallback(
    (device) => navigation.navigate('DeviceDetail', { deviceId: device.id, deviceIp: device.ip_address }),
    [navigation],
  );

  const renderItem = useCallback(({ item }) => {
    if (item.type === 'header') {
      return <GroupHeader status={item.status} count={item.count} />;
    }
    return <DeviceCard device={item.device} onPress={() => handleDevicePress(item.device)} />;
  }, [handleDevicePress]);

  const keyExtractor = useCallback((item) => item.id, []);

  const ListEmpty = () => (
    isLoading ? null : (
      <View style={styles.emptyState}>
        <Server color={C.textDim} size={48} strokeWidth={1.1} />
        <Text style={styles.emptyTitle}>No devices found</Text>
        <Text style={styles.emptySub}>
          {query ? 'Try a different search term.' : 'No devices match the selected filter.'}
        </Text>
      </View>
    )
  );

  const totalFiltered = flatData.filter((i) => i.type === 'device').length;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar style="auto" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Devices</Text>
        <Text style={styles.headerSub}>
          {isLoading ? 'Loading…' : `${totalFiltered} of ${devices.length} monitored`}
        </Text>
      </View>

      {/* ── Search ── */}
      <View style={styles.searchWrapper}>
        <Search color={C.textMuted} size={16} strokeWidth={2} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search by IP, hostname, location…"
          placeholderTextColor={C.textDim}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {!!query && (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <View style={styles.clearBtn}>
              <X color={C.textMuted} size={12} strokeWidth={2.5} />
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Filter tabs ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabScroll}
        contentContainerStyle={styles.tabRow}
      >
        {FILTER_TABS.map(({ key, label, color }, i) => {
          const active = activeFilter === key;
          const count  = counts[key] ?? 0;
          return (
            <TouchableOpacity
              key={key}
              style={[
                styles.tab,
                { marginRight: i === FILTER_TABS.length - 1 ? S.lg : S.sm },
                active && { backgroundColor: `${color}20`, borderColor: color },
              ]}
              onPress={() => setActiveFilter(key)}
              activeOpacity={0.7}
            >
              {active && <View style={[styles.tabDot, { backgroundColor: color }]} />}
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

      {!!cachedAt && <StaleBanner cachedAt={cachedAt} />}

      {/* ── List ── */}
      {isLoading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={C.primary} />
          <Text style={styles.loadingText}>Loading devices…</Text>
        </View>
      ) : (
        <FlatList
          data={flatData}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + S.xxxxl },
          ]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={ListEmpty}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => fetchDevices(true)}
              tintColor={C.primary}
              colors={[C.primary]}
            />
          }
          ItemSeparatorComponent={({ leadingItem }) =>
            leadingItem?.type === 'header' ? null : <View style={{ height: S.sm }} />
          }
          getItemLayout={undefined}
          removeClippedSubviews
        />
      )}
    </View>
  );
};

const styles = themed(() => ({
  root: { flex: 1, backgroundColor: C.bg },

  header: {
    paddingHorizontal: S.xl,
    paddingTop: S.lg,
    paddingBottom: S.md,
    backgroundColor: CHROME.bg,
    borderBottomWidth: 1, borderBottomColor: CHROME.border,
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: CHROME.text },
  headerSub:   { fontSize: 11, color: CHROME.textMuted, marginTop: 2 },

  searchWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.surface,
    marginHorizontal: S.lg, marginTop: S.lg,
    borderRadius: R.lg, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: S.md, paddingVertical: S.md,
    gap: S.sm,
  },
  searchInput: { flex: 1, color: C.text, fontSize: 14 },
  clearBtn: {
    width: 20, height: 20, borderRadius: R.full,
    backgroundColor: C.cardAlt, alignItems: 'center', justifyContent: 'center',
  },

  tabScroll:     { flexGrow: 0, flexShrink: 0 },
  tabRow:        { flexDirection: 'row', paddingLeft: S.lg, paddingVertical: S.sm },
  tab: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: S.md, paddingVertical: S.xs + 2,
    borderRadius: R.full, borderWidth: 1, borderColor: C.border,
    gap: 5, flexShrink: 0,
  },
  tabDot:       { width: 5, height: 5, borderRadius: R.full },
  tabLabel:     { fontSize: 12, color: C.textMuted, fontWeight: '600' },
  tabBadge:     { borderRadius: R.full, paddingHorizontal: 6, paddingVertical: 1 },
  tabBadgeText: { fontSize: 10, fontWeight: '700' },

  errorBanner: {
    backgroundColor: C.offlineBg, marginHorizontal: S.lg, marginTop: S.sm,
    borderRadius: R.md, padding: S.md,
    borderLeftWidth: 3, borderLeftColor: C.offline,
  },
  errorText: { color: DANGER_TEXT, fontSize: 13 },

  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: S.md },
  loadingText:  { color: C.textMuted, fontSize: 14 },

  listContent: { paddingHorizontal: S.lg, paddingTop: S.xs },

  emptyState: { paddingTop: 80, alignItems: 'center', gap: S.sm },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: C.textMuted, marginTop: S.sm },
  emptySub:   { fontSize: 13, color: C.textDim, textAlign: 'center', paddingHorizontal: S.xxxl },
}));

export default DevicesScreen;
