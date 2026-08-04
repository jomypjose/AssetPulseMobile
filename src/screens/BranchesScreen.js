import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  ChevronLeft, Search as SearchIcon, Building2, ChevronRight, X,
} from 'lucide-react-native';
import { getBranches } from '../services/api';
import { themed, C, R, S, cardShadow, CHROME } from '../theme';

const BranchesScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [branches, setBranches] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery]       = useState('');
  const [error, setError]       = useState('');

  const fetchAll = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setError('');
    try {
      const list = await getBranches();
      setBranches(Array.isArray(list) ? list : []);
    } catch (err) {
      setBranches([]);
      setError(err?.message || 'Could not load branches.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return branches;
    return branches.filter((b) =>
      [b.branch_code, b.branch_name, b.state, b.city, b.office_type]
        .filter(Boolean).some((s) => String(s).toLowerCase().includes(q))
    );
  }, [branches, query]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar style="auto" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <ChevronLeft color={CHROME.text} size={22} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Branches</Text>
          <Text style={styles.headerSub}>{branches.length} total</Text>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <View style={styles.searchBox}>
          <SearchIcon color={C.textDim} size={15} />
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            placeholder="Search by code, name, state…"
            placeholderTextColor={C.textDim}
          />
          {!!query && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <X color={C.textDim} size={15} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={C.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(b) => String(b.branch_code || b.id)}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('BranchDetail', { branch: item })}
            >
              <View style={styles.cardIcon}>
                <Building2 color={C.primary} size={18} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.branch_code} · {item.branch_name}
                </Text>
                <Text style={styles.cardSub} numberOfLines={1}>
                  {[item.city, item.state, item.office_type].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <ChevronRight color={C.textDim} size={16} />
            </TouchableOpacity>
          )}
          ItemSeparatorComponent={() => <View style={{ height: S.sm }} />}
          contentContainerStyle={{ padding: S.lg, paddingBottom: insets.bottom + S.xxxxl }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchAll(true)}
              tintColor={C.primary}
              colors={[C.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.centered}>
              {error ? (
                <>
                  <Text style={[styles.dim, { color: C.offline, marginBottom: S.xs }]}>
                    {error}
                  </Text>
                  <Text style={styles.dim}>Pull down to retry.</Text>
                </>
              ) : (
                <Text style={styles.dim}>No branches match your search.</Text>
              )}
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

  searchWrap: { padding: S.md, backgroundColor: C.bg },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: S.sm,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: R.full, paddingHorizontal: S.md, paddingVertical: 8,
  },
  input: { flex: 1, fontSize: 14, color: C.text, padding: 0 },

  centered: { padding: S.xxl, alignItems: 'center', justifyContent: 'center' },
  dim: { color: C.textMuted, fontSize: 13 },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: S.md,
    padding: S.md, backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: R.md, ...cardShadow,
  },
  cardIcon: {
    width: 38, height: 38, borderRadius: R.sm,
    backgroundColor: C.primaryBg, borderWidth: 1, borderColor: `${C.primary}33`,
    alignItems: 'center', justifyContent: 'center',
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: C.text },
  cardSub:   { fontSize: 12, color: C.textMuted, marginTop: 2 },
}));

export default BranchesScreen;
