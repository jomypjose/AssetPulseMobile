import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, ScrollView, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  ChevronLeft, ChevronRight, Search as SearchIcon, X,
  Cpu, MonitorSmartphone, Network, Armchair,
} from 'lucide-react-native';
import { getBranchAssets } from '../services/api';
import { themed, C, R, S, CHROME, cardShadow, STATUS_COLOR } from '../theme';

const KIND_LABELS = {
  hardware: 'Hardware',
  software: 'Software',
  network:  'Network devices',
  fixed:    'Fixed assets',
};

const KIND_ICON = {
  hardware: Cpu,
  software: MonitorSmartphone,
  network:  Network,
  fixed:    Armchair,
};

// Per-kind filter chips
const HARDWARE_FILTERS = [
  { key: 'all',         label: 'All',         test: () => true },
  { key: 'assigned',    label: 'Assigned',    test: (a) => !!a.emp_name },
  { key: 'unassigned',  label: 'Unassigned',  test: (a) => !a.emp_name },
  { key: 'allocated',   label: 'Allocated',   test: (a) => /allocat/i.test(a.asset_status || '') },
  { key: 'ready',       label: 'Ready',       test: (a) => /ready/i.test(a.asset_status || '') },
  { key: 'damaged',     label: 'Damaged',     test: (a) => /damag/i.test(a.asset_status || '') },
];

const FILTERS = {
  // Fixed assets are the same record shape as hardware (same table, different
  // asset-type category), so they share its filters.
  fixed: HARDWARE_FILTERS,
  hardware: HARDWARE_FILTERS,
  software: [
    { key: 'all',         label: 'All',         test: () => true },
    { key: 'assigned',    label: 'Assigned',    test: (a) => !!a.emp_name },
    { key: 'unassigned',  label: 'Unassigned',  test: (a) => !a.emp_name },
    { key: 'expired',     label: 'Expired',     test: (a) => a.expiry_date && new Date(a.expiry_date) < new Date() },
    { key: 'expiring',    label: 'Expiring 30d', test: (a) => {
        if (!a.expiry_date) return false;
        const d = (new Date(a.expiry_date) - Date.now()) / 86400000;
        return d >= 0 && d <= 30;
      } },
  ],
  network: [
    { key: 'all',     label: 'All',     test: () => true },
    { key: 'online',  label: 'Online',  test: (a) => a.monitoring_status === 'Online' },
    { key: 'offline', label: 'Offline', test: (a) => a.monitoring_status === 'Offline' },
    { key: 'warning', label: 'Warning', test: (a) => a.monitoring_status === 'Warning' },
  ],
};

const matchAsset = (kind, a, q) => {
  const fields = (kind === 'hardware' || kind === 'fixed')
    ? [a.item_id, a.brand_name, a.model_name, a.serial_number, a.asset_type, a.emp_name, a.emp_code, a.department, a.asset_status]
    : kind === 'software'
      ? [a.software_name, a.item_id, a.subscription_type, a.emp_name, a.emp_code, a.license_key]
      : [a.item_id, a.vendor, a.model, a.serial_number, a.asset_type, a.category, a.ip_address, a.monitoring_status];
  return fields.filter(Boolean).some((s) => String(s).toLowerCase().includes(q));
};

// Left-accent colour per row, reflecting each kind's real-world "health":
// network devices use live monitoring status, hardware uses asset status,
// software uses how close it is to expiring.
const rowAccent = (kind, a) => {
  if (kind === 'network') return STATUS_COLOR[a.monitoring_status] || C.border;
  if (kind === 'hardware' || kind === 'fixed') {
    const s = (a.asset_status || '').toLowerCase();
    if (/damag|lost|retir/.test(s)) return C.offline;
    if (/ready|stock|available/.test(s)) return C.online;
    if (/allocat|assign|active/.test(s)) return C.info;
    return C.border;
  }
  if (a.expiry_date) {
    const days = (new Date(a.expiry_date) - Date.now()) / 86400000;
    if (days < 0) return C.offline;
    if (days <= 30) return C.warning;
  }
  return C.border;
};

const Row = ({ a, kind, navigation }) => {
  let title    = '';
  let subParts = [];
  let assignee = null;

  if (kind === 'hardware' || kind === 'fixed') {
    title = a.item_id || [a.brand_name, a.model_name].filter(Boolean).join(' ') || a.serial_number || `Asset #${a.id}`;
    subParts = [
      a.asset_type,
      [a.brand_name, a.model_name].filter(Boolean).join(' '),
      a.serial_number && `SN ${a.serial_number}`,
      a.asset_status,
    ];
    assignee = a.emp_name
      ? `${a.emp_name}${a.emp_code ? ` · ${a.emp_code}` : ''}${a.department ? ` · ${a.department}` : ''}`
      : null;
  } else if (kind === 'software') {
    title = a.software_name || a.item_id || `Software #${a.id}`;
    subParts = [
      a.subscription_type,
      a.expiry_date && `Expires ${String(a.expiry_date).slice(0, 10)}`,
    ];
    assignee = a.emp_name
      ? `${a.emp_name}${a.emp_code ? ` · ${a.emp_code}` : ''}`
      : null;
  } else {
    title = a.item_id || [a.vendor, a.model].filter(Boolean).join(' ') || a.serial_number || `Device #${a.id}`;
    subParts = [
      a.category || a.asset_type,
      [a.vendor, a.model].filter(Boolean).join(' '),
      a.serial_number && `SN ${a.serial_number}`,
      a.ip_address,
      a.monitoring_status,
    ];
  }

  const sub = subParts.filter(Boolean).join(' · ');
  const accent = rowAccent(kind, a);
  const Icon = KIND_ICON[kind] || Cpu;
  const tappable = (kind === 'network' && !!a.ip_address) || (kind !== 'network' && !!a.id);

  return (
    <TouchableOpacity
      style={[styles.row, { borderLeftColor: accent }]}
      activeOpacity={tappable ? 0.8 : 1}
      disabled={!tappable}
      onPress={() => {
        if (kind === 'network' && a.ip_address) {
          navigation.navigate('DeviceDetail', { deviceId: a.id, deviceIp: a.ip_address });
        } else if (a.id) {
          navigation.navigate('AssetDetail', { assetId: a.id, kind, initialAsset: a });
        }
      }}
    >
      <View style={[styles.rowIcon, { backgroundColor: `${accent}18` }]}>
        <Icon color={accent} size={16} strokeWidth={1.8} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>{title}</Text>
        {!!sub && <Text style={styles.rowSub} numberOfLines={2}>{sub}</Text>}
        {!!assignee && (
          <Text style={styles.rowAssignee} numberOfLines={1}>👤 {assignee}</Text>
        )}
      </View>
      {tappable && <ChevronRight color={C.textDim} size={14} />}
    </TouchableOpacity>
  );
};

const BranchAssetsListScreen = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  const { branch, kind, initialQuery } = route.params || {};
  const Icon = KIND_ICON[kind] || Cpu;
  const filters = FILTERS[kind] || FILTERS.hardware;

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState(initialQuery || '');
  const [filter, setFilter] = useState('all');

  const fetchAssets = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await getBranchAssets(branch.branch_code);
      setList(res?.[kind] || []);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [branch?.branch_code, kind]);

  useEffect(() => { if (branch?.branch_code) fetchAssets(); }, [fetchAssets, branch]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const fdef = filters.find((f) => f.key === filter) || filters[0];
    return list.filter((a) => {
      if (!fdef.test(a)) return false;
      if (!q) return true;
      return matchAsset(kind, a, q);
    });
  }, [list, query, filter, kind, filters]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar style="auto" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <ChevronLeft color={CHROME.text} size={22} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {KIND_LABELS[kind] || 'Assets'}
          </Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            {branch?.branch_code} · {branch?.branch_name}
          </Text>
        </View>
        <View style={styles.iconChip}>
          <Icon color={C.primary} size={16} />
        </View>
      </View>

      <View style={styles.searchWrap}>
        <View style={styles.searchBox}>
          <SearchIcon color={C.textDim} size={15} />
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            placeholder={`Search ${KIND_LABELS[kind]?.toLowerCase() || 'assets'}…`}
            placeholderTextColor={C.textDim}
          />
          {!!query && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <X color={C.textDim} size={15} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.filterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {filters.map((f) => (
            <TouchableOpacity
              key={f.key}
              style={[styles.chip, filter === f.key && styles.chipActive]}
              onPress={() => setFilter(f.key)}
              activeOpacity={0.8}
            >
              <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={C.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(a) => `${kind}-${a.id}`}
          renderItem={({ item }) => <Row a={item} kind={kind} navigation={navigation} />}
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: C.borderFaint }} />}
          contentContainerStyle={{ padding: S.lg, paddingBottom: insets.bottom + S.xxxxl }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => fetchAssets(true)} tintColor={C.primary} colors={[C.primary]} />
          }
          ListHeaderComponent={
            <Text style={styles.countLabel}>
              Showing {filtered.length} of {list.length}
            </Text>
          }
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.dim}>
                {list.length === 0 ? 'No assets in this category.' : 'No matches.'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = themed(() => ({
  root: { flex: 1, backgroundColor: C.bg },

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
    backgroundColor: CHROME.buttonBg, borderWidth: 1, borderColor: CHROME.buttonBorder,
    alignItems: 'center', justifyContent: 'center',
  },

  searchWrap: { padding: S.md, backgroundColor: C.bg },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: S.sm,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: R.full, paddingHorizontal: S.md, paddingVertical: 8,
  },
  input: { flex: 1, fontSize: 14, color: C.text, padding: 0 },

  filterRow: { paddingHorizontal: S.md, paddingBottom: S.sm, backgroundColor: C.bg },
  chip: {
    paddingHorizontal: S.md, paddingVertical: 6,
    borderRadius: R.full, borderWidth: 1, borderColor: C.border, backgroundColor: C.card,
  },
  chipActive:     { backgroundColor: C.primaryBg, borderColor: C.primary },
  chipText:       { fontSize: 12, color: C.textMuted, fontWeight: '600' },
  chipTextActive: { color: C.primary, fontWeight: '700' },

  countLabel: { fontSize: 11, color: C.textMuted, fontWeight: '600', marginBottom: S.sm, textTransform: 'uppercase', letterSpacing: 0.6 },

  centered: { padding: S.xxl, alignItems: 'center', justifyContent: 'center' },
  dim:      { color: C.textMuted, fontSize: 13 },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: S.sm,
    paddingVertical: 12, paddingHorizontal: S.md,
    backgroundColor: C.card,
    borderRadius: R.md, borderLeftWidth: 3, ...cardShadow,
    marginBottom: 4,
  },
  rowIcon: {
    width: 32, height: 32, borderRadius: R.sm,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  rowTitle:    { fontSize: 13, color: C.text, fontWeight: '700' },
  rowSub:      { fontSize: 11, color: C.textMuted, marginTop: 2 },
  rowAssignee: { fontSize: 12, color: C.primary, fontWeight: '600', marginTop: 3 },
}));

export default BranchAssetsListScreen;
