import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, ScrollView,
  RefreshControl, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  ChevronLeft, CalendarClock, Package, FileText, ShieldCheck,
} from 'lucide-react-native';
import { getExpiringLicenses, getAMCs } from '../services/api';
import { themed, C, R, S, cardShadow, CHROME } from '../theme';

const TABS = [
  { key: 'all',      label: 'All' },
  { key: 'license',  label: 'Licenses' },
  { key: 'amc',      label: 'AMC' },
];

const daysUntil = (iso) => {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / 86400000);
};

const sevForDays = (d) => {
  if (d == null) return { color: C.textMuted, bg: C.card };
  if (d <= 0)  return { color: C.offline, bg: C.offlineBg };
  if (d <= 7)  return { color: C.offline, bg: C.offlineBg };
  if (d <= 30) return { color: C.warning, bg: C.warningBg };
  return { color: C.online, bg: C.onlineBg };
};

const ExpiryCard = ({ item }) => {
  const days = daysUntil(item.expiry_date || item.end_date || item.warranty_expiry);
  const s = sevForDays(days);
  const Icon = item.kind === 'amc' ? ShieldCheck : item.kind === 'license' ? FileText : Package;
  return (
    <View style={[styles.card, { borderColor: `${s.color}40` }]}>
      <View style={[styles.iconBox, { backgroundColor: s.bg }]}>
        <Icon color={s.color} size={16} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>{item.subtitle || ''}</Text>
      </View>
      <View style={[styles.daysBadge, { backgroundColor: s.bg, borderColor: `${s.color}55` }]}>
        <Text style={[styles.daysText, { color: s.color }]}>
          {days == null ? '—' : days <= 0 ? 'EXPIRED' : `${days}d`}
        </Text>
        <Text style={[styles.dateText, { color: s.color }]}>
          {(item.expiry_date || item.end_date || item.warranty_expiry || '').slice(0, 10)}
        </Text>
      </View>
    </View>
  );
};

const ExpiryScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState('all');
  const [items, setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    const collected = [];

    // Licenses (returns Array<{ software_name, license_key, expiry_date, branch_code }>)
    try {
      const licenses = await getExpiringLicenses();
      (Array.isArray(licenses) ? licenses : []).forEach((l) => {
        collected.push({
          kind: 'license',
          title: l.software_name || l.title || 'License',
          subtitle: [l.branch_code, l.license_key && `Key ${String(l.license_key).slice(0, 8)}…`]
            .filter(Boolean).join(' · '),
          expiry_date: l.expiry_date,
        });
      });
    } catch { /* ignore */ }

    // AMC contracts (returns { data: [...] } typically)
    try {
      const amcRes = await getAMCs();
      const list = amcRes?.data || amcRes?.amcs || amcRes || [];
      (Array.isArray(list) ? list : []).forEach((a) => {
        collected.push({
          kind: 'amc',
          title: a.contract_name || a.title || a.amc_no || `AMC ${a.id}`,
          subtitle: [a.vendor_name, a.branch_code].filter(Boolean).join(' · '),
          expiry_date: a.end_date || a.expiry_date,
        });
      });
    } catch { /* ignore */ }

    // Sort by soonest expiry
    collected.sort((a, b) => {
      const da = new Date(a.expiry_date || 0).getTime();
      const db = new Date(b.expiry_date || 0).getTime();
      return da - db;
    });

    setItems(collected);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filtered = useMemo(() => {
    if (filter === 'all') return items;
    return items.filter((i) => i.kind === filter);
  }, [items, filter]);

  const summary = useMemo(() => {
    const counts = { expired: 0, soon: 0, thirty: 0 };
    items.forEach((i) => {
      const d = daysUntil(i.expiry_date);
      if (d == null) return;
      if (d <= 0) counts.expired++;
      else if (d <= 7) counts.soon++;
      else if (d <= 30) counts.thirty++;
    });
    return counts;
  }, [items]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar style="auto" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <ChevronLeft color={CHROME.text} size={22} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Expiry digest</Text>
          <Text style={styles.headerSub}>
            {summary.expired} expired · {summary.soon} ≤ 7d · {summary.thirty} ≤ 30d
          </Text>
        </View>
        <View style={styles.iconChip}>
          <CalendarClock color={C.primary} size={16} />
        </View>
      </View>

      <View style={styles.filterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {TABS.map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[styles.chip, filter === t.key && styles.chipActive]}
              onPress={() => setFilter(t.key)}
            >
              <Text style={[styles.chipText, filter === t.key && styles.chipTextActive]}>
                {t.label}
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
          keyExtractor={(item, i) => `${item.kind}-${i}-${item.title}`}
          renderItem={({ item }) => <ExpiryCard item={item} />}
          ItemSeparatorComponent={() => <View style={{ height: S.sm }} />}
          contentContainerStyle={{ padding: S.lg, paddingBottom: insets.bottom + S.xxxxl }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => fetchAll(true)} tintColor={C.primary} colors={[C.primary]} />
          }
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.dim}>Nothing expiring in the tracked window.</Text>
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
    backgroundColor: C.primaryBg, borderWidth: 1, borderColor: `${C.primary}33`,
    alignItems: 'center', justifyContent: 'center',
  },

  filterRow: { paddingHorizontal: S.md, paddingTop: S.md, paddingBottom: S.sm, backgroundColor: C.bg },
  chip: {
    paddingHorizontal: S.md, paddingVertical: 6,
    borderRadius: R.full, borderWidth: 1, borderColor: C.border, backgroundColor: C.card,
  },
  chipActive:     { backgroundColor: C.primaryBg, borderColor: C.primary },
  chipText:       { fontSize: 12, color: C.textMuted, fontWeight: '600' },
  chipTextActive: { color: C.primary, fontWeight: '700' },

  centered: { padding: S.xxl, alignItems: 'center', justifyContent: 'center' },
  dim:      { color: C.textMuted, fontSize: 13 },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: S.md,
    padding: S.md, backgroundColor: C.card, borderWidth: 1,
    borderRadius: R.md, ...cardShadow,
  },
  iconBox: { width: 36, height: 36, borderRadius: R.sm, alignItems: 'center', justifyContent: 'center' },
  title:   { fontSize: 14, fontWeight: '700', color: C.text },
  sub:     { fontSize: 11, color: C.textMuted, marginTop: 2 },

  daysBadge: {
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: S.sm, paddingVertical: 6,
    borderRadius: R.sm, borderWidth: 1,
    minWidth: 70,
  },
  daysText: { fontSize: 13, fontWeight: '800' },
  dateText: { fontSize: 9, fontWeight: '600', marginTop: 1 },
}));

export default ExpiryScreen;
