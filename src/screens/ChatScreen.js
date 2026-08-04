import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, StyleSheet, ActivityIndicator,
  Modal, Image, Linking, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  ChevronLeft, Send, CheckCheck, Paperclip, Image as ImageIcon,
  Camera, FileText, X, File, Download, Eye,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import {
  getConversationMessages, sendDirectMessage,
  sendMessageWithAttachment, markMessageRead,
  getApiBaseUrl,
} from '../services/api';
import { useAuth } from '../context/AuthContext';
import { themed, C, R, S, cardShadow, CHROME } from '../theme';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const initials = (name) => {
  if (!name) return '?';
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
};

const avatarColor = (name) => {
  const palette = [C.primary, C.online, C.warning, C.purple, '#06b6d4', '#f472b6'];
  if (!name) return palette[0];
  return palette[name.charCodeAt(0) % palette.length];
};

const fmtTime = (ts) => {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: true });
};

const fmtDateLabel = (ts) => {
  if (!ts) return '';
  const d = new Date(ts);
  const today     = new Date();
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString())     return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
};

const fmtBytes = (b) => {
  if (!b) return '';
  if (b >= 1048576) return `${(b / 1048576).toFixed(1)} MB`;
  if (b >= 1024)    return `${(b / 1024).toFixed(0)} KB`;
  return `${b} B`;
};

// Build full URL for an attachment path stored in the DB
const attachmentUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  // Local device URIs (optimistic preview before server confirms)
  if (path.startsWith('file://') || path.startsWith('content://')) return path;
  // Server-relative path e.g. /uploads/attachments/file.jpg
  const base = getApiBaseUrl().replace(/\/api\/?$/, '');
  return `${base}/${path.replace(/^\//, '')}`;
};

const isImage = (type, name) => {
  if (type && type.startsWith('image/')) return true;
  if (name) {
    const ext = name.split('.').pop()?.toLowerCase();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
  }
  return false;
};

// ─── Date separator ───────────────────────────────────────────────────────────
const DateLabel = ({ label }) => (
  <View style={ds.wrap}>
    <View style={ds.line} />
    <Text style={ds.text}>{label}</Text>
    <View style={ds.line} />
  </View>
);
const ds = themed(() => ({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: S.sm, marginVertical: S.md, paddingHorizontal: S.lg },
  line: { flex: 1, height: 1, backgroundColor: C.borderFaint },
  text: { fontSize: 11, color: C.textDim, fontWeight: '600' },
}));

// ─── Attachment preview inside a bubble ──────────────────────────────────────
const BubbleAttachment = ({ msg, isMine, onImagePress }) => {
  const path = msg.attachment_path;
  const type = msg.attachment_type || '';
  const name = msg.attachment_name || 'attachment';
  const size = msg.attachment_size;
  const url  = attachmentUrl(path);
  if (!url) return null;

  if (isImage(type, name)) {
    return (
      <TouchableOpacity onPress={() => onImagePress(url)} activeOpacity={0.85}>
        <Image
          source={{ uri: url }}
          style={[att.img, isMine && att.imgMine]}
          resizeMode="cover"
        />
      </TouchableOpacity>
    );
  }

  // Document chip
  const ext = name.split('.').pop()?.toUpperCase() || 'FILE';
  return (
    <TouchableOpacity
      style={[att.docChip, isMine && att.docChipMine]}
      onPress={() => Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open file.'))}
      activeOpacity={0.75}
    >
      <View style={[att.docIcon, isMine && att.docIconMine]}>
        <FileText color={isMine ? C.primary : C.textMuted} size={18} strokeWidth={1.8} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[att.docName, isMine && att.docNameMine]} numberOfLines={1}>{name}</Text>
        <Text style={att.docMeta}>{ext}{size ? ` · ${fmtBytes(size)}` : ''}</Text>
      </View>
      <Download color={isMine ? `${C.primary}99` : C.textDim} size={14} strokeWidth={2} />
    </TouchableOpacity>
  );
};

const att = themed(() => ({
  img:         { width: 200, height: 150, borderRadius: R.md, marginBottom: S.xs },
  imgMine:     { borderRadius: R.md },
  docChip:     { flexDirection: 'row', alignItems: 'center', gap: S.sm, backgroundColor: C.surface, borderRadius: R.md, padding: S.sm, marginBottom: S.xs, borderWidth: 1, borderColor: C.border, maxWidth: 220 },
  docChipMine: { backgroundColor: `${C.primary}15`, borderColor: `${C.primary}33` },
  docIcon:     { width: 36, height: 36, borderRadius: R.sm, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  docIconMine: { backgroundColor: `${C.primary}20` },
  docName:     { fontSize: 12, fontWeight: '600', color: C.text },
  docNameMine: { color: '#dbeafe' },
  docMeta:     { fontSize: 10, color: C.textDim, marginTop: 1 },
}));

// ─── Message bubble ───────────────────────────────────────────────────────────
const Bubble = ({ msg, isMine, showAvatar, otherName, onImagePress }) => {
  const color   = avatarColor(otherName);
  const hasText = msg.message && msg.message.trim() && msg.message.trim() !== ' ';

  return (
    <View style={[bbl.row, isMine && bbl.rowMine]}>
      {!isMine && (
        <View style={[bbl.avatarWrap, !showAvatar && bbl.avatarHidden]}>
          {showAvatar && (
            <View style={[bbl.avatar, { backgroundColor: `${color}22`, borderColor: `${color}44` }]}>
              <Text style={[bbl.avatarText, { color }]}>{initials(otherName)}</Text>
            </View>
          )}
        </View>
      )}

      <View style={[bbl.bubble, isMine ? bbl.bubbleMine : bbl.bubbleOther]}>
        {msg.subject ? (
          <Text style={[bbl.subject, isMine && bbl.subjectMine]}>{msg.subject}</Text>
        ) : null}

        {/* Attachment */}
        {msg.attachment_path ? (
          <BubbleAttachment msg={msg} isMine={isMine} onImagePress={onImagePress} />
        ) : null}

        {/* Text */}
        {hasText && (
          <Text style={[bbl.text, isMine && bbl.textMine]}>{msg.message}</Text>
        )}

        <View style={bbl.footer}>
          {msg._pending && <ActivityIndicator size={10} color={isMine ? `${C.primary}88` : C.textDim} style={{ marginRight: 3 }} />}
          <Text style={[bbl.time, isMine && bbl.timeMine]}>{fmtTime(msg.created_at)}</Text>
          {isMine && !msg._pending && (
            <CheckCheck size={12} strokeWidth={2} color={msg.is_read ? C.primary : `${C.primary}60`} />
          )}
        </View>
      </View>
    </View>
  );
};

const bbl = themed(() => ({
  row:          { flexDirection: 'row', alignItems: 'flex-end', gap: S.xs, marginBottom: 3, paddingHorizontal: S.md },
  rowMine:      { flexDirection: 'row-reverse' },
  avatarWrap:   { width: 28, flexShrink: 0 },
  avatarHidden: { opacity: 0 },
  avatar:       { width: 28, height: 28, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  avatarText:   { fontSize: 10, fontWeight: '800' },
  bubble: {
    maxWidth: '76%', minWidth: 60,
    borderRadius: R.lg, paddingHorizontal: S.md, paddingVertical: S.sm,
  },
  bubbleOther: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderBottomLeftRadius: R.xs },
  bubbleMine:  { backgroundColor: C.primaryDim, borderWidth: 1, borderColor: `${C.primary}44`, borderBottomRightRadius: R.xs },
  subject:     { fontSize: 10, color: C.textDim, fontWeight: '700', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.5 },
  subjectMine: { color: `${C.primary}aa` },
  text:        { fontSize: 14, color: C.text, lineHeight: 20 },
  textMine:    { color: '#dbeafe' },
  footer:      { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, justifyContent: 'flex-end' },
  time:        { fontSize: 10, color: C.textDim },
  timeMine:    { color: `${C.primary}88` },
}));

// ─── Attachment picker bottom sheet ──────────────────────────────────────────
const AttachSheet = ({ visible, onClose, onPicked }) => {
  const insets = useSafeAreaInsets();

  const pickFromGallery = async () => {
    onClose();
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission required', 'Allow photo access to send images.'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsEditing: false,
      });
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        onPicked({ uri: asset.uri, mimeType: asset.mimeType || 'image/jpeg', name: asset.fileName || `photo_${Date.now()}.jpg`, isImage: true });
      }
    } catch (err) {
      Alert.alert('Gallery error', err?.message || 'Could not open photo library.');
    }
  };

  const pickFromCamera = async () => {
    onClose();
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission required', 'Allow camera access to take photos.'); return; }
      const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        onPicked({ uri: asset.uri, mimeType: asset.mimeType || 'image/jpeg', name: `photo_${Date.now()}.jpg`, isImage: true });
      }
    } catch (err) {
      Alert.alert('Camera error', err?.message || 'Could not open camera.');
    }
  };

  const pickDocument = async () => {
    onClose();
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        onPicked({ uri: asset.uri, mimeType: asset.mimeType || 'application/octet-stream', name: asset.name || 'file', size: asset.size, isImage: false });
      }
    } catch (err) {
      Alert.alert('File picker error', err?.message || 'Could not open files.');
    }
  };

  const options = [
    { label: 'Photo Library', icon: ImageIcon, color: C.primary,  action: pickFromGallery },
    { label: 'Camera',        icon: Camera,    color: C.online,   action: pickFromCamera  },
    { label: 'Document',      icon: File,      color: C.warning,  action: pickDocument    },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={sh.overlay} onPress={onClose} activeOpacity={1}>
        <View style={[sh.sheet, { paddingBottom: insets.bottom + S.lg }]}>
          <View style={sh.handle} />
          <Text style={sh.title}>Add Attachment</Text>
          {options.map(({ label, icon: Icon, color, action }) => (
            <TouchableOpacity key={label} style={sh.row} onPress={action} activeOpacity={0.7}>
              <View style={[sh.iconBox, { backgroundColor: `${color}18`, borderColor: `${color}33` }]}>
                <Icon color={color} size={20} strokeWidth={2} />
              </View>
              <Text style={sh.label}>{label}</Text>
              <ChevronLeft color={C.textDim} size={16} style={{ transform: [{ rotate: '180deg' }] }} />
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const sh = themed(() => ({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet:   { backgroundColor: C.surface, borderTopLeftRadius: R.xxl, borderTopRightRadius: R.xxl, paddingHorizontal: S.lg, paddingTop: S.md, borderTopWidth: 1, borderColor: C.border },
  handle:  { width: 36, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginBottom: S.lg },
  title:   { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: S.md },
  row:     { flexDirection: 'row', alignItems: 'center', gap: S.md, paddingVertical: S.md, borderBottomWidth: 1, borderBottomColor: C.borderFaint },
  iconBox: { width: 42, height: 42, borderRadius: R.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  label:   { flex: 1, fontSize: 15, color: C.text, fontWeight: '500' },
}));

// ─── Pending attachment preview strip ─────────────────────────────────────────
const AttachPreview = ({ file, onRemove }) => (
  <View style={ap.wrap}>
    {file.isImage ? (
      <Image source={{ uri: file.uri }} style={ap.thumb} resizeMode="cover" />
    ) : (
      <View style={ap.fileThumb}>
        <FileText color={C.primary} size={22} strokeWidth={1.8} />
      </View>
    )}
    <View style={ap.info}>
      <Text style={ap.name} numberOfLines={1}>{file.name}</Text>
      {file.size ? <Text style={ap.size}>{fmtBytes(file.size)}</Text> : null}
    </View>
    <TouchableOpacity onPress={onRemove} style={ap.removeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      <X color={C.textDim} size={14} strokeWidth={2.5} />
    </TouchableOpacity>
  </View>
);

const ap = themed(() => ({
  wrap:      { flexDirection: 'row', alignItems: 'center', gap: S.sm, backgroundColor: C.card, borderRadius: R.md, borderWidth: 1, borderColor: C.border, padding: S.sm, marginHorizontal: S.md, marginBottom: S.xs },
  thumb:     { width: 44, height: 44, borderRadius: R.sm, flexShrink: 0 },
  fileThumb: { width: 44, height: 44, borderRadius: R.sm, backgroundColor: C.primaryBg, borderWidth: 1, borderColor: `${C.primary}33`, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  info:      { flex: 1 },
  name:      { fontSize: 12, fontWeight: '600', color: C.text },
  size:      { fontSize: 10, color: C.textDim, marginTop: 2 },
  removeBtn: { width: 24, height: 24, borderRadius: 12, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
}));

// ─── Full-screen image viewer ─────────────────────────────────────────────────
const ImageViewer = ({ uri, onClose }) => (
  <Modal visible={!!uri} transparent animationType="fade" onRequestClose={onClose}>
    <TouchableOpacity style={iv.bg} activeOpacity={1} onPress={onClose}>
      <Image source={{ uri }} style={iv.img} resizeMode="contain" />
      <TouchableOpacity style={iv.closeBtn} onPress={onClose}>
        <X color="#fff" size={22} strokeWidth={2} />
      </TouchableOpacity>
    </TouchableOpacity>
  </Modal>
);
const iv = themed(() => ({
  bg:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  img:      { width: '100%', height: '85%' },
  closeBtn: { position: 'absolute', top: 52, right: 20, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
}));

// ─── Screen ───────────────────────────────────────────────────────────────────
const ChatScreen = ({ route, navigation }) => {
  const { userId, userName } = route.params;
  const insets  = useSafeAreaInsets();
  const { user } = useAuth();
  const listRef = useRef(null);

  const [messages,     setMessages]     = useState([]);
  const [isLoading,    setIsLoading]    = useState(true);
  const [isSending,    setIsSending]    = useState(false);
  const [draft,        setDraft]        = useState('');
  const [error,        setError]        = useState('');
  const [attachment,   setAttachment]   = useState(null);   // pending file to send
  const [sheetOpen,    setSheetOpen]    = useState(false);
  const [viewingImage, setViewingImage] = useState(null);   // full-screen image URI

  // ── Fetch ───────────────────────────────────────────────────────────────────
  const fetchMessages = useCallback(async () => {
    try {
      const data = await getConversationMessages(userId);
      setMessages(data);
      const hasUnread = data.some((m) => m.recipient_id === user?.id && !m.is_read);
      if (hasUnread) markMessageRead('all').catch(() => {});
    } catch (err) {
      setError(err.message || 'Failed to load messages.');
    } finally {
      setIsLoading(false);
    }
  }, [userId, user]);

  useEffect(() => {
    fetchMessages();
    const t = setInterval(fetchMessages, 10000);
    return () => clearInterval(t);
  }, [fetchMessages]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 100);
    }
  }, [messages.length]);

  // ── Send ────────────────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const text      = draft.trim();
    const hasFile   = !!attachment;
    const hasText   = !!text;
    if ((!hasText && !hasFile) || isSending) return;

    // Optimistic update
    const optimistic = {
      id:           `tmp_${Date.now()}`,
      sender_id:    user?.id,
      recipient_id: userId,
      message:      text,
      is_read:      false,
      created_at:   new Date().toISOString(),
      _pending:     true,
      // local-only preview fields for attachment
      ...(hasFile && {
        attachment_path: attachment.uri,
        attachment_type: attachment.mimeType,
        attachment_name: attachment.name,
        attachment_size: attachment.size,
        _localAttachment: true,
      }),
    };

    setDraft('');
    setAttachment(null);
    setMessages((prev) => [...prev, optimistic]);
    setIsSending(true);

    try {
      let result;
      if (hasFile) {
        result = await sendMessageWithAttachment(userId, text, attachment);
      } else {
        result = await sendDirectMessage(userId, text);
      }
      setMessages((prev) =>
        prev.map((m) =>
          m.id === optimistic.id
            ? { ...optimistic, id: result.id, created_at: result.created_at, _pending: false, _localAttachment: false,
                attachment_path: result.attachment_path ?? optimistic.attachment_path }
            : m,
        ),
      );
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setDraft(text);
      if (hasFile) setAttachment(attachment);
      setError(err.message || 'Failed to send.');
      setTimeout(() => setError(''), 4000);
    } finally {
      setIsSending(false);
    }
  }, [draft, attachment, isSending, userId, user]);

  // ── List data with date separators ─────────────────────────────────────────
  const listData = React.useMemo(() => {
    const items = [];
    let lastDate = null;
    messages.forEach((msg) => {
      const d = new Date(msg.created_at).toDateString();
      if (d !== lastDate) {
        items.push({ type: 'date', key: `date_${d}`, label: fmtDateLabel(msg.created_at) });
        lastDate = d;
      }
      items.push({ type: 'msg', key: String(msg.id), msg });
    });
    return items;
  }, [messages]);

  const renderItem = useCallback(
    ({ item, index }) => {
      if (item.type === 'date') return <DateLabel label={item.label} />;
      const isMine = item.msg.sender_id === user?.id;
      const prevItem = listData[index - 1];
      const showAvatar =
        !isMine &&
        (!prevItem || prevItem.type === 'date' ||
          (prevItem.type === 'msg' && prevItem.msg.sender_id !== item.msg.sender_id));
      return (
        <Bubble
          msg={item.msg}
          isMine={isMine}
          showAvatar={showAvatar}
          otherName={userName}
          onImagePress={(uri) => setViewingImage(uri)}
        />
      );
    },
    [listData, user, userName],
  );

  const canSend = (draft.trim() || attachment) && !isSending;
  const color   = avatarColor(userName);

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <StatusBar style="auto" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <ChevronLeft color={CHROME.text} size={22} strokeWidth={2} />
        </TouchableOpacity>
        <View style={[styles.headerAvatar, { backgroundColor: `${color}22`, borderColor: `${color}44` }]}>
          <Text style={[styles.headerAvatarText, { color }]}>{initials(userName)}</Text>
        </View>
        <View style={styles.headerCenter}>
          <Text style={styles.headerName} numberOfLines={1}>{userName}</Text>
          <Text style={styles.headerSub}>Direct message</Text>
        </View>
      </View>

      {/* ── Error ── */}
      {!!error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* ── Messages ── */}
      {isLoading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={C.primary} />
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={listData}
          renderItem={renderItem}
          keyExtractor={(item) => item.key}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No messages yet.</Text>
              <Text style={styles.emptySub}>Say hello 👋</Text>
            </View>
          }
        />
      )}

      {/* ── Pending attachment preview ── */}
      {attachment && <AttachPreview file={attachment} onRemove={() => setAttachment(null)} />}

      {/* ── Compose bar ── */}
      <View style={[styles.compose, { paddingBottom: insets.bottom + S.sm }]}>
        {/* Attach button */}
        <TouchableOpacity
          style={[styles.iconBtn, attachment && styles.iconBtnActive]}
          onPress={() => setSheetOpen(true)}
          activeOpacity={0.7}
        >
          <Paperclip color={attachment ? C.primary : C.textMuted} size={19} strokeWidth={2} />
        </TouchableOpacity>

        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder={attachment ? 'Add a caption…' : 'Type a message…'}
          placeholderTextColor={C.textDim}
          multiline
          maxLength={2000}
          returnKeyType="default"
        />

        <TouchableOpacity
          style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!canSend}
          activeOpacity={0.7}
        >
          {isSending
            ? <ActivityIndicator size="small" color="#fff" />
            : <Send color="#fff" size={18} strokeWidth={2} />}
        </TouchableOpacity>
      </View>

      {/* ── Attachment picker sheet ── */}
      <AttachSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onPicked={(file) => setAttachment(file)}
      />

      {/* ── Full-screen image viewer ── */}
      <ImageViewer uri={viewingImage} onClose={() => setViewingImage(null)} />
    </KeyboardAvoidingView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = themed(() => ({
  root: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: S.md, paddingVertical: S.md,
    backgroundColor: CHROME.bg,
    borderBottomWidth: 1, borderBottomColor: CHROME.border,
    gap: S.sm,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: R.sm,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  headerAvatar: {
    width: 38, height: 38, borderRadius: 19,
    borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  headerAvatarText: { fontSize: 13, fontWeight: '800' },
  headerCenter:     { flex: 1 },
  headerName:       { fontSize: 16, fontWeight: '700', color: C.text },
  headerSub:        { fontSize: 11, color: CHROME.textMuted, marginTop: 1 },

  errorBanner: {
    backgroundColor: C.offlineBg, margin: S.md,
    borderRadius: R.sm, padding: S.sm,
    borderLeftWidth: 3, borderLeftColor: C.offline,
  },
  errorText: { color: '#fca5a5', fontSize: 12 },

  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: S.md },
  loadingText:  { color: C.textDim, fontSize: 14 },

  listContent: { paddingVertical: S.md },

  emptyState: { paddingTop: 80, alignItems: 'center', gap: S.sm },
  emptyText:  { fontSize: 15, color: C.textMuted, fontWeight: '600' },
  emptySub:   { fontSize: 13, color: C.textDim },

  compose: {
    flexDirection: 'row', alignItems: 'flex-end', gap: S.xs,
    paddingHorizontal: S.sm, paddingTop: S.sm,
    backgroundColor: C.surface,
    borderTopWidth: 1, borderTopColor: C.border,
  },
  iconBtn: {
    width: 40, height: 40,
    borderRadius: R.sm, borderWidth: 1, borderColor: C.border,
    backgroundColor: C.card,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    marginBottom: 1,
  },
  iconBtnActive: { borderColor: C.primary, backgroundColor: C.primaryBg },
  input: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: R.lg, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: S.md, paddingVertical: S.sm,
    color: C.text, fontSize: 14,
    maxHeight: 120, minHeight: 42,
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: C.primary,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    marginBottom: 1,
  },
  sendBtnDisabled: { backgroundColor: C.primaryDim },
}));

export default ChatScreen;
