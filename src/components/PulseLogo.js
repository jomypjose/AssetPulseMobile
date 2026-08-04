/**
 * PulseLogo — AssetPulse brand icon rendered via react-native-svg.
 *
 * Mirrors the pulse waveform from client/public/favicon.svg.
 *
 * Props:
 *   size        — icon box size in px (default 32)
 *   color       — stroke color (default '#D32F2F')
 *   strokeWidth — line width (default 8, scales with size)
 *   style       — extra View style
 */
import React from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

const VIEWBOX = 100; // the SVG viewBox is 0 0 100 100

const PulseLogo = ({ size = 32, color = '#D32F2F', strokeWidth, style }) => {
  // Scale stroke width proportionally; default is 8 on 100-unit canvas → 0.08 × size
  const sw = strokeWidth ?? Math.max(2, Math.round(size * 0.08));

  return (
    <View style={[{ width: size, height: size }, style]}>
      <Svg
        width={size}
        height={size}
        viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
      >
        <Path
          d="M 5 50 L 20 50 L 25 30 L 30 70 L 35 45 L 40 55 L 45 50 L 50 20 L 55 80 L 60 40 L 65 60 L 70 50 L 75 35 L 80 65 L 85 50 L 95 50"
          stroke={color}
          strokeWidth={sw}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
};

export default PulseLogo;
