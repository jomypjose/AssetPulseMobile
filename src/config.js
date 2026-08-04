// ─────────────────────────────────────────────────────────────────────────────
// AssetPulse Mobile — Configuration
//
// The server URL is no longer baked in at build time.
// Users enter their AssetPulse server address on first launch; it is stored
// in AsyncStorage under SERVER_URL_KEY and loaded dynamically into the API
// client via setApiBaseUrl() in api.js.
// ─────────────────────────────────────────────────────────────────────────────

// How often screens auto-refresh data (milliseconds)
export const POLL_INTERVAL = 30000;

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
