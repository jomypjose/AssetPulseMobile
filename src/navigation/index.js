import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getAlerts, getUnreadMessageCount, getConversations, acknowledgeAlert } from '../services/api';
import {
  init as initNotifications,
  checkMessages, seedMessages, addActionListener,
} from '../services/NotificationService';
import { themed, C, R, S, CHROME } from '../theme';

// Screens
import ServerSetupScreen   from '../screens/ServerSetupScreen';
import LoginScreen         from '../screens/LoginScreen';
import BiometricLockScreen from '../screens/BiometricLockScreen';
import DashboardScreen     from '../screens/DashboardScreen';
import MapScreen           from '../screens/MapScreen';
import DevicesScreen       from '../screens/DevicesScreen';
import DeviceDetailScreen  from '../screens/DeviceDetailScreen';
import AlertsScreen        from '../screens/AlertsScreen';
import MessagingScreen     from '../screens/MessagingScreen';
import ChatScreen          from '../screens/ChatScreen';
import SettingsScreen      from '../screens/SettingsScreen';
import TicketsHubScreen    from '../screens/TicketsHubScreen';
import DailyJobsScreen     from '../screens/DailyJobsScreen';
import ScannerScreen       from '../screens/ScannerScreen';
import SearchScreen        from '../screens/SearchScreen';
import BranchesScreen      from '../screens/BranchesScreen';
import BranchDetailScreen     from '../screens/BranchDetailScreen';
import BranchAssetsListScreen from '../screens/BranchAssetsListScreen';
import ExpiryScreen           from '../screens/ExpiryScreen';

// Icons
import {
  LayoutDashboard, Server, Bell, MessageCircle, UserCircle,
} from 'lucide-react-native';

const Tab              = createBottomTabNavigator();
const DashboardStack   = createNativeStackNavigator();
const DevicesStack     = createNativeStackNavigator();
const MessagesStack    = createNativeStackNavigator();
const ProfileStack     = createNativeStackNavigator();
const RootStack        = createNativeStackNavigator();

// ─── Dashboard stack (Dashboard + full-screen Map + tools) ────────────────────
const DashboardNavigator = () => (
  <DashboardStack.Navigator screenOptions={{ headerShown: false }}>
    <DashboardStack.Screen name="DashboardHome" component={DashboardScreen} />
    <DashboardStack.Screen name="Map"           component={MapScreen}           options={{ animation: 'slide_from_bottom' }} />
    <DashboardStack.Screen name="Tickets"       component={TicketsHubScreen} />
    <DashboardStack.Screen name="DailyJobs"     component={DailyJobsScreen} />
    <DashboardStack.Screen name="Scanner"       component={ScannerScreen} />
    <DashboardStack.Screen name="Search"        component={SearchScreen} />
    <DashboardStack.Screen name="Branches"      component={BranchesScreen} />
    <DashboardStack.Screen name="BranchDetail"  component={BranchDetailScreen} />
    <DashboardStack.Screen name="BranchAssetsList" component={BranchAssetsListScreen} />
    <DashboardStack.Screen name="Expiry"        component={ExpiryScreen} />
    <DashboardStack.Screen name="DeviceDetail"  component={DeviceDetailScreen} />
  </DashboardStack.Navigator>
);

// ─── Devices stack ────────────────────────────────────────────────────────────
const DevicesNavigator = () => (
  <DevicesStack.Navigator screenOptions={{ headerShown: false }}>
    <DevicesStack.Screen name="DeviceList"   component={DevicesScreen} />
    <DevicesStack.Screen name="DeviceDetail" component={DeviceDetailScreen} />
  </DevicesStack.Navigator>
);

// ─── Messages stack ───────────────────────────────────────────────────────────
const MessagesNavigator = () => (
  <MessagesStack.Navigator screenOptions={{ headerShown: false }}>
    <MessagesStack.Screen name="Inbox" component={MessagingScreen} />
    <MessagesStack.Screen name="Chat"  component={ChatScreen} />
  </MessagesStack.Navigator>
);

// ─── Profile stack (Settings + tool entries reachable from Settings) ──────────
const ProfileNavigator = () => (
  <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
    <ProfileStack.Screen name="ProfileHome" component={SettingsScreen} />
    <ProfileStack.Screen name="Tickets"     component={TicketsHubScreen} />
    <ProfileStack.Screen name="DailyJobs"   component={DailyJobsScreen} />
    <ProfileStack.Screen name="Scanner"     component={ScannerScreen} />
    <ProfileStack.Screen name="Search"      component={SearchScreen} />
    <ProfileStack.Screen name="Branches"    component={BranchesScreen} />
    <ProfileStack.Screen name="BranchDetail" component={BranchDetailScreen} />
    <ProfileStack.Screen name="BranchAssetsList" component={BranchAssetsListScreen} />
    <ProfileStack.Screen name="Expiry"      component={ExpiryScreen} />
    <ProfileStack.Screen name="DeviceDetail" component={DeviceDetailScreen} />
  </ProfileStack.Navigator>
);

// ─── Custom tab icon ──────────────────────────────────────────────────────────
const TabIcon = ({ Icon, focused, color, badge }) => (
  <View style={ti.wrapper}>
    {focused && <View style={ti.indicator} />}
    <View style={[ti.iconBox, focused && ti.iconBoxActive]}>
      <Icon color={color} size={21} strokeWidth={focused ? 2 : 1.6} />
    </View>
    {badge > 0 && <View style={ti.badge} />}
  </View>
);

const ti = themed(() => ({
  wrapper:       { alignItems: 'center', justifyContent: 'center', gap: 2 },
  indicator:     { position: 'absolute', top: -8, width: 4, height: 4, borderRadius: R.full, backgroundColor: C.primary },
  iconBox:       { width: 44, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: R.sm },
  iconBoxActive: { backgroundColor: `${C.primary}18` },
  badge:         { position: 'absolute', top: 2, right: 4, width: 7, height: 7, borderRadius: R.full, backgroundColor: C.offline },
}));

// ─── Bottom tabs ──────────────────────────────────────────────────────────────
const MainNavigator = ({ user }) => {
  const [unackedAlerts, setUnackedAlerts] = useState(0);
  const [unreadMsgs,    setUnreadMsgs]    = useState(0);
  const seededRef = useRef(false);
  const insets = useSafeAreaInsets();

  const tabBarStyle = {
    ...styles.tabBar,
    paddingBottom:    Math.max(insets.bottom, S.sm),
    paddingLeft:      Math.max(insets.left  + S.md, S.lg),
    paddingRight:     Math.max(insets.right + S.md, S.lg),
    height:           52 + Math.max(insets.bottom, S.sm),
  };

  useEffect(() => {
    initNotifications();
    // Handle the "Acknowledge" action button on alert push notifications.
    const off = addActionListener(async (data) => {
      if (data?.alertId) {
        try { await acknowledgeAlert(data.alertId); } catch (_) { /* ignore */ }
      }
    });
    return off;
  }, []);

  useEffect(() => {
    const poll = async (isFirst = false) => {
      try {
        const [alertData, convData, msgData] = await Promise.all([
          getAlerts(),
          getConversations().catch(() => []),
          getUnreadMessageCount().catch(() => ({ count: 0 })),
        ]);

        const alerts = alertData.alerts || [];
        const convs  = convData || [];

        // Alert notifications are delivered via server push (see monitoring.js)
        // to avoid duplicate notifications; the client only handles messages here.
        if (isFirst) {
          seedMessages(convs, user?.id);
          seededRef.current = true;
        } else if (seededRef.current) {
          await checkMessages(convs, user?.id);
        }

        setUnackedAlerts(alerts.filter((a) => !a.is_acknowledged).length);
        setUnreadMsgs(msgData.count || 0);
      } catch { /* silently ignore */ }
    };
    poll(true);
    const t = setInterval(() => poll(false), 30000);
    return () => clearInterval(t);
  }, [user]);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown:             false,
        tabBarStyle:             tabBarStyle,
        tabBarActiveTintColor:   C.primary,
        tabBarInactiveTintColor: CHROME.textDim,
        tabBarLabelStyle:        styles.tabLabel,
        tabBarHideOnKeyboard:    true,
        tabBarIcon: ({ focused, color }) => {
          const icons = {
            Dashboard: LayoutDashboard,
            Devices:   Server,
            Alerts:    Bell,
            Messages:  MessageCircle,
            Profile:   UserCircle,
          };
          const Icon  = icons[route.name] || Bell;
          const badge = route.name === 'Alerts'
            ? unackedAlerts
            : route.name === 'Messages'
              ? unreadMsgs
              : 0;
          return <TabIcon Icon={Icon} focused={focused} color={color} badge={badge} />;
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardNavigator} options={{ tabBarLabel: 'Dashboard' }} />
      <Tab.Screen name="Devices"   component={DevicesNavigator}   options={{ tabBarLabel: 'Devices' }} />
      <Tab.Screen
        name="Alerts"
        component={AlertsScreen}
        options={{
          tabBarLabel: 'Alerts',
          tabBarBadge: unackedAlerts > 0 ? unackedAlerts : undefined,
          tabBarBadgeStyle: styles.badge,
        }}
      />
      <Tab.Screen
        name="Messages"
        component={MessagesNavigator}
        options={{
          tabBarLabel: 'Messages',
          tabBarBadge: unreadMsgs > 0 ? unreadMsgs : undefined,
          tabBarBadgeStyle: styles.badge,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileNavigator}
        options={{ tabBarLabel: 'Profile' }}
      />
    </Tab.Navigator>
  );
};

// ─── Root (auth gate) ─────────────────────────────────────────────────────────
const AppNavigator = ({ navRef }) => {
  const { isAuthenticated, isServerConfigured, isLoading, user, biometricLocked, token } = useAuth();
  const { isDark } = useTheme();

  if (isLoading) return null;

  const MainWithUser = (props) => <MainNavigator {...props} user={user} />;

  // Token present but biometric still locked → show the unlock screen.
  const showLock = !!token && biometricLocked;

  return (
    <NavigationContainer
      ref={navRef}
      theme={{
        dark: isDark,
        colors: {
          primary:      C.primary,
          background:   C.bg,
          card:         C.surface,
          text:         C.text,
          border:       C.border,
          notification: C.offline,
        },
      }}
    >
      <RootStack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
        {!isServerConfigured
          ? <RootStack.Screen name="ServerSetup" component={ServerSetupScreen} />
          : showLock
            ? <RootStack.Screen name="Locked" component={BiometricLockScreen} />
            : isAuthenticated
              ? <RootStack.Screen name="Main"  component={MainWithUser} />
              : <RootStack.Screen name="Login" component={LoginScreen}  />}
      </RootStack.Navigator>
    </NavigationContainer>
  );
};

const styles = themed(() => ({
  tabBar: {
    backgroundColor:  CHROME.bg,            // always dark
    borderTopColor:   CHROME.border,
    borderTopWidth:   1,
    paddingTop:       S.xs,
    elevation:        16,
    shadowColor:      '#000',
    shadowOffset:     { width: 0, height: -3 },
    shadowOpacity:    0.25,
    shadowRadius:     12,
  },
  tabLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 0.3, flexShrink: 1 },
  badge:    { backgroundColor: C.offline, fontSize: 9, fontWeight: '800' },
}));

export default AppNavigator;
