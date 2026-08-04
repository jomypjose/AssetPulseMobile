import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MapPin, ChevronRight, Server } from 'lucide-react-native';
import StatusBadge from './StatusBadge';
import { themed, C, R, S, cardShadow, STATUS_COLOR } from '../theme';

// ─── Mini metric bar ──────────────────────────────────────────────────────────
const MetricBar = ({ label, value, accentColor }) => {
  const pct = Math.min(100, Math.max(0, value ?? 0));
  const color =
    pct >= 80 ? C.offline :
    pct >= 60 ? C.warning :
    accentColor || C.primary;

  return (
    <View style={bar.row}>
      <Text style={bar.label}>{label}</Text>
      <View style={bar.track}>
        <View style={[bar.fill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={[bar.pct, { color }]}>{Math.round(pct)}%</Text>
    </View>
  );
};

const bar = themed(() => ({
  row:   { flexDirection: 'row', alignItems: 'center', gap: S.sm, marginTop: 5 },
  label: { fontSize: 10, color: C.textDim, width: 28, fontWeight: '700', letterSpacing: 0.4 },
  track: { flex: 1, height: 4, backgroundColor: C.bg, borderRadius: R.full, overflow: 'hidden' },
  fill:  { height: '100%', borderRadius: R.full },
  pct:   { fontSize: 10, fontWeight: '700', width: 30, textAlign: 'right' },
}));

// ─── Card ─────────────────────────────────────────────────────────────────────
const DeviceCard = ({ device, onPress }) => {
  const statusColor = STATUS_COLOR[device.monitoring_status] || C.border;
  const hasMetrics  = device.cpu_usage != null || device.memory_usage != null;

  const formatLastSeen = (ts) => {
    if (!ts) return null;
    const diff = Date.now() - new Date(ts).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1)  return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  const lastSeen = formatLastSeen(device.last_seen);

  return (
    <TouchableOpacity
      style={[styles.card, { borderLeftColor: statusColor }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* ── Top row ── */}
      <View style={styles.topRow}>
        <View style={[styles.iconBox, { backgroundColor: `${statusColor}18` }]}>
          <Server color={statusColor} size={16} strokeWidth={1.8} />
        </View>

        <View style={styles.topMid}>
          <Text style={styles.ipText}>{device.ip_address}</Text>
          {device.sys_name ? (
            <Text style={styles.nameText} numberOfLines={1}>{device.sys_name}</Text>
          ) : null}
        </View>

        <View style={styles.topRight}>
          <StatusBadge status={device.monitoring_status} size="sm" />
          <ChevronRight color={C.textDim} size={15} strokeWidth={2} />
        </View>
      </View>

      {/* ── Location ── */}
      {device.sys_location ? (
        <View style={styles.locationRow}>
          <MapPin color={C.textDim} size={11} strokeWidth={2} />
          <Text style={styles.locationText} numberOfLines={1}>{device.sys_location}</Text>
        </View>
      ) : null}

      {/* ── Metric bars ── */}
      {hasMetrics && (
        <View style={styles.metrics}>
          {device.cpu_usage    != null && <MetricBar label="CPU" value={device.cpu_usage}    accentColor={C.primary} />}
          {device.memory_usage != null && <MetricBar label="MEM" value={device.memory_usage} accentColor={C.purple} />}
        </View>
      )}

      {/* ── Footer ── */}
      {(lastSeen || device.vendor) && (
        <View style={styles.footer}>
          {device.vendor ? (
            <Text style={styles.vendor} numberOfLines={1}>{device.vendor}</Text>
          ) : <View />}
          {lastSeen ? (
            <Text style={styles.lastSeen}>{lastSeen}</Text>
          ) : null}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = themed(() => ({
  card: {
    backgroundColor: C.card,
    borderRadius: R.md,
    padding: S.lg,
    borderWidth: 1,
    borderColor: C.border,
    borderLeftWidth: 3,
    ...cardShadow,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.sm,
    marginBottom: S.xs,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: R.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  topMid: {
    flex: 1,
    marginRight: S.xs,
  },
  ipText: {
    fontSize: 15,
    fontWeight: '700',
    color: C.text,
    letterSpacing: 0.2,
  },
  nameText: {
    fontSize: 11,
    color: C.textMuted,
    marginTop: 1,
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.xs,
    flexShrink: 0,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  locationText: {
    fontSize: 11,
    color: C.textDim,
    flex: 1,
  },
  metrics: {
    marginTop: S.xs,
    gap: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: S.sm,
    paddingTop: S.sm,
    borderTopWidth: 1,
    borderTopColor: C.borderFaint,
  },
  vendor: {
    fontSize: 10,
    color: C.textDim,
    fontWeight: '500',
    flex: 1,
  },
  lastSeen: {
    fontSize: 10,
    color: C.textDim,
  },
}));

export default DeviceCard;
