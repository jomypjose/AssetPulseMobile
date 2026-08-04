import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Switch,
  StyleSheet, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  LogOut, Server, ChevronRight, Info,
  Shield, UserCircle, RefreshCw, Mail,
  Ticket, ClipboardList, ScanLine, Search, Building2, CalendarClock,
  Fingerprint, Moon, Sun, Smartphone,
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { themed, C, R, S, elevation, CHROME } from '../theme';
import {
  isBiometricEnabled, setBiometricEnabled, getBiometricSupport,
} from '../services/BiometricService';
import UserAvatar from '../components/UserAvatar';
import PulseLogo from '../components/PulseLogo';

// ─── App version ──────────────────────────────────────────────────────────────
const APP_VERSION = '1.0.0';

// ─── Role config ──────────────────────────────────────────────────────────────
const ROLE_CONFIG = {
  super_admin: {
    label:       'Super Admin',
    description: 'Unrestricted access — full control over all users, roles, and system configuration',
    color:       C.critical,
    bg:          C.criticalBg,
    dim:         `${C.critical}22`,
  },
  admin: {
    label:       'Administrator',
    description: 'Full system access — manage users, roles, and all assets',
    color:       C.critical,
    bg:          C.criticalBg,
    dim:         `${C.critical}22`,
  },
  admin_staff: {
    label:       'Admin Staff',
    description: 'Administration staff — can manage assets and view reports',
    color:       C.warning,
    bg:          C.warningBg,
    dim:         `${C.warning}22`,
  },
  technician: {
    label:       'Technician',
    description: 'Field technician — monitor devices and respond to alerts',
    color:       C.primary,
    bg:          C.primaryBg,
    dim:         `${C.primary}22`,
  },
  viewer: {
    label:       'Viewer',
    description: 'Read-only access — view dashboards and reports',
    color:       C.online,
    bg:          C.onlineBg,
    dim:         `${C.online}22`,
  },
  default: {
    label:       'User',
    description: 'Standard access',
    color:       C.textMuted,
    bg:          C.card,
    dim:         C.cardAlt,
  },
};

const getRoleConfig = (role) => ROLE_CONFIG[role] || ROLE_CONFIG.default;

// ─── Section wrapper ──────────────────────────────────────────────────────────
const Section = ({ title, children }) => (
  <View style={sect.wrap}>
    {title && (
      <View style={sect.header}>
        <View style={sect.accent} />
        <Text style={sect.title}>{title}</Text>
      </View>
    )}
    <View style={sect.card}>{children}</View>
  </View>
);
const sect = themed(() => ({
  wrap:   { marginBottom: S.xl },
  header: { flexDirection: 'row', alignItems: 'center', gap: S.sm, marginBottom: S.sm },
  accent: { width: 3, height: 14, borderRadius: R.full, backgroundColor: C.primary },
  title:  { fontSize: 11, fontWeight: '700', color: C.textMuted, letterSpacing: 1.3, textTransform: 'uppercase' },
  card:   { backgroundColor: C.card, borderRadius: R.xl, borderWidth: 1, borderColor: C.border, overflow: 'hidden', ...elevation(1) },
}));

// ─── Generic row ──────────────────────────────────────────────────────────────
const Row = ({
  icon: Icon, iconColor, iconBg,
  label, value, valueColor,
  onPress, danger, isLast, showChevron = true,
}) => {
  const content = (
    <View style={[row.row, isLast && row.rowLast]}>
      <View style={[row.iconBox, { backgroundColor: iconBg || `${iconColor}18` }]}>
        <Icon color={iconColor} size={16} strokeWidth={2} />
      </View>
      <Text style={[row.label, danger && row.labelDanger]}>{label}</Text>
      <View style={row.right}>
        {value != null && (
          <Text style={[row.value, valueColor && { color: valueColor }]} numberOfLines={1}>
            {value}
          </Text>
        )}
        {onPress && showChevron && (
          <ChevronRight color={C.textDim} size={15} strokeWidth={2} />
        )}
      </View>
    </View>
  );

  if (!onPress) return content;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      {content}
    </TouchableOpacity>
  );
};
const row = themed(() => ({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: S.md,
    paddingHorizontal: S.lg, paddingVertical: S.lg,
    borderBottomWidth: 1, borderBottomColor: C.borderFaint,
  },
  rowLast:     { borderBottomWidth: 0 },
  iconBox:     { width: 34, height: 34, borderRadius: R.md, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  label:       { flex: 1, fontSize: 15, color: C.text, fontWeight: '500' },
  labelDanger: { color: C.offline },
  right:       { flexDirection: 'row', alignItems: 'center', gap: S.xs },
  value:       { fontSize: 13, color: C.textMuted, maxWidth: 160 },
}));

// ─── Theme picker row ─────────────────────────────────────────────────────────
const ThemeRow = ({ label, Icon, active, onPress, isLast }) => (
  <TouchableOpacity activeOpacity={0.7} onPress={onPress}>
    <View style={[row.row, isLast && row.rowLast]}>
      <View style={[row.iconBox, { backgroundColor: active ? C.primaryBg : `${C.textMuted}18` }]}>
        <Icon color={active ? C.primary : C.textMuted} size={16} strokeWidth={2} />
      </View>
      <Text style={[row.label, active && { color: C.primary, fontWeight: '700' }]}>{label}</Text>
      {active && (
        <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: C.primary }} />
      )}
    </View>
  </TouchableOpacity>
);

// ─── Screen ───────────────────────────────────────────────────────────────────
const SettingsScreen = ({ navigation }) => {
  const { user, serverUrl, logout, clearServer, refreshProfilePicture } = useAuth();
  const { preference, setPreference } = useTheme();
  const insets = useSafeAreaInsets();

  const roleConfig  = getRoleConfig(user?.role);
  const displayName = user?.full_name || user?.username || 'User';

  const [bioEnabled, setBioEnabled]     = useState(false);
  const [bioAvailable, setBioAvailable] = useState(false);

  useEffect(() => {
    (async () => {
      const support = await getBiometricSupport();
      setBioAvailable(support.available);
      setBioEnabled(await isBiometricEnabled());
    })();
  }, []);

  const onToggleBio = async (next) => {
    setBioEnabled(next);
    await setBiometricEnabled(next);
  };

  const go = (screen, params) => navigation?.navigate(screen, params);

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: logout },
      ],
    );
  };

  const handleChangeServer = () => {
    Alert.alert(
      'Change Server',
      'This will sign you out and clear the server configuration. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Continue', style: 'destructive', onPress: clearServer },
      ],
    );
  };

  const serverDisplay = serverUrl
    ? serverUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')
    : 'Not configured';

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar style="auto" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <Text style={styles.headerSub}>Account & settings</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + S.xxxxl }]}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Profile card ── */}
        <View style={styles.profileCard}>
          <TouchableOpacity onPress={refreshProfilePicture} activeOpacity={0.8}>
            <UserAvatar user={user} serverUrl={serverUrl} size={76} />
          </TouchableOpacity>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{displayName}</Text>
            {user?.username && user?.full_name && (
              <Text style={styles.profileUsername}>@{user.username}</Text>
            )}
            {/* Role badge inline */}
            <View style={[styles.roleBadge, { backgroundColor: roleConfig.bg, borderColor: `${roleConfig.color}55` }]}>
              <Shield color={roleConfig.color} size={10} strokeWidth={2.5} />
              <Text style={[styles.roleText, { color: roleConfig.color }]}>
                {roleConfig.label}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Account ── */}
        <Section title="Account">
          <Row
            icon={UserCircle}
            iconColor={C.primary}
            iconBg={C.primaryBg}
            label="Username"
            value={user?.username || '—'}
            showChevron={false}
            isLast={!user?.email}
          />
          {user?.email && (
            <Row
              icon={Mail}
              iconColor={C.cyan}
              iconBg={C.cyanBg}
              label="Email"
              value={user.email}
              showChevron={false}
              isLast
            />
          )}
        </Section>

        {/* ── Tools (the new screens live here) ── */}
        <Section title="Tools">
          <Row icon={Ticket}         iconColor={C.primary} iconBg={C.primaryBg}
               label="Tickets"       onPress={() => go('Tickets')} />
          <Row icon={ClipboardList}  iconColor={C.warning} iconBg={C.warningBg}
               label="Daily Jobs"    onPress={() => go('DailyJobs')} />
          <Row icon={ScanLine}       iconColor={C.online}  iconBg={C.onlineBg}
               label="Scan asset"    onPress={() => go('Scanner')} />
          <Row icon={Search}         iconColor={C.info}    iconBg={C.infoBg}
               label="Search"        onPress={() => go('Search')} />
          <Row icon={Building2}      iconColor={C.cyan}    iconBg={C.cyanBg}
               label="Branches"      onPress={() => go('Branches')} />
          <Row icon={CalendarClock}  iconColor={C.purple}  iconBg={C.purpleBg}
               label="Expiry digest" onPress={() => go('Expiry')} isLast />
        </Section>

        {/* ── Appearance ── */}
        <Section title="Appearance">
          <ThemeRow
            label="System"
            Icon={Smartphone}
            active={preference === 'system'}
            onPress={() => setPreference('system')}
          />
          <ThemeRow
            label="Light"
            Icon={Sun}
            active={preference === 'light'}
            onPress={() => setPreference('light')}
          />
          <ThemeRow
            label="Dark"
            Icon={Moon}
            active={preference === 'dark'}
            onPress={() => setPreference('dark')}
            isLast
          />
        </Section>

        {/* ── Security ── */}
        {bioAvailable && (
          <Section title="Security">
            <View style={[row.row, row.rowLast]}>
              <View style={[row.iconBox, { backgroundColor: C.primaryBg }]}>
                <Fingerprint color={C.primary} size={16} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={row.label}>Biometric unlock</Text>
                <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                  Require fingerprint / face on every launch
                </Text>
              </View>
              <Switch
                value={bioEnabled}
                onValueChange={onToggleBio}
                thumbColor={bioEnabled ? C.primary : '#888'}
                trackColor={{ false: C.cardAlt, true: `${C.primary}55` }}
              />
            </View>
          </Section>
        )}

        {/* ── Server ── */}
        <Section title="Server">
          <Row
            icon={Server}
            iconColor={C.cyan}
            iconBg={C.cyanBg}
            label="Connected Server"
            value={serverDisplay}
            showChevron={false}
            isLast={false}
          />
          <Row
            icon={RefreshCw}
            iconColor={C.warning}
            iconBg={C.warningBg}
            label="Change Server"
            onPress={handleChangeServer}
            isLast
          />
        </Section>

        {/* ── App ── */}
        <Section title="App">
          <Row
            icon={Info}
            iconColor={C.purple}
            iconBg={C.purpleBg}
            label="App Version"
            value={APP_VERSION}
            showChevron={false}
            isLast
          />
        </Section>

        {/* ── Sign out ── */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.82}>
          <LogOut color={C.white} size={16} strokeWidth={2} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        {/* ── Branding ── */}
        <View style={styles.branding}>
          <PulseLogo color={C.primaryDim} size={18} />
          <Text style={styles.brandName}>AssetPulse Monitor</Text>
        </View>
        <Text style={styles.brandSub}>Network monitoring, in your pocket.</Text>

      </ScrollView>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = themed(() => ({
  root: { flex: 1, backgroundColor: C.bg },

  header: {
    paddingHorizontal: S.xl, paddingTop: S.lg, paddingBottom: S.md,
    backgroundColor: CHROME.bg,
    borderBottomWidth: 1, borderBottomColor: CHROME.border,
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: CHROME.text },
  headerSub:   { fontSize: 11, color: CHROME.textMuted, marginTop: 2 },

  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: S.lg, paddingTop: S.xl },

  // Profile card
  profileCard: {
    backgroundColor: C.card,
    borderRadius: R.xl,
    padding: S.xl,
    flexDirection: 'row', alignItems: 'center', gap: S.lg,
    borderWidth: 1, borderColor: C.border,
    marginBottom: S.xl,
    ...elevation(2),
  },
  profileInfo:     { flex: 1, gap: S.xs },
  profileName:     { fontSize: 20, fontWeight: '800', color: C.text },
  profileUsername: { fontSize: 13, color: C.textMuted },
  roleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: S.sm, paddingVertical: 3,
    borderRadius: R.sm, borderWidth: 1,
    marginTop: S.xs,
  },
  roleText: { fontSize: 11, fontWeight: '700' },

  // Sign-out button (standalone, prominent)
  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm,
    backgroundColor: C.offline,
    borderRadius: R.lg, paddingVertical: 14,
    marginBottom: S.xl,
    shadowColor: C.offline,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22, shadowRadius: 8,
    elevation: 4,
  },
  signOutText: { color: C.white, fontSize: 15, fontWeight: '700' },

  // Branding footer
  branding: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm,
    marginTop: S.sm,
  },
  brandName: { fontSize: 13, fontWeight: '700', color: C.textDim, letterSpacing: 0.5 },
  brandSub:  { fontSize: 11, color: C.textDim, textAlign: 'center', marginTop: S.xs, marginBottom: S.lg },
}));

export default SettingsScreen;
