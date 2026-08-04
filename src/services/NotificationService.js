/**
 * NotificationService — local push notifications for alerts and messages.
 *
 * Flow:
 *  1. Call `init()` once on app start.
 *  2. Call `seedAlerts` / `seedMessages` on the first poll so we don't replay
 *     existing items as "new".
 *  3. Call `checkAlerts` / `checkMessages` on every subsequent poll.
 *  4. Call `addTapListener` to navigate when a notification is tapped.
 */

let N = null;   // expo-notifications module (lazy-loaded)
try {
  N = require('expo-notifications');
} catch (_) {
  console.warn('[NotificationService] expo-notifications not installed.');
}

// ─── State ────────────────────────────────────────────────────────────────────
let _seenAlertIds  = new Set();   // alert ids already notified
let _seenMsgMap    = {};          // { userId: last_message_id }  ← id, not time
let _permGranted   = false;
let _initialised   = false;

// ─────────────────────────────────────────────────────────────────────────────

export const init = async () => {
  if (!N || _initialised) return;
  _initialised = true;

  // Show notifications even when the app is foregrounded
  N.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge:  true,
    }),
  });

  // Action buttons attached to alert notifications. Tapping them invokes
  // addActionListener handlers below without opening the app first.
  try {
    if (N.setNotificationCategoryAsync) {
      await N.setNotificationCategoryAsync('alert-actions', [
        {
          identifier: 'ACK',
          buttonTitle: 'Acknowledge',
          options: { opensAppToForeground: false },
        },
        {
          identifier: 'OPEN',
          buttonTitle: 'Open',
          options: { opensAppToForeground: true },
        },
      ]);
    }
  } catch (_) { /* category support varies by OS — ignore */ }

  // Request permission (Android 13+ needs POST_NOTIFICATIONS)
  try {
    const { status: existing } = await N.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await N.requestPermissionsAsync();
      finalStatus = status;
    }
    _permGranted = finalStatus === 'granted';
  } catch (e) {
    console.warn('[NotificationService] Permission error:', e.message);
    return;
  }

  if (!_permGranted) {
    console.warn('[NotificationService] Permission denied.');
    return;
  }

  // Android notification channels
  try {
    await N.setNotificationChannelAsync('alerts', {
      name:             'Network Alerts',
      description:      'Critical and warning alerts from monitored devices',
      importance:       N.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor:       '#ef4444',
      sound:            'default',
      enableVibrate:    true,
      enableLights:     true,
      showBadge:        true,
    });

    await N.setNotificationChannelAsync('messages', {
      name:         'Messages',
      description:  'Direct messages from team members',
      importance:   N.AndroidImportance.HIGH,
      sound:        'default',
      showBadge:    true,
      enableVibrate: true,
    });
  } catch (e) {
    console.warn('[NotificationService] Channel setup error:', e.message);
  }

  console.log('[NotificationService] Initialised, permission:', _permGranted);
};

// ─── Seed (call on first poll to avoid false-firing for existing data) ────────

export const seedAlerts = (alerts = []) => {
  alerts
    .filter((a) => !a.is_acknowledged && ['critical','warning'].includes(a.severity))
    .forEach((a) => _seenAlertIds.add(String(a.id)));
};

export const seedMessages = (conversations = [], myUserId) => {
  const me = String(myUserId ?? '');
  conversations.forEach((c) => {
    // Key by the other user's id; track the last message id we've seen
    const uid = String(c.user_id ?? c.other_user_id ?? '');
    if (uid) _seenMsgMap[uid] = String(c.id ?? '');
  });
};

// ─── Alert notifications ──────────────────────────────────────────────────────

export const checkAlerts = async (alerts = []) => {
  if (!N || !_permGranted) return;

  const active = alerts.filter(
    (a) => !a.is_acknowledged && ['critical','warning'].includes(a.severity),
  );
  const newOnes = active.filter((a) => !_seenAlertIds.has(String(a.id)));
  if (!newOnes.length) {
    // Refresh seen set (remove resolved/acked)
    _seenAlertIds = new Set(active.map((a) => String(a.id)));
    return;
  }

  active.forEach((a) => _seenAlertIds.add(String(a.id)));

  if (newOnes.length === 1) {
    const a = newOnes[0];
    // Build a "which device" label from whatever the alert payload has.
    // device_name + device_ip is the friendliest; fall back gracefully so
    // the notification is never just "Critical Alert" with no identifier.
    const device = [a.device_name, a.device_ip].filter(Boolean).join(' · ')
                || a.sys_name
                || a.host
                || a.ip_address;
    const icon  = a.severity === 'critical' ? '🔴' : '🟡';
    const title = device
      ? `${icon} ${_cap(a.severity)}: ${device}`
      : `${icon} ${_cap(a.severity)} Alert`;
    await _send('alerts', {
      title,
      body:  a.message || 'A monitored device needs attention.',
      data:  { screen: 'Alerts', alertId: a.id, kind: 'alert' },
      badge: active.length,
      categoryIdentifier: 'alert-actions',
    });
  } else {
    const crit = newOnes.filter((a) => a.severity === 'critical').length;
    // For the grouped notification, include up to three device names so the
    // user can see "which" without opening the app.
    const devices = newOnes
      .map((a) => a.device_name || a.device_ip || a.sys_name)
      .filter(Boolean);
    const summary = devices.length
      ? (devices.length <= 3
          ? devices.join(', ')
          : `${devices.slice(0, 3).join(', ')} +${devices.length - 3} more`)
      : `${crit} critical, ${newOnes.length - crit} warning`;
    await _send('alerts', {
      title: `⚠️ ${newOnes.length} New Alerts`,
      body:  summary,
      data:  { screen: 'Alerts', kind: 'alert-group' },
      badge: active.length,
      categoryIdentifier: 'alert-actions',
    });
  }
};

// ─── Message notifications ────────────────────────────────────────────────────

export const checkMessages = async (conversations = [], myUserId) => {
  if (!N || !_permGranted) return;

  const me = String(myUserId ?? '');

  // A conversation has a new incoming message when:
  //   - the last message was NOT sent by me (someone else wrote to me)
  //   - AND the message id changed since we last saw it
  const incoming = conversations.filter((c) => {
    const senderId = String(c.sender_id ?? '');
    return me && senderId !== me;   // message sent by someone else
  });

  const newConvs = incoming.filter((c) => {
    const uid  = String(c.user_id ?? c.other_user_id ?? '');
    const msgId = String(c.id ?? '');
    const prev  = _seenMsgMap[uid];
    return prev === undefined || msgId !== prev;
  });

  if (!newConvs.length) return;

  // Update seen map
  incoming.forEach((c) => {
    const uid = String(c.user_id ?? c.other_user_id ?? '');
    if (uid) _seenMsgMap[uid] = String(c.id ?? '');
  });

  if (newConvs.length === 1) {
    const c    = newConvs[0];
    const name = c.full_name || c.username || 'Someone';
    await _send('messages', {
      title: `💬 ${name}`,
      body:  c.last_message || c.message || 'Sent you a message.',
      data:  { screen: 'Messages', userId: c.user_id ?? c.other_user_id, userName: name },
      badge: incoming.length,
    });
  } else {
    const names = newConvs.map((c) => c.full_name || c.username).filter(Boolean).join(', ');
    await _send('messages', {
      title: `💬 ${newConvs.length} New Messages`,
      body:  names || 'You have new messages.',
      data:  { screen: 'Messages' },
      badge: incoming.length,
    });
  }
};

// ─── Tap listener ─────────────────────────────────────────────────────────────

export const addTapListener = (handler) => {
  if (!N) return () => {};
  const sub = N.addNotificationResponseReceivedListener((response) => {
    const data       = response?.notification?.request?.content?.data || {};
    const actionId   = response?.actionIdentifier;
    handler({ ...data, actionId });
  });
  return () => sub.remove();
};

/**
 * Register a side-effect that runs when the user taps the "Acknowledge"
 * button inside an alert notification. The callback receives the alert id
 * (or undefined for grouped notifications). Independent of addTapListener,
 * because acknowledge does not open the app.
 */
export const addActionListener = (handler) => {
  if (!N) return () => {};
  const sub = N.addNotificationResponseReceivedListener(async (response) => {
    const action = response?.actionIdentifier;
    if (action !== 'ACK') return;
    const data = response?.notification?.request?.content?.data || {};
    try { await handler(data); } catch (_) { /* swallow */ }
  });
  return () => sub.remove();
};

// ─── Badge ────────────────────────────────────────────────────────────────────

export const clearBadge = () => {
  if (!N) return;
  N.setBadgeCountAsync(0).catch(() => {});
};

// ─── Internal helpers ─────────────────────────────────────────────────────────

const _send = async (channelId, { title, body, data, badge, categoryIdentifier }) => {
  try {
    await N.scheduleNotificationAsync({
      content: {
        title,
        body,
        data:     data || {},
        badge:    badge ?? 1,
        sound:    'default',
        ...(categoryIdentifier ? { categoryIdentifier } : {}),
        // channelId is specified via the Android-specific wrapper
        ...(channelId ? { android: { channelId, priority: 'max' } } : {}),
      },
      trigger: null,   // fire immediately
    });
  } catch (err) {
    console.warn('[NotificationService] _send error:', err?.message);
  }
};

const _cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
