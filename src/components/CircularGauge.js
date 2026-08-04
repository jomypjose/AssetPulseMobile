import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, G, Defs, LinearGradient, Stop } from 'react-native-svg';
import { themed, C } from '../theme';

/**
 * SVG circular progress gauge.
 *
 * Props:
 *   value   0–100
 *   size    diameter in dp (default 100)
 *   label   string shown below the percentage
 *   color   arc stroke colour
 */
const CircularGauge = ({ value = 0, size = 100, label = '', color = C.primary }) => {
  const clamped     = Math.min(100, Math.max(0, value));
  const strokeWidth = size * 0.1;
  const radius      = (size - strokeWidth) / 2;
  const cx          = size / 2;
  const cy          = size / 2;
  const circ        = 2 * Math.PI * radius;
  const offset      = circ - (clamped / 100) * circ;

  const valFontSize  = useMemo(() => (size >= 120 ? 22 : size >= 90 ? 18 : 14), [size]);
  const pctFontSize  = useMemo(() => valFontSize * 0.6, [valFontSize]);
  const lblFontSize  = useMemo(() => (size >= 120 ? 11 : 10), [size]);

  return (
    <View style={styles.container}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id="arcGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor={color} stopOpacity="0.7" />
            <Stop offset="100%" stopColor={color} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <G rotation={-90} origin={`${cx}, ${cy}`}>
          {/* Track */}
          <Circle
            cx={cx} cy={cy} r={radius}
            stroke={C.border}
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Progress arc */}
          {clamped > 0 && (
            <Circle
              cx={cx} cy={cy} r={radius}
              stroke="url(#arcGrad)"
              strokeWidth={strokeWidth}
              fill="transparent"
              strokeDasharray={circ}
              strokeDashoffset={offset}
              strokeLinecap="round"
            />
          )}
        </G>
      </Svg>

      {/* Text overlay */}
      <View style={[styles.overlay, { width: size, height: size }]}>
        <Text style={[styles.value, { fontSize: valFontSize, color }]}>
          {clamped}
          <Text style={{ fontSize: pctFontSize, color }}>%</Text>
        </Text>
        {!!label && (
          <Text style={[styles.labelText, { fontSize: lblFontSize }]}>{label}</Text>
        )}
      </View>
    </View>
  );
};

const styles = themed(() => ({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontWeight: '800',
    textAlign: 'center',
  },
  labelText: {
    color: C.textDim,
    fontWeight: '600',
    marginTop: 3,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
}));

export default CircularGauge;
