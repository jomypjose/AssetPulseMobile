/**
 * OfflineCache — lightweight AsyncStorage wrapper that lets screens render
 * the last-known data when the server / network is unreachable.
 *
 * Each cached payload is wrapped with a timestamp so the consumer can decide
 * whether the snapshot is stale. Cache is best-effort: failures are silenced.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = '@assetpulse_cache:';

export const cacheSet = async (key, value) => {
  try {
    const payload = JSON.stringify({ ts: Date.now(), value });
    await AsyncStorage.setItem(PREFIX + key, payload);
  } catch { /* ignore */ }
};

export const cacheGet = async (key) => {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.ts) return parsed;
  } catch { /* ignore */ }
  return null;
};

export const cacheClear = async (key) => {
  try { await AsyncStorage.removeItem(PREFIX + key); } catch { /* ignore */ }
};

/**
 * Pretty-prints "how stale" a cached snapshot is.
 */
export const formatStale = (ts) => {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};
