/**
 * BiometricService — wraps expo-local-authentication for FaceID / fingerprint
 * unlock at app launch. Gracefully no-ops if the module is not installed yet.
 *
 * Preference is stored in AsyncStorage under BIOMETRIC_ENABLED_KEY.
 *  - false / null → biometric prompt disabled
 *  - true         → prompt the user once per app foregrounding
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const BIOMETRIC_ENABLED_KEY = '@assetpulse_biometric_enabled';

let LA = null;
try { LA = require('expo-local-authentication'); } catch (_) {}

const isAvailable = async () => {
  if (!LA) return false;
  try {
    const has = await LA.hasHardwareAsync();
    if (!has) return false;
    const enrolled = await LA.isEnrolledAsync();
    return !!enrolled;
  } catch {
    return false;
  }
};

export const getBiometricSupport = async () => {
  const available = await isAvailable();
  if (!available || !LA) return { available: false, types: [] };
  try {
    const types = await LA.supportedAuthenticationTypesAsync();
    return { available: true, types };
  } catch {
    return { available: true, types: [] };
  }
};

export const isBiometricEnabled = async () => {
  try {
    const v = await AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY);
    return v === 'true';
  } catch {
    return false;
  }
};

export const setBiometricEnabled = async (enabled) => {
  try {
    await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, enabled ? 'true' : 'false');
  } catch { /* ignore */ }
};

/**
 * Prompt the user to authenticate. Resolves to true only on an explicit
 * successful result from the OS prompt.
 *
 * Fails CLOSED: any error while checking hardware/enrollment or while
 * running the prompt itself denies the unlock, rather than letting it
 * through. The only case that unlocks without a prompt is when biometric
 * hardware genuinely isn't available on the device — someone couldn't have
 * enabled the lock in the first place without it (see isAvailable() gating
 * in SettingsScreen), so that path can't be used to bypass a lock that's
 * actually protecting anything.
 */
export const authenticate = async (reason = 'Unlock AssetPulse') => {
  if (!LA) return true;
  try {
    const available = await isAvailable();
    if (!available) return true;
    const result = await LA.authenticateAsync({
      promptMessage: reason,
      cancelLabel: 'Use password',
      disableDeviceFallback: false,
    });
    return !!result?.success;
  } catch {
    // The prompt itself errored (interrupted, native crash, etc.) — deny.
    return false;
  }
};
