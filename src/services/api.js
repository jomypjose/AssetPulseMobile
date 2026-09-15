import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SERVER_URL_KEY } from '../config';
import { cacheSet, cacheGet } from './OfflineCache';
import {
  getToken, setToken as setStoredToken,
  getRefreshToken, setRefreshToken as setStoredRefreshToken,
} from './tokenStorage';

// Tiny pub/sub so AuthContext can react to "session genuinely expired"
// without circular imports. Listeners receive no arguments.
const sessionExpiredListeners = new Set();
export const onSessionExpired = (cb) => {
  sessionExpiredListeners.add(cb);
  return () => sessionExpiredListeners.delete(cb);
};
const emitSessionExpired = () => {
  sessionExpiredListeners.forEach((cb) => { try { cb(); } catch (_) {} });
};

// ─── Axios instance ───────────────────────────────────────────────────────────
// baseURL starts empty and is set at runtime via setApiBaseUrl() once the user
// has configured their server (stored in AsyncStorage under SERVER_URL_KEY).
const api = axios.create({
  baseURL: '',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    // The server hands tokens back in httpOnly cookies by default (browser
    // clients). React Native has no cookie jar we can trust, so we opt into
    // the body transport: /auth/login and /auth/refresh then return
    // { token, refreshToken } in the JSON payload. Without this header the
    // response carries no token and setToken() gets undefined.
    'X-Token-Transport': 'body',
  },
});

/**
 * Update the axios baseURL.  Call this after reading SERVER_URL_KEY from
 * AsyncStorage or after the user saves a new server address.
 */
export const setApiBaseUrl = (url) => {
  api.defaults.baseURL = url;
};

export const getApiBaseUrl = () => api.defaults.baseURL || '';

/**
 * Load the saved server URL from AsyncStorage and apply it to the axios
 * instance.  Returns the URL string, or null if none is saved yet.
 */
export const loadApiBaseUrl = async () => {
  try {
    const url = await AsyncStorage.getItem(SERVER_URL_KEY);
    if (url) setApiBaseUrl(url);
    return url;
  } catch {
    return null;
  }
};

// ─── JWT expiry helpers ──────────────────────────────────────────────────────
// Decode the access token's `exp` claim so we can renew it *before* it expires,
// rather than waiting for the server to bounce a request with 401. Pure parsing
// only — no signature verification (that's the server's job).
// Minimal base64 decoder — fallback for JS engines without a global atob().
const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const decodeBase64 = (input) => {
  const str = input.replace(/=+$/, '');
  let output = '';
  let bits = 0;
  let buffer = 0;
  for (let i = 0; i < str.length; i++) {
    const idx = B64_CHARS.indexOf(str[i]);
    if (idx === -1) continue;
    buffer = (buffer << 6) | idx;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }
  return output;
};

const decodeJwtExpMs = (token) => {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = typeof atob === 'function' ? atob(b64) : decodeBase64(b64);
    if (!json) return null;
    const { exp } = JSON.parse(json);
    return exp ? exp * 1000 : null;
  } catch {
    return null;
  }
};

// Renew once the token is within this window of expiring (access tokens live
// 30m server-side). 60s of skew comfortably covers clock drift + request time.
const EXPIRY_SKEW_MS = 60 * 1000;
const isTokenExpiringSoon = (token) => {
  const expMs = decodeJwtExpMs(token);
  if (expMs == null) return false; // can't tell → don't pre-empt, let 401 handle it
  return Date.now() >= expMs - EXPIRY_SKEW_MS;
};

// ─── Silent token refresh ────────────────────────────────────────────────────
// The access token is renewed proactively (request interceptor) and reactively
// (on a 401 fallback). Both paths funnel through one shared in-flight promise so
// only ONE `/auth/refresh` is ever in flight at a time. This matters: the server
// rotates refresh tokens and treats a reused token as a breach (revoking the
// whole family). Firing two concurrent refreshes with the same token would trip
// that and permanently kill the session — the bug this dedup prevents.
//
// The user is never auto-logged-out: if a refresh genuinely fails (network blip,
// or a refresh token revoked/expired beyond its 7-day window) we keep the
// session in place and let the failing request surface its error so they can
// pull-to-refresh. They sign out manually from Profile.

let refreshPromise = null;

const performRefresh = async () => {
  const stored = await getRefreshToken();
  // Legacy sessions (saved before refresh tokens were wired in) or a wiped
  // refresh token can't be renewed — surface a clean error, no logout.
  if (!stored) throw new Error('No refresh token available');
  const baseURL = api.defaults.baseURL;
  const res = await axios.post(
    `${baseURL}/auth/refresh`,
    { refreshToken: stored },
    { timeout: 15000, headers: { 'X-Token-Transport': 'body' } },
  );
  const { token: newToken, refreshToken: newRefresh } = res.data || {};
  if (!newToken) throw new Error('Refresh response missing token');
  await setStoredToken(newToken);
  if (newRefresh) await setStoredRefreshToken(newRefresh);
  return newToken;
};

// Dedup wrapper: concurrent callers share the same in-flight refresh.
const refreshAccessToken = () => {
  if (!refreshPromise) {
    refreshPromise = performRefresh().finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
};

// Request interceptor: proactively renew an expiring token, then attach it.
api.interceptors.request.use(
  async (config) => {
    const url = config.url || '';
    const isAuthCall = url.includes('/auth/login') || url.includes('/auth/refresh');
    try {
      let token = await getToken();

      // If the access token is expired / about to expire, trade the refresh
      // token in for a fresh one *before* sending — so the request doesn't
      // bounce with "Access token expired". Only when a refresh token exists.
      if (!isAuthCall && token && isTokenExpiringSoon(token)) {
        const hasRefresh = await getRefreshToken();
        if (hasRefresh) {
          try {
            token = await refreshAccessToken();
          } catch {
            // Proactive refresh failed — send the existing token and let the
            // 401 fallback / error surface naturally. Don't block the request.
          }
        }
      }

      if (token) config.headers.Authorization = `Bearer ${token}`;
    } catch {
      // If AsyncStorage read fails, continue without token
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor: reactive fallback. If a request still 401s (e.g. the
// token expired mid-flight, or the proactive check couldn't decode it), refresh
// once and retry. Shares the same in-flight refresh as the proactive path.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error?.config;
    const status = error?.response?.status;
    const url = original?.url || '';
    const isAuthCall = url.includes('/auth/login') || url.includes('/auth/refresh');

    if (status === 401 && original && !original._retry && !isAuthCall) {
      original._retry = true;
      try {
        const newToken = await refreshAccessToken();
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch (refreshErr) {
        // Deliberately do NOT clear tokens or force logout — keep the session
        // so the user can retry. They sign out manually from Profile.
      }
    }

    const message =
      error?.response?.data?.message ||
      error?.response?.data?.error ||
      error?.message ||
      'An unexpected error occurred';
    return Promise.reject(new Error(message));
  },
);

// ─── Auth ─────────────────────────────────────────────────────────────────────

/**
 * Authenticate with username + password.
 * @returns {{ token: string, user: object }}
 */
export const login = async (username, password) => {
  const response = await api.post('/auth/login', { username, password });
  return response.data; // { token, refreshToken, user }
};

/**
 * End the session server-side: revokes the whole refresh-token family and
 * closes the session row. Without this, signing out only forgets the tokens
 * locally — the refresh token stays valid for its full 7 days and the session
 * keeps occupying a slot against MAX_SESSIONS_PER_USER.
 * Best-effort: the caller clears local state regardless of the outcome.
 */
export const logout = async () => {
  const refreshToken = await getRefreshToken();
  await api.post('/auth/logout', refreshToken ? { refreshToken } : {});
};

// ─── Network / Devices ───────────────────────────────────────────────────────

/**
 * Fetch devices, optionally filtered by monitoring_status.
 * @param {object} params  e.g. { monitoring_status: 'Online' }
 * @returns {{ assets: Array }}
 */
export const getDevices = async (params = {}) => {
  try {
    const response = await api.get('/network', { params: { limit: 10000, ...params } });
    const allAssets = response.data?.data || [];
    const monitoredAssets = allAssets.filter((device) => !!device.enable_monitoring);
    const result = { assets: monitoredAssets };
    cacheSet('devices', result);
    return result;
  } catch (err) {
    const snap = await cacheGet('devices');
    if (snap?.value) return { ...snap.value, fromCache: true, cachedAt: snap.ts };
    throw err;
  }
};

/**
 * Fetch a single device's full detail.
 * @param {string|number} id
 * @returns {{ device: object }}
 */
export const getDeviceDetail = async (id) => {
  const response = await api.get(`/network/${id}/detail`);
  return response.data; // { device: { ...base, snmp_uptime, extra: { cpu_count, memory_used, memory_total } } }
};

// ─── Alerts ──────────────────────────────────────────────────────────────────

/**
 * Fetch alerts, optionally filtered.
 * @param {object} params  e.g. { severity: 'critical' }
 * @returns {{ alerts: Array }}
 */
export const getAlerts = async (params = {}) => {
  try {
    const response = await api.get('/alerts', { params });
    const alerts = (response.data?.alerts || []).map((a) => ({
      ...a,
      is_acknowledged: a.status === 'acknowledged' || a.status === 'resolved',
    }));
    const result = { ...response.data, alerts };
    cacheSet('alerts', result);
    return result;
  } catch (err) {
    const snap = await cacheGet('alerts');
    if (snap?.value) return { ...snap.value, fromCache: true, cachedAt: snap.ts };
    throw err;
  }
};

/**
 * Bulk-acknowledge alerts by ID array.
 * @param {Array<string|number>} ids
 */
export const acknowledgeAlerts = async (ids) => {
  const response = await api.post('/alerts/bulk-acknowledge', { ids, alert_ids: ids });
  return response.data;
};

// ─── Dashboard ───────────────────────────────────────────────────────────────

/**
 * Fetch dashboard summary stats.
 * @returns {{ monitoring: { total, online, offline, warning }, tickets: { pending } }}
 */
export const getDashboardStats = async () => {
  const response = await api.get('/dashboard/stats');
  return response.data;
};

// ─── Messaging ────────────────────────────────────────────────────────────────

/**
 * Fetch all conversations (last message per user thread).
 * @returns {Array} conversations
 */
export const getConversations = async () => {
  const response = await api.get('/messages/conversations');
  // Filter out system notification threads — only show real user-to-user messages
  return (response.data || []).filter((c) => c.type !== 'notification');
};

/**
 * Fetch messages in a conversation with a specific user.
 * @param {string|number} userId
 * @returns {Array} messages
 */
export const getConversationMessages = async (userId) => {
  const response = await api.get(`/messages/conversation/${userId}`);
  return response.data || [];
};

/**
 * Send a message to a recipient.
 * @param {string|number} recipientId
 * @param {string} message
 * @param {string} subject
 */
export const sendDirectMessage = async (recipientId, message, subject = '') => {
  const response = await api.post('/messages', {
    recipient_id: recipientId,
    message,
    subject,
    type: 'message',
  });
  return response.data;
};

/**
 * Send a message with a file attachment.
 * @param {string|number} recipientId
 * @param {string}        message      — body text (may be empty)
 * @param {object}        file         — { uri, mimeType, name }
 * @param {string}        subject
 */
export const sendMessageWithAttachment = async (recipientId, message, file, subject = '') => {
  // Use native fetch for multipart — axios on React Native interferes with the
  // auto-generated multipart boundary when Content-Type is set manually.
  const token = await getToken();
  const baseURL = api.defaults.baseURL;

  const formData = new FormData();
  formData.append('recipient_id', String(recipientId));
  formData.append('message',      message || ' ');
  formData.append('subject',      subject);
  formData.append('attachment', {
    uri:  file.uri,
    type: file.mimeType || 'application/octet-stream',
    name: file.name     || 'attachment',
  });

  const res = await fetch(`${baseURL}/messages/with-attachment`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}` },
    body:    formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Upload failed (${res.status})`);
  }
  return res.json();
};

/**
 * Fetch list of all users (for compose / new chat).
 * @returns {Array} users
 */
export const getMessageUsersList = async () => {
  const response = await api.get('/messages/users/list');
  return response.data || [];
};

/**
 * Get count of unread messages.
 * @returns {{ count: number }}
 */
export const getUnreadMessageCount = async () => {
  const response = await api.get('/messages/unread-count', { params: { type: 'message' } });
  return response.data;
};

/**
 * Mark a message (or all) as read.
 * @param {string|number} id  — message id, or 'all'
 */
export const markMessageRead = async (id) => {
  const response = await api.put(`/messages/read/${id}`, { type: 'message' });
  return response.data;
};

// ─── Profile ──────────────────────────────────────────────────────────────────

/**
 * Fetch the current user's full profile, including profile_picture path.
 * @returns {{ user: object }}
 */
export const getProfile = async () => {
  const response = await api.get('/profile');
  return response.data; // { user: { id, username, full_name, role, profile_picture, ... } }
};

// ─── Branch Map ───────────────────────────────────────────────────────────────

// MiniMap (Dashboard) and MapScreen both call getBranchMapData() on mount,
// often within moments of each other (open Dashboard → tap into full map).
// Share one in-flight request plus a short-lived cache so that doesn't turn
// into two full network round-trips for identical data.
const BRANCH_MAP_CACHE_MS = 20000;
let branchMapPromise = null;
let branchMapCache = null; // { data, ts }

/**
 * Fetch branch locations for the map (only branches with lat/lng set).
 * @returns {{ branches: Array<{ branch_code, branch_name, state, latitude, longitude, office_type, network_count }>, unmappedCount: number }}
 */
export const getBranchMapData = async () => {
  if (branchMapCache && Date.now() - branchMapCache.ts < BRANCH_MAP_CACHE_MS) {
    return branchMapCache.data;
  }
  if (branchMapPromise) return branchMapPromise;

  branchMapPromise = api.get('/branches/map-data')
    .then((response) => {
      branchMapCache = { data: response.data, ts: Date.now() };
      return response.data;
    })
    .finally(() => { branchMapPromise = null; });

  return branchMapPromise;
};

// ─── Branches & branch assets ────────────────────────────────────────────────
export const getBranches = async (search = '') => {
  const response = await api.get('/branches', { params: search ? { search } : {} });
  // Server shape: { branches: [...] }. Fall back to other shapes defensively.
  const d = response.data;
  if (Array.isArray(d)) return d;
  return d?.branches || d?.data || [];
};

/**
 * Fixed assets — furniture / facility items (AC, Safe Locker, Chairs, UPS,
 * Generator …). Server-side these live in the same `hardware` table but under
 * asset types whose category is `fixed`, which the `onlyFixed` flag selects.
 *
 * `/branches/:code/assets` deliberately excludes them, so a branch's fixed
 * assets have to be fetched separately.
 *
 * @param {string} [branchCode] narrow to one branch. `/hardware` ignores
 *   `branch_code`, so we pass the code as a `search` term (which does cover
 *   branch_code server-side) and then re-filter exactly — search is a
 *   substring match, so "100_A" would otherwise also return "100_A6".
 */
export const getFixedAssets = async (branchCode) => {
  const params = { onlyFixed: true, limit: 10000 };
  if (branchCode) params.search = branchCode;
  const response = await api.get('/hardware', { params });
  const list = response.data?.data || response.data?.hardware
    || (Array.isArray(response.data) ? response.data : []);
  return branchCode
    ? list.filter((a) => a.branch_code === branchCode)
    : list;
};

export const getBranchAssets = async (branchCode) => {
  const [response, fixed] = await Promise.all([
    api.get(`/branches/${branchCode}/assets`),
    // Non-fatal: a fixed-assets failure shouldn't blank the whole branch page.
    getFixedAssets(branchCode).catch(() => []),
  ]);
  // Server shape: { data: { branch, hardware, software, network } }.
  // Older / alternative shape: { branch, hardware, software, network } at root.
  const root = response.data?.data || response.data || {};

  // The branch endpoint's `hardware` array is the whole hardware table for the
  // branch, which includes fixed-category rows — so without this they'd render
  // twice, once under Hardware and again under Fixed assets.
  const fixedIds = new Set(fixed.map((a) => a.id));
  const hardware = (root.hardware || []).filter((a) => !fixedIds.has(a.id));

  return {
    branch:   root.branch,
    hardware,
    software: root.software || [],
    network:  root.network  || [],
    fixed,
  };
};

// ─── Tickets ─────────────────────────────────────────────────────────────────
export const getTickets = async (params = {}) => {
  const response = await api.get('/tickets', { params });
  return response.data;
};

export const createTicket = async (payload) => {
  const response = await api.post('/tickets', payload);
  return response.data;
};

export const fulfillTicket = async (id, payload) => {
  const response = await api.put(`/tickets/${id}/fulfill`, payload);
  return response.data;
};

export const approveTicketBSS = async (id, payload = {}) => {
  const response = await api.put(`/tickets/${id}/approve-bss`, payload);
  return response.data;
};

export const approveTicketCH = async (id, payload = {}) => {
  const response = await api.put(`/tickets/${id}/approve-ch`, payload);
  return response.data;
};

export const confirmTicketReceipt = async (id, payload = {}) => {
  const response = await api.post(`/tickets/${id}/confirm`, payload);
  return response.data;
};

// ─── Service Tickets ─────────────────────────────────────────────────────────
export const getServiceTickets = async (params = {}) => {
  const response = await api.get('/service-tickets', { params });
  return response.data;
};

export const getServiceTicketSummary = async () => {
  const response = await api.get('/service-tickets/summary');
  return response.data;
};

export const searchServiceAssets = async (params = {}) => {
  const response = await api.get('/service-tickets/asset-search', { params });
  return response.data;
};

export const createServiceTicket = async (payload) => {
  const response = await api.post('/service-tickets', payload);
  return response.data;
};

export const approveServiceTicket = async (id, payload = {}) => {
  const response = await api.put(`/service-tickets/${id}/approve`, payload);
  return response.data;
};

export const assignServiceTicket = async (id, payload = {}) => {
  const response = await api.put(`/service-tickets/${id}/assign`, payload);
  return response.data;
};

export const startServiceTicket = async (id, payload = {}) => {
  const response = await api.put(`/service-tickets/${id}/start`, payload);
  return response.data;
};

export const resolveServiceTicket = async (id, payload = {}) => {
  const response = await api.put(`/service-tickets/${id}/resolve`, payload);
  return response.data;
};

export const closeServiceTicket = async (id, payload = {}) => {
  const response = await api.put(`/service-tickets/${id}/close`, payload);
  return response.data;
};

// ─── Change Requests ─────────────────────────────────────────────────────────
export const getChangeRequests = async (params = {}) => {
  const response = await api.get('/change-requests', { params });
  return response.data;
};

export const getChangeRequestSummary = async () => {
  const response = await api.get('/change-requests/summary');
  return response.data;
};

export const createChangeRequest = async (payload) => {
  const response = await api.post('/change-requests', payload);
  return response.data;
};

export const reviewChangeRequest = async (id, payload = {}) => {
  const response = await api.put(`/change-requests/${id}/review`, payload);
  return response.data;
};

export const approveChangeRequest = async (id, payload = {}) => {
  const response = await api.put(`/change-requests/${id}/approve`, payload);
  return response.data;
};

export const implementChangeRequest = async (id, payload = {}) => {
  const response = await api.put(`/change-requests/${id}/implement`, payload);
  return response.data;
};

export const cancelChangeRequest = async (id, payload = {}) => {
  const response = await api.put(`/change-requests/${id}/cancel`, payload);
  return response.data;
};

// ─── Daily Jobs ──────────────────────────────────────────────────────────────
export const getJobs = async (date) => {
  const response = await api.get('/jobs', { params: date ? { date } : {} });
  return response.data;
};

export const createJob = async (payload) => {
  const response = await api.post('/jobs', payload);
  return response.data;
};

export const closeJob = async (id, solution_description) => {
  const response = await api.put(`/jobs/${id}/close`, { solution_description });
  return response.data;
};

// ─── Global search (AI) ──────────────────────────────────────────────────────
export const globalSearch = async (query) => {
  const response = await api.get('/search', { params: { q: query } });
  return response.data;
};

// ─── Expiry digest ───────────────────────────────────────────────────────────
export const getExpiringLicenses = async () => {
  const response = await api.get('/dashboard/expiring-licenses');
  return response.data;
};

export const getAMCs = async (params = {}) => {
  const response = await api.get('/amc', { params });
  return response.data;
};

// ─── Device metrics (sparklines) ─────────────────────────────────────────────
export const getDeviceMetrics = async (id, range = '1h') => {
  const response = await api.get(`/network/${id}/metrics`, { params: { range } });
  return response.data;
};

// ─── Maintenance mode toggle ─────────────────────────────────────────────────
export const setMaintenanceMode = async (id, payload) => {
  const response = await api.patch(`/network/${id}/maintenance`, payload);
  return response.data;
};

// ─── Asset lookup (for scanner) ──────────────────────────────────────────────
export const getHardwareAssetById = async (id) => {
  const response = await api.get(`/hardware/${id}`);
  return response.data;
};

export const getSoftwareAssetById = async (id) => {
  const response = await api.get(`/software/${id}`);
  return response.data;
};

// ─── Asset photo upload ──────────────────────────────────────────────────────
export const uploadAssetPhoto = async (id, file) => {
  const token = await getToken();
  const baseURL = api.defaults.baseURL;

  const fd = new FormData();
  fd.append('photo', {
    uri:  file.uri,
    type: file.mimeType || 'image/jpeg',
    name: file.name || 'photo.jpg',
  });

  const res = await fetch(`${baseURL}/hardware/${id}/photo`, {
    method:  'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body:    fd,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Upload failed (${res.status})`);
  }
  return res.json();
};

// ─── Acknowledge a single alert ──────────────────────────────────────────────
export const acknowledgeAlert = async (id) => {
  const response = await api.patch(`/alerts/${id}/acknowledge`);
  return response.data;
};

// ─── Resolve a single alert ──────────────────────────────────────────────────
export const resolveAlert = async (id) => {
  const response = await api.patch(`/alerts/${id}/resolve`);
  return response.data;
};

// ─── Register / clear mobile push token ─────────────────────────────────────
export const registerPushToken = async (token) => {
  const response = await api.put('/auth/push-token', { token });
  return response.data;
};

export default api;
