// ─────────────────────────────────────────────────────────────────────────────
// Secure token storage — access/refresh tokens live in the platform Keychain
// (iOS) / Keystore-backed EncryptedSharedPreferences (Android) via
// expo-secure-store, instead of AsyncStorage's plaintext SQLite/plist. A
// rooted device, ADB backup, or filesystem-level read can no longer lift a
// live session straight off disk.
//
// One-time migration: earlier builds stored these under AsyncStorage keys
// '@assetpulse_token' / '@assetpulse_refresh_token'. On first read after
// upgrade we move any value found there into SecureStore and delete the
// plaintext copy.
// ─────────────────────────────────────────────────────────────────────────────
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LEGACY_TOKEN_STORAGE_KEY, LEGACY_REFRESH_TOKEN_STORAGE_KEY } from '../config';

const TOKEN_KEY = 'assetpulse_token';
const REFRESH_KEY = 'assetpulse_refresh_token';
const LEGACY_TOKEN_KEY = LEGACY_TOKEN_STORAGE_KEY;
const LEGACY_REFRESH_KEY = LEGACY_REFRESH_TOKEN_STORAGE_KEY;

const migrateLegacy = async (secureKey, legacyKey) => {
  try {
    const legacyValue = await AsyncStorage.getItem(legacyKey);
    if (legacyValue) {
      await SecureStore.setItemAsync(secureKey, legacyValue);
      await AsyncStorage.removeItem(legacyKey);
      return legacyValue;
    }
  } catch {
    // ignore — fall through to null
  }
  return null;
};

const getSecure = async (secureKey, legacyKey) => {
  const value = await SecureStore.getItemAsync(secureKey);
  if (value) return value;
  return migrateLegacy(secureKey, legacyKey);
};

export const getToken = () => getSecure(TOKEN_KEY, LEGACY_TOKEN_KEY);
export const setToken = (value) => SecureStore.setItemAsync(TOKEN_KEY, value);
export const removeToken = () => SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});

export const getRefreshToken = () => getSecure(REFRESH_KEY, LEGACY_REFRESH_KEY);
export const setRefreshToken = (value) => SecureStore.setItemAsync(REFRESH_KEY, value);
export const removeRefreshToken = () => SecureStore.deleteItemAsync(REFRESH_KEY).catch(() => {});
