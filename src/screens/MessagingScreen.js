import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  RefreshControl, StyleSheet, ActivityIndicator, Modal,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  MessageCircle, Search, X, Plus, User, Users,
  CheckCheck, Clock, Edit3,
} from 'lucide-react-native';
import {
  getConversations, getMessageUsersList, markMessageRead,
} from '../services/api';
import { useAuth } from '../context/AuthContext';
import FadeIn from '../components/FadeIn';
import { themed, C, R, S, cardShadow, CHROME, DANGER_TEXT } from '../theme';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const initials = (name) => {
  if (!name) return '?';
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
};

const relTime = (ts) => {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const avatarColor = (name) => {
  const colors = [C.primary, C.online, C.warning, C.purple, '#06b6d4', '#f472b6'];
  if (!name) return colors[0];
  const idx = name.charCodeAt(0) % colors.length;
  return colors[idx];
};

// ─── Avatar ───────────────────────────────────────────────────────────────────
const Avatar = ({ name, size = 44, online }) => {
  const color = avatarColor(name);
  return (
    <View style={[av.wrap, { width: size, height: size, borderRadius: size / 2, borderColor: `${color}44` }]}>
      <View style={[av.inner, { backgroundColor: `${color}22`, borderRadius: size / 2 }]}>
        <Text style={[av.text, { color, fontSize: size * 0.36 }]}>{initials(name)}</Text>
      </View>
      {online && <View style={av.onlineDot} />}
    </View>
  );
};
const av = themed(() => ({
  wrap:      { borderWidth: 1.5, overflow: 'visible', flexShrink: 0, position: 'relative' },
  inner:     { flex: 1, alignItems: 'center', justifyContent: 'center' },
  text:      { fontWeight: '800' },
  onlineDot: {
    position: 'absolute', bottom: 1, right: 1,
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: C.online, borderWidth: 2, borderColor: C.surface,
  },
}));

// ─── Conversation row ─────────────────────────────────────────────────────────
const ConvRow = ({ item, currentUserId, onPress }) => {
  const isFromMe = item.sender_id === currentUserId;
  const unread = !item.is_read && !isFromMe;
  const displayName = item.full_name || item.username || 'Unknown';

  return (
    <TouchableOpacity style={[styles.convRow, unread && styles.convRowUnread]} onPress={onPress} activeOpacity={0.7}>
      <Avatar name={displayName} size={46} online={item.is_online} />

      <View style={styles.convBody}>
        <View style={styles.convTop}>
          <Text style={[styles.convName, unread && styles.convNameUnread]} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={[styles.convTime, unread && { color: C.primary }]}>
            {relTime(item.last_message_time)}
          </Text>
        </View>

        <View style={styles.convBottom}>
          {isFromMe && (
            <CheckCheck color={C.textDim} size={12} strokeWidth={2} style={{ marginRight: 3 }} />
          )}
          <Text
            style={[styles.convPreview, unread && styles.convPreviewUnread]}
            numberOfLines={1}
          >
            {item.subject ? `[${item.subject}] ` : ''}{item.last_message || '…'}
          </Text>
          {unread && <View style={styles.unreadDot} />}
        </View>
      </View>
    </TouchableOpacity>
  );
};

// ─── New Chat Modal ───────────────────────────────────────────────────────────
const NewChatModal = ({ visible, onClose, onSelect }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    getMessageUsersList()
      .then(setUsers)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [visible]);

  const filtered = useMemo(() => {
    if (!q.trim()) return users;
    const lq = q.toLowerCase();
    return users.filter(
      (u) =>
        (u.full_name || '').toLowerCase().includes(lq) ||
        (u.username || '').toLowerCase().includes(lq),
    );
  }, [users, q]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={modal.overlay}>
        <View style={modal.sheet}>
          {/* Handle */}
          <View style={modal.handle} />

          <View style={modal.header}>
            <Text style={modal.title}>New Message</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X color={C.textMuted} size={20} />
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={modal.searchBox}>
            <Search color={C.textDim} size={14} />
            <TextInput
              style={modal.searchInput}
              value={q}
              onChangeText={setQ}
              placeholder="Search people…"
              placeholderTextColor={C.textDim}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {!!q && (
              <TouchableOpacity onPress={() => setQ('')}>
                <X color={C.textDim} size={14} />
              </TouchableOpacity>
            )}
          </View>

          {loading ? (
            <ActivityIndicator color={C.primary} style={{ marginTop: 40 }} />
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              {filtered.map((u) => (
                <TouchableOpacity
                  key={u.id}
                  style={modal.userRow}
                  onPress={() => { onSelect(u); onClose(); setQ(''); }}
                  activeOpacity={0.7}
                >
                  <Avatar name={u.full_name || u.username} size={40} />
                  <View style={{ flex: 1 }}>
                    <Text style={modal.userName}>{u.full_name || u.username}</Text>
                    <Text style={modal.userRole}>{u.role || u.username}</Text>
                  </View>
                  <MessageCircle color={C.primary} size={16} strokeWidth={2} />
                </TouchableOpacity>
              ))}
              {filtered.length === 0 && (
                <Text style={modal.emptyText}>No users found.</Text>
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

const modal = themed(() => ({
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: C.surface,
    borderTopLeftRadius: R.xxl, borderTopRightRadius: R.xxl,
    paddingHorizontal: S.lg, paddingBottom: S.xxxl,
    maxHeight: '80%',
    borderTopWidth: 1, borderColor: C.border,
  },
  handle: {
    width: 38, height: 4, borderRadius: 2,
    backgroundColor: C.border, alignSelf: 'center',
    marginTop: S.md, marginBottom: S.lg,
  },
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: S.lg },
  title:       { fontSize: 18, fontWeight: '800', color: C.text },
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: R.md, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: S.md, paddingVertical: S.sm,
    gap: S.sm, marginBottom: S.lg,
  },
  searchInput: { flex: 1, color: C.text, fontSize: 14 },
  userRow: {
    flexDirection: 'row', alignItems: 'center', gap: S.md,
    paddingVertical: S.md,
    borderBottomWidth: 1, borderBottomColor: C.borderFaint,
  },
  userName:  { fontSize: 15, fontWeight: '600', color: C.text },
  userRole:  { fontSize: 11, color: C.textMuted, marginTop: 1 },
  emptyText: { textAlign: 'center', color: C.textDim, marginTop: 40, fontSize: 14 },
}));

// ─── Screen ───────────────────────────────────────────────────────────────────
const MessagingScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [conversations, setConversations]  = useState([]);
  const [isLoading,     setIsLoading]      = useState(true);
  const [isRefreshing,  setIsRefreshing]   = useState(false);
  const [error,         setError]          = useState('');
  const [query,         setQuery]          = useState('');
  const [newChatOpen,   setNewChatOpen]    = useState(false);

  const fetchConversations = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    setError('');
    try {
      const data = await getConversations();
      setConversations(data);
    } catch (err) {
      setError(err.message || 'Failed to load messages.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
    const t = setInterval(() => fetchConversations(), 15000);
    return () => clearInterval(t);
  }, [fetchConversations]);

  const filtered = useMemo(() => {
    if (!query.trim()) return conversations;
    const lq = query.toLowerCase();
    return conversations.filter(
      (c) =>
        (c.full_name || '').toLowerCase().includes(lq) ||
        (c.username || '').toLowerCase().includes(lq) ||
        (c.last_message || '').toLowerCase().includes(lq),
    );
  }, [conversations, query]);

  const unreadCount = useMemo(
    () => conversations.filter((c) => !c.is_read && c.sender_id !== user?.id).length,
    [conversations, user],
  );

  const openChat = useCallback(
    (userId, userName) => {
      navigation.navigate('Chat', { userId, userName });
    },
    [navigation],
  );

  const renderItem = useCallback(
    ({ item }) => (
      <ConvRow
        item={item}
        currentUserId={user?.id}
        onPress={() => openChat(item.user_id, item.full_name || item.username)}
      />
    ),
    [user, openChat],
  );

  const keyExtractor = useCallback((item) => String(item.user_id || item.id), []);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar style="auto" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Messages</Text>
          {unreadCount > 0 && (
            <Text style={styles.headerSub}>{unreadCount} unread</Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.composeBtn}
          onPress={() => setNewChatOpen(true)}
          activeOpacity={0.7}
        >
          <Edit3 color={C.primary} size={17} strokeWidth={2} />
          <Text style={styles.composeBtnText}>New</Text>
        </TouchableOpacity>
      </View>

      {/* ── Search ── */}
      <View style={styles.searchWrapper}>
        <Search color={C.textDim} size={16} strokeWidth={2} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search conversations…"
          placeholderTextColor={C.textDim}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {!!query && (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <X color={C.textDim} size={16} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Error ── */}
      {!!error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* ── List ── */}
      {isLoading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={C.primary} />
          <Text style={styles.loadingText}>Loading messages…</Text>
        </View>
      ) : (
        <FadeIn style={{ flex: 1 }}>
        <FlatList
          data={filtered}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => fetchConversations(true)}
              tintColor={C.primary}
              colors={[C.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MessageCircle color={C.textDim} size={44} strokeWidth={1.2} />
              <Text style={styles.emptyTitle}>No conversations</Text>
              <Text style={styles.emptySub}>
                {query ? 'No results for your search.' : 'Start a new conversation with the button above.'}
              </Text>
            </View>
          }
        />
        </FadeIn>
      )}

      {/* ── New chat modal ── */}
      <NewChatModal
        visible={newChatOpen}
        onClose={() => setNewChatOpen(false)}
        onSelect={(u) => openChat(u.id, u.full_name || u.username)}
      />
    </View>
  );
};

const styles = themed(() => ({
  root: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: S.xl, paddingTop: S.lg, paddingBottom: S.md,
    backgroundColor: CHROME.bg,
    borderBottomWidth: 1, borderBottomColor: CHROME.border,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: CHROME.text },
  headerSub:   { fontSize: 11, color: C.primary, marginTop: 2, fontWeight: '500' },

  composeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: S.xs,
    paddingHorizontal: S.md, paddingVertical: S.xs + 2,
    backgroundColor: C.primaryBg,
    borderRadius: R.sm, borderWidth: 1, borderColor: `${C.primary}55`,
  },
  composeBtnText: { color: C.primary, fontSize: 13, fontWeight: '600' },

  searchWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.surface,
    marginHorizontal: S.lg, marginTop: S.lg,
    borderRadius: R.md, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: S.md, paddingVertical: S.md,
    gap: S.sm,
  },
  searchInput: { flex: 1, color: C.text, fontSize: 14 },

  errorBanner: {
    backgroundColor: C.offlineBg,
    marginHorizontal: S.lg, marginTop: S.sm,
    borderRadius: R.sm, padding: S.md,
    borderLeftWidth: 3, borderLeftColor: C.offline,
  },
  errorText: { color: DANGER_TEXT, fontSize: 13 },

  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: S.md },
  loadingText:  { color: C.textDim, fontSize: 14 },

  listContent: { paddingTop: S.sm, paddingBottom: S.xxl },

  convRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: S.lg, paddingVertical: S.md,
    gap: S.md,
    borderBottomWidth: 1, borderBottomColor: C.borderFaint,
  },
  convRowUnread: { backgroundColor: `${C.primary}08` },

  convBody: { flex: 1 },
  convTop:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },

  convName:        { fontSize: 15, fontWeight: '600', color: C.text, flex: 1, marginRight: S.sm },
  convNameUnread:  { fontWeight: '800', color: C.text },
  convTime:        { fontSize: 11, color: C.textDim, flexShrink: 0 },

  convBottom:       { flexDirection: 'row', alignItems: 'center' },
  convPreview:      { flex: 1, fontSize: 13, color: C.textMuted, lineHeight: 18 },
  convPreviewUnread:{ color: C.text, fontWeight: '500' },
  unreadDot:        {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: C.primary, marginLeft: S.xs, flexShrink: 0,
  },

  emptyState: { paddingTop: 80, alignItems: 'center', gap: S.sm },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: C.textMuted },
  emptySub:   { fontSize: 13, color: C.textDim, textAlign: 'center', paddingHorizontal: S.xxxl },
}));

export default MessagingScreen;
