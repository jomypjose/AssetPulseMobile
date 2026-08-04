import React from 'react';
import { View, Text } from 'react-native';
import { CloudOff } from 'lucide-react-native';
import { themed, C, R, S } from '../theme';
import { formatStale } from '../services/OfflineCache';

/**
 * Shown when a screen is rendering the last-known cached snapshot because
 * the live fetch failed (see getDevices/getAlerts in services/api.js, which
 * fall back to OfflineCache and return { fromCache: true, cachedAt }).
 */
const StaleBanner = ({ cachedAt }) => (
  <View style={styles.row}>
    <CloudOff color={C.warning} size={13} strokeWidth={2} />
    <Text style={styles.text}>Showing cached data from {formatStale(cachedAt)}</Text>
  </View>
);

const styles = themed(() => ({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: S.xs,
    backgroundColor: C.warningBg, borderRadius: R.md,
    borderLeftWidth: 3, borderLeftColor: C.warning,
    paddingVertical: S.sm, paddingHorizontal: S.md,
    marginHorizontal: S.lg, marginTop: S.sm,
  },
  text: { fontSize: 12, color: C.warning, fontWeight: '500', flex: 1 },
}));

export default StaleBanner;
