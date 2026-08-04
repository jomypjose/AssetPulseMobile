/**
 * AnimatedSplash
 * ─────────────────────────────────────────────────────────────────────────────
 * Full-screen splash shown while the app initialises (auth check + token load).
 * The brand mark scales/fades in, a pulse ring rings out behind it, then the
 * whole screen fades away to reveal the app.
 *
 * Usage:
 *   <AnimatedSplash visible={isLoading}>
 *     {children}
 *   </AnimatedSplash>
 */

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { View, Text, Animated, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { S } from '../theme';

// NOTE ON THE DRAW ANIMATION
// This app runs on the New Architecture (Fabric). There,
// `Animated.createAnimatedComponent(Path)` does not actually push prop updates
// into react-native-svg — the <Svg> subtree renders blank. The original code
// also nested an <Animated.View> inside <Svg>, which is invalid regardless
// (only SVG elements may be children of <Svg>). Between them, the logo showed
// up clipped, off-centre, or not at all.
//
// So the reveal is driven by plain React state instead: a timer steps
// `dashOffset` down and we pass it to a normal <Path> as an ordinary prop.
// That's a well-trodden path on Fabric, and at this size the extra renders
// are trivial.

const { width: SW } = Dimensions.get('window');

// ECG waveform. Real bounds of these points: x 4→124, y 24→96.
const ECG_PATH =
  'M 4,60 L 24,60 L 30,36 L 36,84 L 42,54 L 48,66 L 54,60 L 62,24 L 70,96 L 76,48 L 82,72 L 88,60 L 94,42 L 100,78 L 106,60 L 124,60';

// viewBox has to cover those bounds plus room for the stroke and its round
// caps, or the tall spikes get cropped. Height is derived from the box so the
// rendered size can't drift out of sync and squash the wave.
const VB_X = 0, VB_Y = 16, VB_W = 128, VB_H = 88;
const VB_RATIO = VB_H / VB_W;

// Total drawn length of the path above (~434). strokeDashoffset animates from
// this to 0 to "draw" the line. Keep it close to the true length — much larger
// and the reveal finishes early, leaving dead time at the end.
const PATH_LENGTH = 440;

// The splash sits on top of the native splash screen, whose background is set
// to #080d17 in app.config.js. It therefore has to be dark REGARDLESS of the
// user's light/dark preference — using theme tokens here made the title
// invisible in light mode (dark navy text on a dark backdrop).
const SPLASH_BG    = '#080d17';
const BRAND        = '#ef4444';
const TITLE_COLOR  = '#e8edf5';
const SUB_COLOR    = '#8ba3be';

const SVG_W    = Math.min(SW * 0.66, 260);
const RING_D   = SVG_W * 0.78;

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
  // The ECG's per-frame state lives inside <EcgTrace> so its 60fps updates
  // don't re-render this component (and re-lay-out the title) every frame.
  const ringScale     = useRef(new Animated.Value(0.6)).current;
  const ringOpacity   = useRef(new Animated.Value(0)).current;
  const textOpacity   = useRef(new Animated.Value(0)).current;
  const splashOpacity = useRef(new Animated.Value(1)).current;

  // Runs once the trace has finished drawing: text in, then the pulse ring.
  const playOutro = useCallback(() => {
    Animated.sequence([
      Animated.timing(textOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(ringScale, { toValue: 1.5, duration: 700, useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(ringOpacity, { toValue: 0.45, duration: 220, useNativeDriver: true }),
          Animated.timing(ringOpacity, { toValue: 0,    duration: 480, useNativeDriver: true }),
        ]),
      ]),
    ]).start();
  }, [ringScale, ringOpacity, textOpacity]);

  const fadeOut = useCallback(() => {
    Animated.timing(splashOpacity, { toValue: 0, duration: 450, useNativeDriver: true })
      .start(() => setDone(true));
  }, [splashOpacity]);

  // Play the intro once on mount.
  // The intro now starts itself: <EcgTrace> runs the draw on mount and calls
  // playOutro when it finishes.

  // Once the app is ready, hold for the remainder of MIN_VISIBLE_MS, then fade out.
  useEffect(() => {
    if (done || visible) return undefined;
    const elapsed = Date.now() - mountTime.current;
    const wait = Math.max(0, MIN_VISIBLE_MS - elapsed);
    const t = setTimeout(fadeOut, wait);
    return () => clearTimeout(t);
  }, [visible, done, fadeOut]);

  if (done) return <>{children}</>;

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* Render children beneath so they're ready; splash sits on top */}
      <View style={StyleSheet.absoluteFill}>{children}</View>

      <Animated.View
        style={[styles.overlay, { opacity: splashOpacity }]}
        pointerEvents="none"
      >
        <View style={styles.logoBlock}>
          {/* Pulse ring, behind the trace */}
          <Animated.View
            style={[
              styles.ring,
              { opacity: ringOpacity, transform: [{ scale: ringScale }] },
            ]}
          />

          <EcgTrace onDone={playOutro} />
        </View>

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

// ── ECG trace ─────────────────────────────────────────────────────────────────
/**
 * Draws the waveform with a stroke-dash reveal.
 *
 * Isolated into its own component on purpose: the reveal ticks ~60×/sec, and
 * if that state lived in the parent the title would re-layout on every frame
 * (which showed up as the logo and text being clipped to a narrow column).
 * The fixed-size wrapper View matters too — an <Svg> left to size itself
 * inside a shrink-to-fit parent collapses on Fabric.
 */
const DRAW_MS = 900;

const EcgTrace = ({ onDone }) => {
  const [dashOffset, setDashOffset] = useState(PATH_LENGTH);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    const start = Date.now();
    const timer = setInterval(() => {
      const t = Math.min(1, (Date.now() - start) / DRAW_MS);
      const eased = 1 - Math.pow(1 - t, 3);   // easeOutCubic
      setDashOffset(PATH_LENGTH * (1 - eased));
      if (t >= 1) {
        clearInterval(timer);
        doneRef.current?.();
      }
    }, 16);
    return () => clearInterval(timer);
  }, []);

  return (
    <View style={styles.traceBox}>
      <Svg
        width={SVG_W}
        height={SVG_W * VB_RATIO}
        viewBox={`${VB_X} ${VB_Y} ${VB_W} ${VB_H}`}
      >
        <Path
          d={ECG_PATH}
          stroke={BRAND}
          strokeWidth={4}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={PATH_LENGTH}
          strokeDashoffset={dashOffset}
        />
      </Svg>
    </View>
  );
};

// ── Tiny bouncing dots ────────────────────────────────────────────────────────
const LoadingDots = () => {
  const a0 = useRef(new Animated.Value(0)).current;
  const a1 = useRef(new Animated.Value(0)).current;
  const a2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anims = [a0, a1, a2];
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
  }, [a0, a1, a2]);

  return (
    <View style={styles.dotRow}>
      {[a0, a1, a2].map((a, i) => (
        <Animated.View
          key={i}
          style={[styles.dot, { transform: [{ translateY: a }] }]}
        />
      ))}
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Plain StyleSheet (not `themed`) — the splash palette is intentionally fixed.

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: SPLASH_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Explicit size: an <Svg> left to size itself inside a shrink-to-fit parent
  // collapses to a narrow column on Fabric, which clipped the mark and title.
  logoBlock: {
    width: SVG_W,
    height: SVG_W * VB_RATIO,
    alignItems: 'center',
    justifyContent: 'center',
  },
  traceBox: {
    width: SVG_W,
    height: SVG_W * VB_RATIO,
  },
  ring: {
    position: 'absolute',
    width: RING_D,
    height: RING_D,
    borderRadius: RING_D / 2,
    borderWidth: 1.5,
    borderColor: BRAND,
  },

  textBlock: { alignItems: 'center', gap: 4, marginTop: S.xl },
  title: { fontSize: 28, fontWeight: '800', color: TITLE_COLOR, letterSpacing: 0.5 },
  sub: {
    fontSize: 13, color: SUB_COLOR, fontWeight: '500',
    letterSpacing: 1.5, textTransform: 'uppercase',
  },

  dotsRow: { marginTop: S.xxxl + S.lg },
  dotRow: { flexDirection: 'row', gap: 7 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: BRAND, opacity: 0.7 },
});

export default AnimatedSplash;
