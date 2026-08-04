import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Polyline, Line, Circle } from 'react-native-svg';
import { themed, C, R, S } from '../theme';

/**
 * Minimal sparkline: takes an array of { ts, value } or raw numbers and
 * renders a smooth-ish polyline. No axes — just the trend.
 *
 *   <Sparkline data={[1, 4, 2, 7, 6]} color={C.primary} />
 */
const Sparkline = ({ data = [], width = 220, height = 56, color = C.primary, label, suffix = '' }) => {
  const points = useMemo(() => {
    const values = data.map((d) => (typeof d === 'number' ? d : Number(d?.value ?? d?.y ?? 0)))
      .filter((v) => !isNaN(v));
    if (values.length === 0) return { polyline: '', min: 0, max: 0, last: null };

    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    const stepX = values.length > 1 ? (width - 8) / (values.length - 1) : 0;
    const padY = 6;
    const usableY = height - padY * 2;
    const pts = values.map((v, i) => {
      const x = 4 + i * stepX;
      const y = padY + (1 - (v - min) / range) * usableY;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    return {
      polyline: pts.join(' '),
      min, max,
      last: values[values.length - 1],
      lastX: 4 + (values.length - 1) * stepX,
      lastY: padY + (1 - (values[values.length - 1] - min) / range) * usableY,
    };
  }, [data, width, height]);

  return (
    <View style={styles.wrap}>
      {!!label && (
        <View style={styles.head}>
          <Text style={styles.label}>{label}</Text>
          {points.last != null && (
            <Text style={[styles.value, { color }]}>
              {Math.round(points.last * 10) / 10}{suffix}
            </Text>
          )}
        </View>
      )}
      <Svg width={width} height={height}>
        <Line x1="0" y1={height - 1} x2={width} y2={height - 1} stroke={C.borderFaint} strokeWidth="1" />
        {points.polyline ? (
          <>
            <Polyline
              points={points.polyline}
              fill="none"
              stroke={color}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <Circle cx={points.lastX} cy={points.lastY} r="3" fill={color} />
          </>
        ) : (
          <Line x1="4" y1={height / 2} x2={width - 4} y2={height / 2} stroke={C.borderFaint} strokeDasharray="3,3" strokeWidth="1" />
        )}
      </Svg>
    </View>
  );
};

const styles = themed(() => ({
  wrap:  { backgroundColor: C.card, borderRadius: R.md, borderWidth: 1, borderColor: C.border, padding: S.md },
  head:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: S.xs },
  label: { fontSize: 11, color: C.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  value: { fontSize: 14, fontWeight: '800' },
}));

export default Sparkline;
