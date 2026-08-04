import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, ScrollView, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  ChevronLeft, ChevronRight, Search as SearchIcon, X,
  Cpu, MonitorSmartphone, Network,
} from 'lucide-react-native';
import { getBranchAssets } from '../services/api';
import { themed, C, R, S, CHROME, cardShadow } from '../theme';

const KIND_LABELS = {
  hardware: 'Hardware',
  software: 'Software',
  network:  'Network devices',
};

const KIND_ICON = {
  hardware: Cpu,
  software: MonitorSmartphone,
  network:  Network,
};

// Per-kind filter chips
const FILTERS = {
  hardware: [
    { key: 'all',         label: 'All',         test: () => true },
    { key: 'assigned',    label: 'Assigned',    test: (a) => !!a.emp_name },
    { key: 'unassigned',  label: 'Unassigned',  test: (a) => !a.emp_name },
    { key: 'allocated',   label: 'Allocated',   test: (a) => /allocat/i.test(a.asset_status || '') },
    { key: 'ready',       label: 'Ready',       test: (a) => /ready/i.test(a.asset_status || '') },
    { key: 'damaged',     label: 'Damaged',     test: (a) => /damag/i.test(a.asset_status || '') },
  ],
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
  const fields = kind === 'hardware'
    ? [a.item_id, a.brand_name, a.model_name, a.serial_number, a.asset_type, a.emp_name, a.emp_code, a.department, a.asset_status]
    : kind === 'software'
      ? [a.software_name, a.item_id, a.subscription_type, a.emp_name, a.emp_code, a.license_key]
      : [a.item_id, a.vendor, a.model, a.serial_number, a.asset_type, a.category, a.ip_address, a.monitoring_status];
  return fields.filter(Boolean).some((s) => String(s).toLowerCase().includes(q));
};

const Row = ({ a, kind, navigation }) => {
  let title    = '';
  let subParts = [];
  let assignee = null;

  if (kind === 'hardware') {
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

  return (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.8}
      onPress={() => {
        if (kind === 'network' && a.ip_address) {
          navigation.navigate('DeviceDetail', { deviceId: a.id, deviceIp: a.ip_address });
        }
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>{title}</Text>
        {!!sub && <Text style={styles.rowSub} numberOfLines={2}>{sub}</Text>}
        {!!assignee && (
          <Text style={styles.rowAssignee} numberOfLines={1}>👤 {assignee}</Text>
        )}
      </View>
      <ChevronRight color={C.textDim} size={14} />
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
    borderRadius: R.md, ...cardShadow,
    marginBottom: 4,
  },
  rowTitle:    { fontSize: 13, color: C.text, fontWeight: '700' },
  rowSub:      { fontSize: 11, color: C.textMuted, marginTop: 2 },
  rowAssignee: { fontSize: 12, color: C.primary, fontWeight: '600', marginTop: 3 },
}));

export default BranchAssetsListScreen;
