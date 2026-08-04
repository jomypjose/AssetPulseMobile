import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  ChevronLeft, Building2, Cpu, MonitorSmartphone, Network,
  ChevronRight, Search as SearchIcon, X, ListPlus,
} from 'lucide-react-native';
import { getBranchAssets } from '../services/api';
import { themed, C, R, S, cardShadow, CHROME } from '../theme';

const SectionRow = ({ title, more, onMore }) => (
  <View style={styles.sectionRow}>
    <Text style={styles.sectionLabel}>{title}</Text>
    {!!more && (
      <TouchableOpacity onPress={onMore} activeOpacity={0.7} style={styles.moreBtn}>
        <ListPlus color={C.primary} size={12} strokeWidth={2.4} />
        <Text style={styles.moreText}>{more}</Text>
      </TouchableOpacity>
    )}
  </View>
);

const Stat = ({ Icon, label, value, color }) => (
  <View style={styles.statCol}>
    <Icon color={color} size={18} strokeWidth={2.2} />
    <Text style={[styles.statValue, { color }]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

/**
 * Renders a single asset row. Hardware, software, and network assets have
 * different field names on the server, so we normalise here:
 *   - hardware: item_id, brand_name, model_name, asset_type, emp_name
 *   - software: item_id, software_name, subscription_type, emp_name, expiry_date
 *   - network:  item_id, vendor, model, ip_address, asset_type, category
 */
const AssetRow = ({ a, kind, navigation }) => {
  let title    = '';
  let subParts = [];
  let assignee = null;   // dedicated line — only set if the asset is assigned

  if (kind === 'hardware') {
    title = a.item_id
      || [a.brand_name, a.model_name].filter(Boolean).join(' ')
      || a.serial_number
      || `Asset #${a.id}`;
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
    // network
    title = a.item_id
      || [a.vendor, a.model].filter(Boolean).join(' ')
      || a.serial_number
      || `Device #${a.id}`;
    subParts = [
      a.category || a.asset_type,
      [a.vendor, a.model].filter(Boolean).join(' '),
      a.serial_number && `SN ${a.serial_number}`,
      a.ip_address,
    ];
  }

  const sub = subParts.filter(Boolean).join(' · ');

  return (
    <TouchableOpacity
      style={styles.assetRow}
      activeOpacity={0.8}
      onPress={() => {
        if (kind === 'network' && a.ip_address) {
          navigation.navigate('DeviceDetail', { deviceId: a.id, deviceIp: a.ip_address });
        }
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.assetName} numberOfLines={1}>{title}</Text>
        {!!sub && (
          <Text style={styles.assetSub} numberOfLines={2}>{sub}</Text>
        )}
        {!!assignee && (
          <Text style={styles.assetAssignee} numberOfLines={1}>👤 {assignee}</Text>
        )}
      </View>
      <ChevronRight color={C.textDim} size={14} />
    </TouchableOpacity>
  );
};

const BranchDetailScreen = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  const { branch } = route.params || {};

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAssets = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await getBranchAssets(branch.branch_code);
      setData(res);
    } catch (err) {
      setData({ error: err.message });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [branch?.branch_code]);

  useEffect(() => { if (branch?.branch_code) fetchAssets(); }, [fetchAssets, branch]);

  const [query, setQuery] = useState('');

  const hardwareAll = data?.hardware || [];
  const softwareAll = data?.software || [];
  const networkAll  = data?.network  || [];

  const { hardware, software, network } = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return { hardware: hardwareAll, software: softwareAll, network: networkAll };
    const match = (fields) => fields.filter(Boolean)
      .some((s) => String(s).toLowerCase().includes(q));
    return {
      hardware: hardwareAll.filter((a) => match([
        a.item_id, a.brand_name, a.model_name, a.serial_number,
        a.asset_type, a.emp_name, a.emp_code, a.department, a.asset_status,
      ])),
      software: softwareAll.filter((a) => match([
        a.software_name, a.item_id, a.subscription_type,
        a.emp_name, a.emp_code, a.license_key,
      ])),
      network: networkAll.filter((a) => match([
        a.item_id, a.vendor, a.model, a.serial_number,
        a.asset_type, a.category, a.ip_address,
      ])),
    };
  }, [query, hardwareAll, softwareAll, networkAll]);

  const INLINE_LIMIT = 20;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar style="auto" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <ChevronLeft color={CHROME.text} size={22} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {branch?.branch_code || 'Branch'}
          </Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            {branch?.branch_name || ''}
          </Text>
        </View>
        <View style={styles.iconChip}>
          <Building2 color={C.primary} size={16} />
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={C.primary} size="large" />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ padding: S.lg, paddingBottom: insets.bottom + S.xxxxl }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => fetchAssets(true)} tintColor={C.primary} colors={[C.primary]} />
          }
        >
          {/* Stats */}
          <View style={styles.statsRow}>
            <Stat Icon={Cpu}                label="Hardware"  value={hardwareAll.length} color={C.primary} />
            <Stat Icon={MonitorSmartphone}  label="Software"  value={softwareAll.length} color={C.cyan} />
            <Stat Icon={Network}            label="Network"   value={networkAll.length}  color={C.online} />
          </View>

          {/* Search */}
          <View style={styles.searchBox}>
            <SearchIcon color={C.textDim} size={15} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Search assets…"
              placeholderTextColor={C.textDim}
            />
            {!!query && (
              <TouchableOpacity onPress={() => setQuery('')}>
                <X color={C.textDim} size={15} />
              </TouchableOpacity>
            )}
          </View>

          {/* Info card */}
          <Text style={styles.sectionLabel}>Branch info</Text>
          <View style={styles.infoCard}>
            <InfoRow label="Code"    value={branch?.branch_code} />
            <InfoRow label="Name"    value={branch?.branch_name} />
            <InfoRow label="City"    value={branch?.city} />
            <InfoRow label="State"   value={branch?.state} />
            <InfoRow label="Type"    value={branch?.office_type} />
            <InfoRow label="Contact" value={branch?.contact_no || branch?.phone} last />
          </View>

          {network.length > 0 && (
            <>
              <SectionRow
                title={`Network devices (${network.length})`}
                more={network.length > INLINE_LIMIT && `Show all ${network.length}`}
                onMore={() => navigation.navigate('BranchAssetsList', {
                  branch, kind: 'network', initialQuery: query,
                })}
              />
              <View style={styles.list}>
                {network.slice(0, INLINE_LIMIT).map((a) => (
                  <AssetRow key={`net-${a.id}`} a={a} kind="network" navigation={navigation} />
                ))}
              </View>
            </>
          )}

          {hardware.length > 0 && (
            <>
              <SectionRow
                title={`Hardware (${hardware.length})`}
                more={hardware.length > INLINE_LIMIT && `Show all ${hardware.length}`}
                onMore={() => navigation.navigate('BranchAssetsList', {
                  branch, kind: 'hardware', initialQuery: query,
                })}
              />
              <View style={styles.list}>
                {hardware.slice(0, INLINE_LIMIT).map((a) => (
                  <AssetRow key={`hw-${a.id}`} a={a} kind="hardware" navigation={navigation} />
                ))}
              </View>
            </>
          )}

          {software.length > 0 && (
            <>
              <SectionRow
                title={`Software (${software.length})`}
                more={software.length > INLINE_LIMIT && `Show all ${software.length}`}
                onMore={() => navigation.navigate('BranchAssetsList', {
                  branch, kind: 'software', initialQuery: query,
                })}
              />
              <View style={styles.list}>
                {software.slice(0, INLINE_LIMIT).map((a) => (
                  <AssetRow key={`sw-${a.id}`} a={a} kind="software" navigation={navigation} />
                ))}
              </View>
            </>
          )}

          {hardware.length === 0 && software.length === 0 && network.length === 0 && query && (
            <Text style={styles.dim}>No assets match "{query}".</Text>
          )}
        </ScrollView>
      )}
    </View>
  );
};

const InfoRow = ({ label, value, last }) => (
  <View style={[styles.infoRow, last && { borderBottomWidth: 0 }]}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value || '—'}</Text>
  </View>
);

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
    backgroundColor: C.primaryBg, borderWidth: 1, borderColor: `${C.primary}33`,
    alignItems: 'center', justifyContent: 'center',
  },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },

  statsRow: { flexDirection: 'row', marginBottom: S.lg, paddingVertical: S.sm },
  statCol:  { flex: 1, alignItems: 'center', gap: 4 },
  statValue:{ fontSize: 22, fontWeight: '800' },
  statLabel:{ fontSize: 10, color: C.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6 },

  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: S.sm,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: R.full, paddingHorizontal: S.md, paddingVertical: 8,
    marginBottom: S.lg,
  },
  searchInput: { flex: 1, fontSize: 14, color: C.text, padding: 0 },

  sectionRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: S.md, marginBottom: S.sm,
  },
  moreBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: S.sm, paddingVertical: 4,
    borderRadius: R.full, backgroundColor: C.primaryBg, borderWidth: 1, borderColor: `${C.primary}33`,
  },
  moreText: { fontSize: 11, color: C.primary, fontWeight: '700' },
  dim:      { color: C.textMuted, fontSize: 13, textAlign: 'center', marginTop: S.xl },

  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: C.textMuted,
    textTransform: 'uppercase', letterSpacing: 1.2,
    marginTop: S.md, marginBottom: S.sm,
  },

  infoCard: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: R.md, overflow: 'hidden', ...cardShadow,
  },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: S.md, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.borderFaint,
  },
  infoLabel: { fontSize: 12, color: C.textMuted, fontWeight: '600' },
  infoValue: { fontSize: 13, color: C.text, maxWidth: '60%', textAlign: 'right' },

  list: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: R.md, overflow: 'hidden', ...cardShadow,
  },
  assetRow: {
    flexDirection: 'row', alignItems: 'center', gap: S.sm,
    paddingHorizontal: S.md, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.borderFaint,
  },
  assetName:     { fontSize: 13, color: C.text, fontWeight: '600' },
  assetSub:      { fontSize: 11, color: C.textMuted, marginTop: 2 },
  assetAssignee: { fontSize: 12, color: C.primary, fontWeight: '600', marginTop: 3 },
}));

export default BranchDetailScreen;
