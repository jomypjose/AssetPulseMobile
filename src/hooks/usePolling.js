// ─────────────────────────────────────────────────────────────────────────────
// Polling hooks — interval polling that stops when nobody is looking.
//
// Every screen used to run a bare `setInterval(fetch, 30000)` in a mount-only
// useEffect. Two things made that expensive:
//
//   1. React Navigation keeps tab screens MOUNTED after you navigate away, so
//      Dashboard, Devices and Alerts all kept polling simultaneously even
//      though only one was on screen.
//   2. Nothing watched AppState, so every one of those intervals kept firing
//      while the app sat in the background — waking the radio out of its idle
//      state every 30s, indefinitely, which is what actually drains a phone.
//
// Both hooks below pause while the app is backgrounded and fire once on
// resume, so returning to a screen shows fresh data rather than a stale
// render plus a wait for the next tick.
//
//   usePolling          — for screens. Also pauses while the screen is not
//                         the focused one in its navigator.
//   useAppStatePolling  — for app-wide pollers that have no meaningful focus
//                         state (the tab-bar badge counts). Deliberately does
//                         NOT touch navigation context: it is called from the
//                         component that renders the navigator, where there is
//                         no screen to be focused and useIsFocused() throws.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useIsFocused } from '@react-navigation/native';

/**
 * Shared engine: tick `callback` every `intervalMs` for as long as `active`
 * stays true AND the app is in the foreground.
 */
const useIntervalWhileActive = (callback, intervalMs, active, immediate) => {
  // Callers usually pass an inline arrow or a useCallback whose identity
  // changes on render. Holding it in a ref keeps the effect keyed only to the
  // things that should genuinely restart the timer — otherwise a re-render
  // would recreate the interval and, with `immediate`, refetch every time.
  const cbRef = useRef(callback);
  cbRef.current = callback;

  useEffect(() => {
    if (!active) return undefined;

    let timer = null;
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      // Callbacks guard their own setState against unmount; all we need here
      // is to stop a rejection escaping and killing the interval.
      Promise.resolve().then(() => cbRef.current?.()).catch(() => {});
    };

    const start = () => {
      if (!timer) timer = setInterval(tick, intervalMs);
    };
    const stop = () => {
      if (timer) { clearInterval(timer); timer = null; }
    };

    // AppState is 'active' | 'background' | 'inactive'. 'inactive' is the iOS
    // transitional state (app switcher, incoming call), so treat anything
    // that isn't 'active' as not visible.
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        if (immediate) tick();   // catch up on what changed while away
        start();
      } else {
        stop();
      }
    });

    if (AppState.currentState === 'active') {
      if (immediate) tick();
      start();
    }

    return () => {
      cancelled = true;
      stop();
      sub.remove();
    };
  }, [active, intervalMs, immediate]);
};

/**
 * Screen-level polling: runs only while this screen is focused and the app is
 * in the foreground.
 *
 * @param {Function} callback    Invoked per tick; may be async.
 * @param {number}   intervalMs  Delay between ticks.
 * @param {object}   [options]
 * @param {boolean}  [options.enabled=true]    False suspends polling entirely.
 * @param {boolean}  [options.immediate=true]  Tick once when polling activates.
 */
export function usePolling(callback, intervalMs, options = {}) {
  const { enabled = true, immediate = true } = options;
  const isFocused = useIsFocused();
  useIntervalWhileActive(callback, intervalMs, enabled && isFocused, immediate);
}

/**
 * App-wide polling: foreground-only, focus-agnostic. Safe to call from outside
 * a navigator screen.
 */
export function useAppStatePolling(callback, intervalMs, options = {}) {
  const { enabled = true, immediate = true } = options;
  useIntervalWhileActive(callback, intervalMs, enabled, immediate);
}

export default usePolling;
