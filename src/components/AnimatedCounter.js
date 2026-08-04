import React, { useEffect, useRef, useState } from 'react';
import { Text } from 'react-native';

/**
 * Counts up to `value` when it changes — the same touch the web dashboard
 * uses for its stat tiles. Purely cosmetic: the final frame is always the
 * exact value, so a dropped animation can never show a wrong number.
 *
 * Uses a JS interval rather than Animated because Animated's native driver
 * can't drive text content, and a listener-based approach would re-render
 * just as often for no benefit at these frame counts.
 */
const AnimatedCounter = ({ value = 0, duration = 900, style, format }) => {
  const target = Number.isFinite(value) ? value : 0;
  const [display, setDisplay] = useState(target);
  const fromRef = useRef(target);
  const mounted = useRef(true);

  useEffect(() => () => { mounted.current = false; }, []);

  useEffect(() => {
    const from = fromRef.current;
    if (from === target) return undefined;

    // Small deltas aren't worth animating — they just look like a flicker.
    if (Math.abs(target - from) < 2) {
      fromRef.current = target;
      setDisplay(target);
      return undefined;
    }

    const start = Date.now();
    const id = setInterval(() => {
      const t = Math.min(1, (Date.now() - start) / duration);
      // easeOutCubic — fast start, gentle settle
      const eased = 1 - Math.pow(1 - t, 3);
      const next = Math.round(from + (target - from) * eased);
      if (!mounted.current) return;
      setDisplay(next);
      if (t >= 1) {
        clearInterval(id);
        fromRef.current = target;
      }
    }, 16);

    return () => clearInterval(id);
  }, [target, duration]);

  return <Text style={style}>{format ? format(display) : display}</Text>;
};

export default AnimatedCounter;
