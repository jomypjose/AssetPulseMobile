import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform,
  ScrollView, ActivityIndicator, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Eye, EyeOff, Lock, User, Server, ArrowRight } from 'lucide-react-native';
import PulseLogo from '../components/PulseLogo';
import { useAuth } from '../context/AuthContext';
import { themed, C, R, S } from '../theme';

// ─── Brand hero — refined logo tile with a single soft pulse ──────────────────
const BrandHero = () => {
  const ring = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(ring, { toValue: 1, duration: 2200, useNativeDriver: true }),
        Animated.timing(ring, { toValue: 0, duration: 0,    useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, []);

  const scale   = ring.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.5] });
  const opacity = ring.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.35, 0.12, 0] });

  return (
    <View style={hero.wrapper}>
      <Animated.View style={[hero.pulse, { transform: [{ scale }], opacity }]} />
      <View style={hero.tile}>
        <PulseLogo color={C.primary} size={40} />
      </View>
    </View>
  );
};

const hero = themed(() => ({
  wrapper: {
    width: 96, height: 96,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: S.xl,
  },
  pulse: {
    position: 'absolute',
    width: 88, height: 88, borderRadius: 28,
    borderWidth: 1.5, borderColor: C.primary,
  },
  tile: {
    width: 72, height: 72, borderRadius: 22,
    backgroundColor: C.card,
    borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
    ...{
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.3,
      shadowRadius: 14,
      elevation: 6,
    },
  },
}));

// ─── Decorated input field ────────────────────────────────────────────────────
const Field = ({ label, Icon, value, onChangeText, placeholder, secureTextEntry,
                 returnKeyType, onSubmitEditing, editable, autoCapitalize,
                 rightElement }) => {
  const [focused, setFocused] = useState(false);
  const focusAnim = useRef(new Animated.Value(0)).current;

  const onFocus = () => {
    setFocused(true);
    Animated.timing(focusAnim, { toValue: 1, duration: 160, useNativeDriver: false }).start();
  };
  const onBlur = () => {
    setFocused(false);
    Animated.timing(focusAnim, { toValue: 0, duration: 160, useNativeDriver: false }).start();
  };

  const borderColor = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [C.border, C.primary],
  });

  return (
    <View style={field.group}>
      <Text style={[field.label, focused && { color: C.primary }]}>{label}</Text>
      <Animated.View style={[field.row, { borderColor }]}>
        <Icon color={focused ? C.primary : C.textMuted} size={18} strokeWidth={2} style={{ flexShrink: 0 }} />
        <TextInput
          style={field.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={C.textDim}
          secureTextEntry={secureTextEntry}
          autoCapitalize={autoCapitalize ?? 'none'}
          autoCorrect={false}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          editable={editable}
          onFocus={onFocus}
          onBlur={onBlur}
        />
        {rightElement}
      </Animated.View>
    </View>
  );
};

const field = themed(() => ({
  group: { marginBottom: S.lg },
  label: {
    fontSize: 11, fontWeight: '700', color: C.textMuted,
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: S.sm,
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.surface,
    borderRadius: R.md, borderWidth: 1.5,
    paddingHorizontal: S.lg, height: 54,
    gap: S.md,
  },
  input: { flex: 1, color: C.text, fontSize: 15, letterSpacing: 0.2, paddingVertical: 0 },
}));

// ─── Screen ───────────────────────────────────────────────────────────────────
const LoginScreen = () => {
  const { login, clearServer, serverUrl } = useAuth();
  const insets     = useSafeAreaInsets();

  const [username,   setUsername]   = useState('');
  const [password,   setPassword]   = useState('');
  const [showPass,   setShowPass]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState('');

  const shakeX   = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(cardAnim, {
      toValue: 1, useNativeDriver: true,
      delay: 150, tension: 70, friction: 11,
    }).start();
  }, []);

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeX, { toValue: 9,  duration: 55, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: -9, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 6,  duration: 55, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: -6, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 0,  duration: 55, useNativeDriver: true }),
    ]).start();
  };

  const handleLogin = useCallback(async () => {
    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password.');
      shake();
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(err.message || 'Login failed. Check your credentials.');
      shake();
    } finally {
      setSubmitting(false);
    }
  }, [username, password, login]);

  const cardTranslateY = cardAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [28, 0],
  });

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingBottom: insets.bottom }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="light" />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + S.xxxxl }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Brand ── */}
        <View style={styles.brand}>
          <BrandHero />
          <Text style={styles.appName}>AssetPulse</Text>
          <View style={styles.taglineRow}>
            <View style={styles.taglineDash} />
            <Text style={styles.tagline}>NETWORK MONITORING</Text>
            <View style={styles.taglineDash} />
          </View>
        </View>

        {/* ── Login card ── */}
        <Animated.View
          style={[
            styles.card,
            {
              transform: [
                { translateX: shakeX },
                { translateY: cardTranslateY },
              ],
              opacity: cardAnim,
            },
          ]}
        >
          <Text style={styles.cardTitle}>Welcome back</Text>
          <Text style={styles.cardSub}>Sign in to continue monitoring</Text>

          {/* Error */}
          {!!error && (
            <View style={styles.errorBanner}>
              <Lock color={C.offline} size={14} strokeWidth={2.5} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Field
            label="Username"
            Icon={User}
            value={username}
            onChangeText={setUsername}
            placeholder="Enter your username"
            returnKeyType="next"
            editable={!submitting}
          />

          <Field
            label="Password"
            Icon={Lock}
            value={password}
            onChangeText={setPassword}
            placeholder="Enter your password"
            secureTextEntry={!showPass}
            returnKeyType="done"
            onSubmitEditing={handleLogin}
            editable={!submitting}
            rightElement={
              <TouchableOpacity
                onPress={() => setShowPass(p => !p)}
                activeOpacity={0.7}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                {showPass
                  ? <EyeOff color={C.textMuted} size={18} />
                  : <Eye    color={C.textMuted} size={18} />}
              </TouchableOpacity>
            }
          />

          {/* Sign In button */}
          <TouchableOpacity
            style={[styles.btn, submitting && styles.btnDisabled]}
            onPress={handleLogin}
            activeOpacity={0.85}
            disabled={submitting}
          >
            {submitting
              ? <ActivityIndicator color={C.white} size="small" />
              : (
                <>
                  <Text style={styles.btnText}>Sign In</Text>
                  <ArrowRight color={C.white} size={18} strokeWidth={2.5} />
                </>
              )}
          </TouchableOpacity>
        </Animated.View>

        <View style={{ flex: 1 }} />

        {/* ── Server footer ── */}
        <View style={styles.serverCard}>
          <Server color={C.textMuted} size={13} strokeWidth={2} />
          <Text style={styles.serverText} numberOfLines={1}>
            {serverUrl?.replace(/\/api\/?$/, '') || 'Unknown server'}
          </Text>
          <TouchableOpacity onPress={clearServer} hitSlop={{ top: 8, bottom: 8, left: 10, right: 10 }}>
            <Text style={styles.changeServer}>Change</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.version}>AssetPulse Monitor · v1.0</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = themed(() => ({
  root:   { flex: 1, backgroundColor: C.bg },
  scroll: { flexGrow: 1, paddingHorizontal: S.xl, paddingBottom: S.xxl },

  // Brand
  brand:   { alignItems: 'center', marginBottom: S.xxxl },
  appName: {
    fontSize: 30, fontWeight: '800', color: C.text,
    letterSpacing: -0.5,
  },
  taglineRow: { flexDirection: 'row', alignItems: 'center', gap: S.sm, marginTop: S.sm },
  taglineDash: { width: 16, height: 1, backgroundColor: C.border },
  tagline: {
    fontSize: 10, fontWeight: '700', color: C.textMuted,
    letterSpacing: 2.5,
  },

  // Card
  card: {
    backgroundColor: C.card,
    borderRadius: R.xxl,
    padding: S.xxl,
    borderWidth: 1, borderColor: C.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 10,
  },
  cardTitle: { fontSize: 23, fontWeight: '800', color: C.text, marginBottom: 4 },
  cardSub:   { fontSize: 13, color: C.textMuted, marginBottom: S.xl, lineHeight: 19 },

  // Error
  errorBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: S.sm,
    backgroundColor: C.offlineBg,
    borderRadius: R.md, padding: S.md,
    marginBottom: S.lg,
    borderLeftWidth: 3, borderLeftColor: C.offline,
  },
  errorText: { color: '#fca5a5', fontSize: 13, flex: 1, lineHeight: 18 },

  // Button
  btn: {
    flexDirection: 'row', gap: S.sm,
    backgroundColor: C.primary,
    borderRadius: R.md, height: 54,
    alignItems: 'center', justifyContent: 'center', marginTop: S.sm,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28, shadowRadius: 10,
    elevation: 4,
  },
  btnDisabled: { opacity: 0.55 },
  btnText:     { color: C.white, fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },

  // Server footer — clean pill
  serverCard: {
    flexDirection: 'row', alignItems: 'center',
    gap: S.sm, alignSelf: 'center',
    backgroundColor: C.card,
    borderWidth: 1, borderColor: C.border,
    borderRadius: R.full,
    paddingVertical: S.sm, paddingHorizontal: S.lg,
    marginTop: S.xxl, maxWidth: '100%',
  },
  serverText:   { fontSize: 12, color: C.textSub, flexShrink: 1 },
  changeServer: { fontSize: 12, color: C.primary, fontWeight: '700' },

  version: { textAlign: 'center', color: C.textDim, fontSize: 10, marginTop: S.md },
}));

export default LoginScreen;
