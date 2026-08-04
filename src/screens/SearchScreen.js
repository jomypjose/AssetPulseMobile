import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  ChevronLeft, Search as SearchIcon, X, Sparkles, ArrowRight,
} from 'lucide-react-native';
import { globalSearch } from '../services/api';
import { themed, C, R, S, cardShadow, elevation, CHROME } from '../theme';

const SUGGESTIONS = [
  'most rebooted devices',
  'expiring AMC',
  'expiring software licenses',
  'staff with multiple assets',
  'locked users',
  'depreciated assets',
];

const ResultCard = ({ item, onPress }) => {
  const title = item.title || item.name || item.item_id || item.username || item.id || 'Untitled';
  const sub   = item.subtitle || item.message ||
                [item.branch_code, item.asset_type, item.brand_name, item.model_name]
                  .filter(Boolean).join(' · ');

  // Server search results spread the underlying row as `details`. For assets,
  // surface the assignee as its own line.
  const d = item.details || item;
  const empName = d?.emp_name || item.emp_name;
  const empCode = d?.emp_code || item.emp_code;
  const dept    = d?.department || item.department;
  const assignee = empName
    ? `${empName}${empCode ? ` · ${empCode}` : ''}${dept ? ` · ${dept}` : ''}`
    : null;

  return (
    <TouchableOpacity style={styles.resultCard} activeOpacity={0.85} onPress={onPress}>
      <View style={{ flex: 1 }}>
        <Text style={styles.resultTitle} numberOfLines={1}>{title}</Text>
        {!!sub && <Text style={styles.resultSub} numberOfLines={2}>{sub}</Text>}
        {!!assignee && (
          <Text style={styles.resultAssignee} numberOfLines={1}>👤 {assignee}</Text>
        )}
      </View>
      <ArrowRight color={C.textDim} size={16} />
    </TouchableOpacity>
  );
};

const SearchScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [answer, setAnswer]   = useState('');
  const [error,  setError]    = useState('');
  const inputRef = useRef(null);

  const runSearch = useCallback(async (q) => {
    const term = (q ?? query).trim();
    if (!term) return;
    setLoading(true);
    setError('');
    setAnswer('');
    setResults([]);
    try {
      const data = await globalSearch(term);
      setAnswer(data?.answer || data?.summary || '');
      const list = data?.results || data?.assets || data?.data || [];
      setResults(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(err.message || 'Search failed.');
    } finally {
      setLoading(false);
    }
  }, [query]);

  const handleResultPress = (r) => {
    if (r?.ip_address || r?.category === 'network' || r?.kind === 'device') {
      navigation.navigate('DeviceDetail', { deviceId: r.id, deviceIp: r.ip_address });
    }
    // Other entity types — no destination yet, just keep displayed.
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.root, { paddingTop: insets.top }]}
    >
      <StatusBar style="auto" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <ChevronLeft color={CHROME.text} size={22} />
        </TouchableOpacity>
        <View style={styles.searchBox}>
          <SearchIcon color={C.textDim} size={16} />
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => runSearch()}
            placeholder="Ask anything — assets, alerts, staff…"
            placeholderTextColor={C.textDim}
            returnKeyType="search"
            autoFocus
          />
          {!!query && (
            <TouchableOpacity onPress={() => { setQuery(''); setResults([]); setAnswer(''); inputRef.current?.focus(); }}>
              <X color={C.textDim} size={16} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {!query && !results.length && !answer && (
        <View style={styles.suggestionsWrap}>
          <Text style={styles.label}>Try one of these</Text>
          {SUGGESTIONS.map((s) => (
            <TouchableOpacity
              key={s}
              style={styles.suggestionRow}
              onPress={() => { setQuery(s); runSearch(s); }}
              activeOpacity={0.7}
            >
              <Sparkles color={C.primary} size={14} />
              <Text style={styles.suggestionText}>{s}</Text>
              <ArrowRight color={C.textDim} size={14} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {loading && (
        <View style={styles.center}>
          <ActivityIndicator color={C.primary} size="large" />
        </View>
      )}

      {!loading && (answer || results.length > 0) && (
        <FlatList
          data={results}
          keyExtractor={(r, i) => String(r.id || r.asset_id || r.username || i)}
          renderItem={({ item }) => <ResultCard item={item} onPress={() => handleResultPress(item)} />}
          ListHeaderComponent={
            answer ? (
              <View style={styles.answerCard}>
                <View style={styles.answerHead}>
                  <Sparkles color={C.primary} size={14} />
                  <Text style={styles.answerLabel}>Answer</Text>
                </View>
                <Text style={styles.answerText}>{answer}</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            !answer ? <Text style={styles.noResults}>No matches.</Text> : null
          }
          ItemSeparatorComponent={() => <View style={{ height: S.sm }} />}
          contentContainerStyle={{ padding: S.lg, paddingBottom: insets.bottom + S.xxxxl }}
        />
      )}

      {!!error && (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </KeyboardAvoidingView>
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
  searchBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: S.sm,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: R.full, paddingHorizontal: S.md, paddingVertical: 8,
  },
  input: { flex: 1, fontSize: 14, color: C.text, padding: 0 },

  suggestionsWrap: { padding: S.lg, gap: S.xs },
  label: { fontSize: 11, color: C.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: S.xs },
  suggestionRow: {
    flexDirection: 'row', alignItems: 'center', gap: S.sm,
    paddingHorizontal: S.md, paddingVertical: S.md,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: R.md,
  },
  suggestionText: { flex: 1, fontSize: 13, color: C.text, fontWeight: '500' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  answerCard: {
    backgroundColor: C.primaryBg, borderWidth: 1, borderColor: `${C.primary}55`,
    borderRadius: R.lg, padding: S.lg, gap: S.sm, marginBottom: S.lg,
    ...elevation(1),
  },
  answerHead: { flexDirection: 'row', alignItems: 'center', gap: S.xs },
  answerLabel: { fontSize: 10, fontWeight: '700', color: C.primary, letterSpacing: 1.1, textTransform: 'uppercase' },
  answerText: { fontSize: 14, color: C.text, lineHeight: 20 },

  resultCard: {
    flexDirection: 'row', alignItems: 'center', gap: S.sm,
    padding: S.md, backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: R.md, ...cardShadow,
  },
  resultTitle:    { fontSize: 14, fontWeight: '700', color: C.text },
  resultSub:      { fontSize: 12, color: C.textMuted, marginTop: 2 },
  resultAssignee: { fontSize: 12, color: C.primary, fontWeight: '600', marginTop: 3 },

  noResults: { color: C.textMuted, textAlign: 'center', marginTop: S.xl, fontSize: 13 },

  errorCard: {
    margin: S.lg, padding: S.md, backgroundColor: C.offlineBg,
    borderRadius: R.md, borderLeftWidth: 3, borderLeftColor: C.offline,
  },
  errorText: { color: C.offline, fontSize: 13 },
}));

export default SearchScreen;
