import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { login as apiLogin, setApiBaseUrl, getProfile, registerPushToken } from '../services/api';
import { TOKEN_STORAGE_KEY, REFRESH_TOKEN_STORAGE_KEY, USER_STORAGE_KEY, SERVER_URL_KEY } from '../config';
import { init as initNotifications } from '../services/NotificationService';
import { isBiometricEnabled, authenticate as biometricAuth } from '../services/BiometricService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user,      setUser]      = useState(null);
  const [token,     setToken]     = useState(null);
  const [serverUrl, setServerUrl] = useState(null);   // null = not yet configured
  const [isLoading, setIsLoading] = useState(true);
  const [biometricLocked, setBiometricLocked] = useState(false);

  // Stable ref so the on-mount effect can call refreshProfilePicture safely
  const refreshRef = useRef(null);

  /**
   * Refresh the profile picture from the server and merge it into the user state.
   * Safe to call at any time after login — silently ignores errors.
   */
  const refreshProfilePicture = useCallback(async () => {
    try {
      const { user: profileData } = await getProfile();
      if (profileData?.profile_picture !== undefined) {
        setUser((prev) => {
          if (!prev) return prev;
          const updated = { ...prev, profile_picture: profileData.profile_picture };
          AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updated)).catch(() => {});
          return updated;
        });
      }
    } catch {
      // Silently ignore — user still works without the photo
    }
  }, []);

  // Keep the ref in sync so the on-mount effect always has the latest version
  refreshRef.current = refreshProfilePicture;

  const registerExpoPushToken = useCallback(async () => {
    try {
      if (!Device.isDevice) return; // emulators can't get real push tokens
      const { status: existing } = await Notifications.getPermissionsAsync();
      const { status } = existing === 'granted'
        ? { status: existing }
        : await Notifications.requestPermissionsAsync();
      if (status !== 'granted') return;
      const { data: token } = await Notifications.getExpoPushTokenAsync({
        projectId: '1ad659a2-077f-4c60-8dca-e14e999e0d8e',
      });
      await registerPushToken(token);
    } catch {
      // Non-fatal — push won't work but app continues normally
    }
  }, []);

  // On mount: restore server URL + session
  useEffect(() => {
    const restore = async () => {
      try {
        const [storedUrl, storedToken, storedUser] = await Promise.all([
          AsyncStorage.getItem(SERVER_URL_KEY),
          AsyncStorage.getItem(TOKEN_STORAGE_KEY),
          AsyncStorage.getItem(USER_STORAGE_KEY),
        ]);

        if (storedUrl) {
          setApiBaseUrl(storedUrl);
          setServerUrl(storedUrl);
        }

        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
          // Refresh profile picture in background after restoring session
          setTimeout(() => refreshRef.current?.(), 1000);
          // Register push token in background (non-blocking)
          setTimeout(() => registerExpoPushToken(), 2000);

          // If the user enabled biometric unlock, gate the app until they pass.
          const needsBiometric = await isBiometricEnabled();
          if (needsBiometric) setBiometricLocked(true);
        }

        // Initialise notifications early so _permGranted is set before
        // the navigation polling loop starts firing checkMessages/checkAlerts.
        initNotifications().catch(() => {});
      } catch {
        // start fresh
      } finally {
        setIsLoading(false);
      }
    };
    restore();
  }, []);   // runs once on mount; uses refreshRef to avoid stale-closure issues

  /**
   * Save the chosen server URL and update the axios instance.
   * Called from ServerSetupScreen after successful verification.
   */
  const saveServer = useCallback(async (url) => {
    await AsyncStorage.setItem(SERVER_URL_KEY, url);
    setApiBaseUrl(url);
    setServerUrl(url);
  }, []);

  /**
   * Clear the server URL (allows user to reconfigure from Login screen).
   * Also clears the session so they must log in again.
   */
  const clearServer = useCallback(async () => {
    try {
      await Promise.all([
        AsyncStorage.removeItem(SERVER_URL_KEY),
        AsyncStorage.removeItem(TOKEN_STORAGE_KEY),
        AsyncStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY),
        AsyncStorage.removeItem(USER_STORAGE_KEY),
      ]);
    } catch {}
    setApiBaseUrl('');
    setServerUrl(null);
    setToken(null);
    setUser(null);
  }, []);

  const login = useCallback(async (username, password) => {
    const data = await apiLogin(username, password);
    const { token: newToken, refreshToken: newRefresh, user: newUser } = data;
    const writes = [
      AsyncStorage.setItem(TOKEN_STORAGE_KEY, newToken),
      AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(newUser)),
    ];
    if (newRefresh) writes.push(AsyncStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, newRefresh));
    await Promise.all(writes);
    setToken(newToken);
    setUser(newUser);
    // Fetch full profile (including profile_picture) right after login
    setTimeout(() => refreshRef.current?.(), 500);
    // Register push token after login
    setTimeout(() => registerExpoPushToken(), 1500);
  }, [registerExpoPushToken]);

  const logout = useCallback(async () => {
    try {
      await Promise.all([
        AsyncStorage.removeItem(TOKEN_STORAGE_KEY),
        AsyncStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY),
        AsyncStorage.removeItem(USER_STORAGE_KEY),
      ]);
    } catch {}
    setToken(null);
    setUser(null);
  }, []);

  // No auto-logout: the API layer no longer emits "session expired", and we
  // intentionally don't subscribe to it. Users stay signed in until they tap
  // Sign Out in Profile.

  const tryUnlock = useCallback(async () => {
    const ok = await biometricAuth('Unlock AssetPulse');
    if (ok) setBiometricLocked(false);
    return ok;
  }, []);

  const value = {
    user, token, serverUrl, isLoading,
    isAuthenticated: !!token && !biometricLocked,
    isServerConfigured: !!serverUrl,
    biometricLocked, tryUnlock,
    login, logout, saveServer, clearServer, refreshProfilePicture,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};

export default AuthContext;
