import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView,
  ActivityIndicator, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Server, CheckCircle, XCircle, ChevronRight, Globe, Info } from 'lucide-react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import PulseLogo from '../components/PulseLogo';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { themed, C, R, S } from '../theme';

// ─── Brand logo with glow rings ───────────────────────────────────────────────
const LogoIcon = () => (
  <View style={logo.wrapper}>
    {/* Outer glow ring */}
    <View style={logo.outerRing} />
    {/* Mid glow */}
    <View style={logo.midGlow} />
    {/* Icon box */}
    <View style={logo.iconBox}>
      <PulseLogo color={C.primary} size={44} />
    </View>
  </View>
);
const logo = themed(() => ({
  wrapper: {
    width: 140, height: 140,
    alignItems: 'center', justifyContent: 'center', alignSelf: 'center',
    marginBottom: S.md,
  },
  outerRing: {
    position: 'absolute',
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: `${C.primary}0d`,
    borderWidth: 1, borderColor: `${C.primary}25`,
  },
  midGlow: {
    position: 'absolute',
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: `${C.primary}15`,
  },
  iconBox: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: C.primaryBg,
    borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
}));

// ─── Normalise URL ─────────────────────────────────────────────────────────────
// Always resolves to https:// — credentials and bearer tokens go to this
// address on every request, so plaintext http:// is never allowed, even if
// the user explicitly types it (would otherwise let a spoofed/MITM host on
// the same network harvest a login in cleartext).
const normaliseUrl = (raw) => {
  let url = raw.trim().replace(/\/+$/, '');          // strip trailing slashes
  if (!url) return null;
  if (/^http:\/\//i.test(url)) url = url.replace(/^http:\/\//i, 'https://');
  else if (!/^https:\/\//i.test(url)) url = `https://${url}`;
  // Append /api if not already present
  if (!/\/api\/?$/.test(url)) url = `${url}/api`;
  return url;
};

// ─── Screen ───────────────────────────────────────────────────────────────────
const ServerSetupScreen = () => {
  const insets = useSafeAreaInsets();
  const { saveServer } = useAuth();

  const [input,    setInput]    = useState('');
  const [status,   setStatus]   = useState('idle');   // idle | verifying | ok | error
  const [message,  setMessage]  = useState('');
  const [resolved, setResolved] = useState('');       // the normalised URL shown on success

  const shakeAnim = useRef(new Animated.Value(0)).current;

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,  duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const handleVerify = async () => {
    const url = normaliseUrl(input);
    if (!url) { shake(); setStatus('error'); setMessage('Enter a valid server address.'); return; }

    const wasPlaintext = /^http:\/\//i.test(input.trim());
    setStatus('verifying');
    setMessage(wasPlaintext ? 'Upgraded to HTTPS — plain HTTP isn’t supported.' : '');
    setResolved(url);

    try {
      // Hit /api/health — no auth required
      const res = await axios.get(`${url}/health`, { timeout: 8000 });
      const body = res.data;
      // Accept any 2xx that looks like an AssetPulse health response
      if (res.status >= 200 && res.status < 300) {
        setStatus('ok');
        setMessage(body?.status === 'healthy' ? 'Server is healthy ✓' : 'Server responded ✓');
      } else {
        throw new Error(`Unexpected status ${res.status}`);
      }
    } catch (err) {
      setStatus('error');
      const msg = err?.response?.status
        ? `Server returned ${err.response.status}`
        : err?.code === 'ECONNABORTED'
          ? 'Connection timed out — check the address and port.'
          : 'Could not reach server — check the address.';
      setMessage(msg);
      shake();
    }
  };

  const handleConnect = async () => {
    if (status !== 'ok') return;
    await saveServer(resolved);
    // Navigation reacts automatically via AuthContext.isServerConfigured
  };

  const isVerifying = status === 'verifying';
  const canVerify   = input.trim().length > 3 && !isVerifying;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="auto" />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <LogoIcon />

        <Text style={styles.title}>Connect to AssetPulse</Text>
        <Text style={styles.subtitle}>
          Enter your AssetPulse server address to get started.
        </Text>

        {/* ── Input ── */}
        <Animated.View style={[styles.inputWrap, { transform: [{ translateX: shakeAnim }] }]}>
          <Globe color={C.textDim} size={17} strokeWidth={2} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={(t) => { setInput(t); if (status !== 'idle') setStatus('idle'); }}
            placeholder="assetpulse.example.com"
            placeholderTextColor={C.textDim}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="go"
            onSubmitEditing={handleVerify}
            editable={!isVerifying}
          />
        </Animated.View>

        {/* ── Hint ── */}
        <View style={styles.hintRow}>
          <Info color={C.textDim} size={12} strokeWidth={2} />
          <Text style={styles.hintText}>
            Works with domain names, IP addresses, and custom ports (e.g. 192.168.1.10:3001)
          </Text>
        </View>

        {/* ── Status message ── */}
        {!!message && (
          <View style={[styles.statusRow, status === 'ok' ? styles.statusOk : styles.statusErr]}>
            {status === 'ok'
              ? <CheckCircle color={C.online}   size={15} strokeWidth={2} />
              : <XCircle     color={C.offline}  size={15} strokeWidth={2} />}
            <Text style={[styles.statusText, status === 'ok' ? styles.statusTextOk : styles.statusTextErr]}>
              {message}
            </Text>
          </View>
        )}

        {/* ── Resolved URL preview ── */}
        {!!resolved && status !== 'idle' && (
          <Text style={styles.resolvedUrl}>{resolved}</Text>
        )}

        {/* ── Verify button ── */}
        {status !== 'ok' && (
          <TouchableOpacity
            style={[styles.btn, !canVerify && styles.btnDisabled]}
            onPress={handleVerify}
            disabled={!canVerify}
            activeOpacity={0.8}
          >
            {isVerifying
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.btnText}>Verify Server</Text>}
          </TouchableOpacity>
        )}

        {/* ── Connect button (shown after successful verify) ── */}
        {status === 'ok' && (
          <TouchableOpacity style={styles.btnConnect} onPress={handleConnect} activeOpacity={0.8}>
            <Text style={styles.btnConnectText}>Connect & Sign In</Text>
            <ChevronRight color="#fff" size={20} strokeWidth={2.5} />
          </TouchableOpacity>
        )}

        {/* ── Try different address ── */}
        {status === 'ok' && (
          <TouchableOpacity onPress={() => { setStatus('idle'); setMessage(''); setResolved(''); }} style={{ marginTop: S.md, alignSelf: 'center' }}>
            <Text style={styles.changeLink}>Use a different address</Text>
          </TouchableOpacity>
        )}

        {/* ── Examples ── */}
        <View style={styles.examples}>
          <Text style={styles.examplesTitle}>Examples</Text>
          {[
            'assetpulse.mycompany.com',
            'monitor.internal:3001',
            '192.168.1.100:3001',
          ].map((ex) => (
            <TouchableOpacity
              key={ex}
              style={styles.exampleRow}
              onPress={() => { setInput(ex); setStatus('idle'); setMessage(''); }}
              activeOpacity={0.6}
            >
              <View style={styles.exampleDot} />
              <Text style={styles.exampleText}>{ex}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = themed(() => ({
  scroll: { paddingHorizontal: S.xl, alignItems: 'stretch' },

  title:    { fontSize: 26, fontWeight: '800', color: C.text, textAlign: 'center', marginTop: S.md },
  subtitle: { fontSize: 14, color: C.textMuted, textAlign: 'center', marginTop: S.sm, lineHeight: 20, marginBottom: S.xl },

  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.card, borderRadius: R.lg,
    borderWidth: 1.5, borderColor: C.border,
    paddingHorizontal: S.md, height: 52,
    marginBottom: S.sm,
  },
  inputIcon: { marginRight: S.sm, flexShrink: 0 },
  input:     { flex: 1, color: C.text, fontSize: 15 },

  hintRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: S.xs, marginBottom: S.lg },
  hintText: { flex: 1, fontSize: 11, color: C.textDim, lineHeight: 16 },

  statusRow: { flexDirection: 'row', alignItems: 'center', gap: S.sm, borderRadius: R.md, padding: S.md, marginBottom: S.sm, borderWidth: 1 },
  statusOk:  { backgroundColor: `${C.online}12`,  borderColor: `${C.online}33`  },
  statusErr: { backgroundColor: `${C.offline}12`, borderColor: `${C.offline}33` },
  statusText:      { flex: 1, fontSize: 13, fontWeight: '500' },
  statusTextOk:    { color: C.online  },
  statusTextErr:   { color: C.offline },

  resolvedUrl: { fontSize: 11, color: C.textDim, textAlign: 'center', marginBottom: S.md, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },

  btn: {
    backgroundColor: C.primary, borderRadius: R.lg, height: 52,
    alignItems: 'center', justifyContent: 'center', marginTop: S.sm,
    shadowColor: C.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28, shadowRadius: 10, elevation: 4,
  },
  btnDisabled: { opacity: 0.4 },
  btnText:     { color: '#fff', fontSize: 16, fontWeight: '700' },

  btnConnect:     { backgroundColor: C.online, borderRadius: R.lg, height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm, marginTop: S.sm },
  btnConnectText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  changeLink: { fontSize: 13, color: C.textMuted, textDecorationLine: 'underline' },

  examples:      { marginTop: S.xxl, padding: S.lg, backgroundColor: C.surface, borderRadius: R.lg, borderWidth: 1, borderColor: C.border },
  examplesTitle: { fontSize: 11, fontWeight: '700', color: C.textDim, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: S.md },
  exampleRow:    { flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingVertical: S.xs },
  exampleDot:    { width: 5, height: 5, borderRadius: 3, backgroundColor: C.primary, flexShrink: 0 },
  exampleText:   { fontSize: 13, color: C.textMuted, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
}));

export default ServerSetupScreen;
