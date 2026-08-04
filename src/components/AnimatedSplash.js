/**
 * AnimatedSplash
 * ─────────────────────────────────────────────────────────────────────────────
 * Full-screen splash shown while the app initialises (auth check + token load).
 * The ECG pulse-wave is drawn with a stroke-dashoffset reveal animation, then
 * a pulsing ring fades in, then the whole screen fades out to reveal the app.
 *
 * Usage:
 *   <AnimatedSplash visible={isLoading} onDone={() => setReady(true)}>
 *     {children}
 *   </AnimatedSplash>
 */

import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
  View, Text, Animated, StyleSheet, Dimensions,
} from 'react-native';
import Svg, {
  Path, Circle, Defs, RadialGradient, Stop, G,
} from 'react-native-svg';
import { themed, C, R, S } from '../theme';

const { width: SW, height: SH } = Dimensions.get('window');

// ── ECG path in a 200×120 viewBox ────────────────────────────────────────────
// Scaled / centred version of the favicon SVG points.
const ECG_PATH =
  'M 4,60 L 24,60 L 30,36 L 36,84 L 42,54 L 48,66 L 54,60 L 62,24 L 70,96 L 76,48 L 82,72 L 88,60 L 94,42 L 100,78 L 106,60 L 124,60';

// Total path length (computed from the ECG point list). Must be ≥ the real
// length or the stroke-dash reveal stops short and the tail never draws.
const PATH_LENGTH = 500;

// Minimum time the splash stays on screen, so the intro animation is always
// seen even when the app finishes loading instantly.
const MIN_VISIBLE_MS = 2400;

// ─────────────────────────────────────────────────────────────────────────────

const AnimatedSplash = ({ visible, children }) => {
  // Splash owns its own dismissal: it stays until the intro has played AND the
  // app is ready (visible=false) AND MIN_VISIBLE_MS has elapsed.
  const [done, setDone] = useState(false);
  const mountTime = useRef(Date.now());
  // ── animation values ──────────────────────────────────────────────────────
  const drawProgress  = useRef(new Animated.Value(0)).current;  // 0→1
  const glowOpacity   = useRef(new Animated.Value(0)).current;
  const ringScale     = useRef(new Animated.Value(0.6)).current;
  const ringOpacity   = useRef(new Animated.Value(0)).current;
  const textOpacity   = useRef(new Animated.Value(0)).current;
  const splashOpacity = useRef(new Animated.Value(1)).current;
  const containerPtrEvents = useRef(null);

  // dashOffset: full path length → 0  (reveals the path left to right)
  const dashOffset = drawProgress.interpolate({
    inputRange:  [0, 1],
    outputRange: [PATH_LENGTH, 0],
  });

  // Stroke opacity fades in as drawing starts
  const strokeOpacity = drawProgress.interpolate({
    inputRange:  [0, 0.05, 1],
    outputRange: [0, 1, 1],
  });

  // Intro animation (draw → glow/text → pulse ring). Does NOT fade out — the
  // fade-out is triggered separately once the app is ready + min time elapsed.
  const playIntro = useCallback(() => {
    drawProgress.setValue(0);
    glowOpacity.setValue(0);
    ringScale.setValue(0.6);
    ringOpacity.setValue(0);
    textOpacity.setValue(0);
    splashOpacity.setValue(1);

    Animated.sequence([
      Animated.timing(drawProgress, { toValue: 1, duration: 700, useNativeDriver: false }),
      Animated.parallel([
        Animated.timing(glowOpacity, { toValue: 1, duration: 300, useNativeDriver: false }),
        Animated.timing(textOpacity, { toValue: 1, duration: 400, useNativeDriver: true  }),
      ]),
      Animated.parallel([
        Animated.timing(ringScale, { toValue: 1.4, duration: 600, useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(ringOpacity, { toValue: 0.5, duration: 200, useNativeDriver: true }),
          Animated.timing(ringOpacity, { toValue: 0,   duration: 400, useNativeDriver: true }),
        ]),
      ]),
    ]).start();
  }, [drawProgress, glowOpacity, ringScale, ringOpacity, textOpacity, splashOpacity]);

  const fadeOut = useCallback(() => {
    Animated.timing(splashOpacity, { toValue: 0, duration: 450, useNativeDriver: true })
      .start(() => setDone(true));
  }, [splashOpacity]);

  // Play the intro once on mount.
  useEffect(() => { playIntro(); }, [playIntro]);

  // Once the app is ready, hold for the remainder of MIN_VISIBLE_MS, then fade out.
  useEffect(() => {
    if (done || visible) return;
    const elapsed = Date.now() - mountTime.current;
    const wait = Math.max(0, MIN_VISIBLE_MS - elapsed);
    const t = setTimeout(fadeOut, wait);
    return () => clearTimeout(t);
  }, [visible, done, fadeOut]);

  if (done) return <>{children}</>;

  const SVG_W = Math.min(SW * 0.72, 280);
  const SVG_H = SVG_W * 0.6;
  // Scale viewBox (200×120) → SVG_W × SVG_H
  const VB_W = 128, VB_H = 128 * 0.6;

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* Render children beneath so they're ready; splash sits on top */}
      <View style={styles.childWrap}>{children}</View>

      <Animated.View
        style={[styles.overlay, { opacity: splashOpacity }]}
        pointerEvents="none"
      >
        {/* Radial background glow */}
        <Animated.View style={[styles.bgGlow, { opacity: glowOpacity }]} />

        {/* Pulse ring */}
        <Animated.View
          style={[
            styles.ring,
            {
              opacity:   ringOpacity,
              transform: [{ scale: ringScale }],
              width:  SVG_W * 0.9,
              height: SVG_W * 0.9,
              borderRadius: SVG_W * 0.45,
            },
          ]}
        />

        {/* ECG wave */}
        <Svg
          width={SVG_W}
          height={SVG_H}
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          style={styles.svg}
        >
          <Defs>
            <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
              <Stop offset="0%"   stopColor={C.primary} stopOpacity="0.35" />
              <Stop offset="100%" stopColor={C.primary} stopOpacity="0"    />
            </RadialGradient>
          </Defs>

          {/* Glow behind the wave */}
          <Animated.View style={{ opacity: glowOpacity }}>
            <Path
              d={ECG_PATH}
              stroke={C.primaryDim}
              strokeWidth={6}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.6}
            />
          </Animated.View>

          {/* Animated draw path */}
          <AnimatedPath
            d={ECG_PATH}
            stroke={C.primary}
            strokeWidth={3}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={PATH_LENGTH}
            strokeDashoffset={dashOffset}
            strokeOpacity={strokeOpacity}
          />
        </Svg>

        {/* Brand text */}
        <Animated.View style={[styles.textBlock, { opacity: textOpacity }]}>
          <Text style={styles.title}>AssetPulse</Text>
          <Text style={styles.sub}>Network Monitor</Text>
        </Animated.View>

        {/* Loading dots */}
        <Animated.View style={[styles.dotsRow, { opacity: textOpacity }]}>
          <LoadingDots />
        </Animated.View>
      </Animated.View>
    </View>
  );
};

// ── Tiny bouncing dots ────────────────────────────────────────────────────────
const LoadingDots = () => {
  const anims = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];

  useEffect(() => {
    const loops = anims.map((a, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(a, { toValue: -5, duration: 300, useNativeDriver: true }),
          Animated.timing(a, { toValue:  0, duration: 300, useNativeDriver: true }),
          Animated.delay(300),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, []);

  return (
    <View style={dot.row}>
      {anims.map((a, i) => (
        <Animated.View
          key={i}
          style={[dot.dot, { transform: [{ translateY: a }] }]}
        />
      ))}
    </View>
  );
};

// Animated SVG Path wrapper (react-native-svg supports animated props via AnimatedComponent)
const AnimatedPath = Animated.createAnimatedComponent(Path);

// ─────────────────────────────────────────────────────────────────────────────

const styles = themed(() => ({
  childWrap: { ...StyleSheet.absoluteFillObject },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: C.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bgGlow: {
    position: 'absolute',
    width: SW * 0.9,
    height: SW * 0.9,
    borderRadius: SW * 0.45,
    backgroundColor: `${C.primary}08`,
    top: SH * 0.5 - SW * 0.45 - 30,
    left: SW * 0.05,
  },
  ring: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: C.primary,
  },
  svg: { marginBottom: S.xl },

  textBlock: { alignItems: 'center', gap: 4 },
  title:  { fontSize: 28, fontWeight: '800', color: C.text, letterSpacing: 0.5 },
  sub:    { fontSize: 13, color: C.textMuted, fontWeight: '500', letterSpacing: 1.5, textTransform: 'uppercase' },

  dotsRow: { marginTop: S.xxxl + S.lg },
}));

const dot = themed(() => ({
  row: { flexDirection: 'row', gap: 7 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.primary, opacity: 0.7 },
}));

export default AnimatedSplash;
