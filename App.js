import React, { useRef, useEffect } from 'react';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import AppNavigator from './src/navigation';
import AnimatedSplash from './src/components/AnimatedSplash';
import {
  init as initNotifications,
  clearBadge,
  addTapListener,
  addActionListener,
} from './src/services/NotificationService';
import { acknowledgeAlert } from './src/services/api';

// ─── Inner shell — has access to AuthContext ──────────────────────────────────
const AppShell = ({ navRef }) => {
  const { isLoading } = useAuth();

  // Boot notifications on first render
  useEffect(() => { initNotifications(); }, []);

  // Clear badge every time app is foregrounded (simple: on mount)
  useEffect(() => { clearBadge(); }, []);

  // "Acknowledge" action button on alert notifications → POST to API.
  useEffect(() => {
    return addActionListener(async (data) => {
      if (data?.alertId) {
        try { await acknowledgeAlert(data.alertId); } catch (_) { /* swallow */ }
      }
    });
  }, []);

  // Notification tap → navigate to the right screen
  useEffect(() => {
    return addTapListener((data) => {
      if (!data?.screen || !navRef?.current) return;
      setTimeout(() => {
        try {
          if (data.screen === 'Alerts') {
            navRef.current.navigate('Main', { screen: 'Alerts' });
          } else if (data.screen === 'Messages') {
            navRef.current.navigate('Main', {
              screen: 'Messages',
              params: data.userId
                ? { screen: 'Chat', params: { userId: data.userId, userName: data.userName || 'Message' } }
                : undefined,
            });
          }
        } catch (_) { /* navigation may not be ready */ }
      }, 500);
    });
  }, [navRef]);

  return (
    <AnimatedSplash visible={isLoading}>
      <AppNavigator navRef={navRef} />
    </AnimatedSplash>
  );
};

/**
 * ThemeShell — sits inside ThemeProvider and forces the AuthProvider +
 * entire app tree to remount when the colour scheme changes.
 *
 * Because React Native's StyleSheet.create() bakes colour values at call
 * time, a full remount is the simplest way to ensure every screen picks up
 * the correct theme tokens when the user switches light ↔ dark on their
 * device.  Theme changes are rare in practice, so the UX impact is minimal.
 */
const ThemeShell = () => {
  const { scheme } = useTheme();
  const navRef     = useRef(null);

  // Reset navRef when theme changes so it doesn't hold a stale ref
  // to the old NavigationContainer after remount.
  useEffect(() => {
    navRef.current = null;
  }, [scheme]);

  return (
    // key={scheme} forces a full remount of the AuthProvider + AppShell
    // when the colour scheme changes, ensuring StyleSheet values are refreshed.
    <AuthProvider key={scheme}>
      <AppShell navRef={navRef} />
    </AuthProvider>
  );
};

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <ThemeProvider>
      <ThemeShell />
    </ThemeProvider>
  );
}
