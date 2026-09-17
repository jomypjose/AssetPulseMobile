// ─────────────────────────────────────────────────────────────────────────────
// AssetPulse Mobile — Configuration
//
// The server URL is no longer baked in at build time.
// Users enter their AssetPulse server address on first launch; it is stored
// in AsyncStorage under SERVER_URL_KEY and loaded dynamically into the API
// client via setApiBaseUrl() in api.js.
// ─────────────────────────────────────────────────────────────────────────────

// How often screens auto-refresh data (milliseconds).
// These only tick while the relevant screen is focused AND the app is in the
// foreground — see src/hooks/usePolling.js. Before that hook existed, every
// interval below ran concurrently and forever, including in the background,
// which was the app's single biggest battery cost.
export const POLL_INTERVAL = 30000;

// Chat is the one screen where a slow refresh is actually noticeable, so it
// keeps the tightest interval. It is also the most expensive, which is why it
// must not run unfocused.
export const CHAT_POLL_MS          = 10000;
export const CONVERSATIONS_POLL_MS = 15000;

// Tab-bar unread/alert badges. App-wide, so this one is foreground-gated only.
export const BADGE_POLL_MS = 30000;

// AsyncStorage keys
export const USER_STORAGE_KEY          = '@assetpulse_user';
export const SERVER_URL_KEY            = '@assetpulse_server_url';

// Legacy AsyncStorage keys — tokens used to live here before being moved to
// expo-secure-store (see src/services/tokenStorage.js), which migrates any
// value found under these keys on first read after upgrade.
export const LEGACY_TOKEN_STORAGE_KEY         = '@assetpulse_token';
export const LEGACY_REFRESH_TOKEN_STORAGE_KEY = '@assetpulse_refresh_token';

// Placeholder — real value is injected at runtime via setApiBaseUrl()
export const API_BASE_URL = '';
