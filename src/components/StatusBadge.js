import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { themed, C, R, STATUS_COLOR, STATUS_BG, STATUS_DIM } from '../theme';

/**
 * StatusBadge — pill badge with animated pulse dot for Online devices.
 *
 * Props:
 *   status  'Online' | 'Offline' | 'Warning'
 *   size    'sm' | 'md' (default 'md')
 */
const StatusBadge = ({ status, size = 'md' }) => {
  const color  = STATUS_COLOR[status] || C.textMuted;
  const bg     = STATUS_BG[status]    || C.card;
  const dim    = STATUS_DIM[status]   || C.border;
  const isOnline = status === 'Online';
  const isSmall  = size === 'sm';

  // Pulsing animation for the outer ring (Online only)
  const pulseScale   = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    if (!isOnline) return;
    const anim = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulseScale,   { toValue: 2.2, duration: 1200, useNativeDriver: true }),
          Animated.timing(pulseScale,   { toValue: 1,   duration: 0,    useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(pulseOpacity, { toValue: 0,   duration: 1200, useNativeDriver: true }),
          Animated.timing(pulseOpacity, { toValue: 0.7, duration: 0,    useNativeDriver: true }),
        ]),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [isOnline]);

  const dotSize  = isSmall ? 5 : 7;
  const fontSize = isSmall ? 10 : 12;
  const px       = isSmall ? 8  : 10;
  const py       = isSmall ? 3  : 5;

  return (
    <View style={[styles.badge, { backgroundColor: bg, borderColor: `${color}44`, paddingHorizontal: px, paddingVertical: py }]}>
      {/* Dot + optional pulse ring */}
      <View style={{ width: dotSize, height: dotSize, alignItems: 'center', justifyContent: 'center' }}>
        {isOnline && (
          <Animated.View
            style={{
              position: 'absolute',
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
              backgroundColor: color,
              transform: [{ scale: pulseScale }],
              opacity: pulseOpacity,
            }}
          />
        )}
        <View style={{ width: dotSize, height: dotSize, borderRadius: dotSize / 2, backgroundColor: color }} />
      </View>

      <Text style={[styles.label, { color, fontSize }]}>{status || 'Unknown'}</Text>
    </View>
  );
};

const styles = themed(() => ({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: R.full,
    borderWidth: 1,
    gap: 5,
    alignSelf: 'flex-start',
  },
  label: {
    fontWeight: '600',
    letterSpacing: 0.2,
  },
}));

export default StatusBadge;
