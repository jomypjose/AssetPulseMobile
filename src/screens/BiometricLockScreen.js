import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Fingerprint, LogOut } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { themed, C, R, S, elevation } from '../theme';
import PulseLogo from '../components/PulseLogo';

const BiometricLockScreen = () => {
  const { tryUnlock, logout } = useAuth();
  const insets = useSafeAreaInsets();

  // Prompt automatically on mount; user can tap to retry if they cancel.
  useEffect(() => { tryUnlock(); }, [tryUnlock]);

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.logoWrap}>
        <PulseLogo size={72} />
      </View>

      <View style={styles.body}>
        <View style={styles.iconRing}>
          <Fingerprint color={C.primary} size={40} strokeWidth={1.6} />
        </View>
        <Text style={styles.title}>AssetPulse is locked</Text>
        <Text style={styles.subtitle}>
          Unlock with your fingerprint or face to continue.
        </Text>

        <TouchableOpacity style={styles.unlockBtn} onPress={tryUnlock} activeOpacity={0.85}>
          <Fingerprint color={C.white} size={18} strokeWidth={2.2} />
          <Text style={styles.unlockText}>Unlock</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.signOutBtn} onPress={logout} activeOpacity={0.7}>
          <LogOut color={C.textMuted} size={14} strokeWidth={2} />
          <Text style={styles.signOutText}>Sign out instead</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = themed(() => ({
  root:      { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'space-between', padding: S.xl },
  logoWrap:  { marginTop: S.xxxxl, alignItems: 'center' },
  body:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: S.lg, width: '100%' },
  iconRing:  {
    width: 96, height: 96, borderRadius: R.full,
    backgroundColor: C.primaryBg, borderWidth: 2, borderColor: `${C.primary}55`,
    alignItems: 'center', justifyContent: 'center',
  },
  title:     { fontSize: 20, fontWeight: '800', color: C.text, marginTop: S.sm },
  subtitle:  { fontSize: 13, color: C.textMuted, textAlign: 'center', maxWidth: 280 },
  unlockBtn: {
    flexDirection: 'row', alignItems: 'center', gap: S.sm,
    backgroundColor: C.primary,
    paddingHorizontal: S.xxl, paddingVertical: 14, borderRadius: R.lg,
    marginTop: S.lg, ...elevation(2),
  },
  unlockText:{ color: C.white, fontSize: 15, fontWeight: '700' },
  signOutBtn:{ flexDirection: 'row', alignItems: 'center', gap: S.xs, marginTop: S.sm, padding: S.sm },
  signOutText:{ color: C.textMuted, fontSize: 12, fontWeight: '600' },
}));

export default BiometricLockScreen;
