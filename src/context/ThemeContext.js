/**
 * ThemeContext — manages light/dark colour scheme.
 *
 * Three preference values: 'system' / 'light' / 'dark'. Persisted in
 * AsyncStorage under THEME_PREF_KEY.
 *
 * Reactive model (no JS-bundle reload required):
 *   - Colour tokens live on the mutable `C` object; `applyTheme(scheme)`
 *     rewrites it and bumps a generation counter.
 *   - Screens build styles with `themed(() => …)` (see theme.js), which
 *     rebuild against the current palette whenever they re-render.
 *   - We apply the theme synchronously during render (useMemo). App.js's
 *     `ThemeShell` remounts the whole tree (key={scheme}) when the scheme
 *     changes, so every component re-renders and `themed()` styles rebuild.
 */
import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { applyTheme, THEMES } from '../theme';

// Read the OS scheme synchronously so the very first render isn't `null`.
const _initialSystemScheme = Appearance.getColorScheme() ?? 'dark';

const THEME_PREF_KEY = '@assetpulse_theme_pref';

const ThemeContext = createContext({
  scheme: _initialSystemScheme,
  isDark: _initialSystemScheme === 'dark',
  colors: THEMES[_initialSystemScheme],
  preference: 'system',
  setPreference: () => {},
  hydrated: false,
});

export const ThemeProvider = ({ children }) => {
  // Live OS scheme — falls back to the synchronous initial value.
  const rnSystemScheme = useColorScheme();
  const systemScheme = rnSystemScheme || _initialSystemScheme;

  const [preference, setPreferenceState] = useState('system');
  const [hydrated,   setHydrated]        = useState(false);

  const scheme = preference === 'system' ? systemScheme : preference;

  // Apply the palette synchronously during render so children (which remount
  // on the `scheme` key below) read the correct `C.*` / themed() styles.
  const colors = useMemo(() => applyTheme(scheme), [scheme]);

  // Restore the saved preference once at startup.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let saved = null;
      try {
        saved = await AsyncStorage.getItem(THEME_PREF_KEY);
      } catch { /* ignore */ }
      if (cancelled) return;
      if (['light', 'dark'].includes(saved)) setPreferenceState(saved);
      setHydrated(true);
    })();
    return () => { cancelled = true; };
  }, []);

  const setPreference = useCallback(async (pref) => {
    if (!['system', 'light', 'dark'].includes(pref)) return;
    try {
      await AsyncStorage.setItem(THEME_PREF_KEY, pref);
    } catch { /* ignore */ }
    setPreferenceState(pref);
  }, []);

  return (
    <ThemeContext.Provider value={{
      scheme,
      isDark: scheme === 'dark',
      colors,
      preference,
      setPreference,
      hydrated,
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);

export default ThemeContext;
