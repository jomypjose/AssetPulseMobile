// ─────────────────────────────────────────────────────────────────────────────
// AssetPulse Design Tokens — Red-Accent Edition
//
// Primary brand colour is the logo red, matched to the web app theme
// (#ef4444 dark / #dc2626 light — Tailwind red-500 / red-600).
// Supports dark (default) and light system themes.
// ─────────────────────────────────────────────────────────────────────────────
import { Appearance, StyleSheet } from 'react-native';

/** ── Dark palette ─────────────────────────────────────────────────────────── */
const DARK = {
  // ── Layered backgrounds (deep navy-charcoal) ────────────────────────────
  bg:          '#080c14',   // page background
  surface:     '#0d1321',   // nav bars, headers
  card:        '#111927',   // card surface
  cardAlt:     '#162234',   // elevated / nested card
  border:      '#1e2c3e',   // standard border
  borderFaint: '#131d2c',   // hairline / divider

  // ── Typography ──────────────────────────────────────────────────────────
  text:      '#e8edf5',   // primary text
  textSub:   '#8ba3be',   // secondary text
  textMuted: '#556a84',   // muted / hint
  textDim:   '#2e4158',   // placeholder / disabled

  // ── Brand accent — logo red (matches web --color-primary, dark) ─────────
  primary:      '#ef4444',  // Tailwind red-500 — matches web dark theme
  primaryLight: '#f87171',  // red-400 — highlight / hover
  primaryDim:   '#4a1010',  // dark red — tinted selection bg
  primaryBg:    '#1e0909',  // very dark red — active icon bg

  // ── Status ──────────────────────────────────────────────────────────────
  online:     '#20d9a0',
  onlineBg:   '#071a12',
  onlineDim:  '#0b2e1f',
  offline:    '#ff5c6e',
  offlineBg:  '#1e0a0d',
  offlineDim: '#3a0e14',
  warning:    '#ffb224',
  warningBg:  '#1a1000',
  warningDim: '#382300',

  // ── Alert severity ──────────────────────────────────────────────────────
  critical:   '#ff5c6e',
  criticalBg: '#1e0a0d',
  info:       '#60a5fa',   // blue — distinct from brand red
  infoBg:     '#0d1f3c',

  // ── Accent palette ──────────────────────────────────────────────────────
  cyan:      '#22d4f0',
  cyanBg:    '#071820',
  teal:      '#14b89e',
  tealBg:    '#071816',
  purple:    '#a78bfa',
  purpleBg:  '#130d28',
  purpleDim: '#261a4c',
  pink:      '#f472b6',
  pinkBg:    '#1c0c18',

  // ── Misc ────────────────────────────────────────────────────────────────
  white: '#ffffff',
  black: '#000000',
};

/** ── Light palette ─ matches web app (cool light gray-blue) ───────────────── */
const LIGHT = {
  // ── Layered backgrounds ─────────────────────────────────────────────────
  bg:          '#f4f6f9',   // web --color-background
  surface:     '#ffffff',
  card:        '#ffffff',
  cardAlt:     '#f1f5f9',   // web --color-surface-hover
  border:      '#dde3ec',   // web --color-border
  borderFaint: '#eaeff5',   // web --color-border-light

  // ── Typography ──────────────────────────────────────────────────────────
  text:      '#0f172a',   // web --color-text
  textSub:   '#4b5e7a',   // web --color-text-secondary
  textMuted: '#94a3b8',   // web --color-text-tertiary
  textDim:   '#cbd5e1',   // slate-300 for placeholders

  // ── Brand accent — logo red (matches web --color-primary, light) ────────
  primary:      '#dc2626',  // Tailwind red-600 — matches web light theme
  primaryLight: '#ef4444',  // red-500
  primaryDim:   '#fecaca',  // red-200
  primaryBg:    '#fef2f2',  // red-50 tint

  // ── Status ──────────────────────────────────────────────────────────────
  online:     '#059669',
  onlineBg:   '#ecfdf5',
  onlineDim:  '#d1fae5',
  offline:    '#dc2626',
  offlineBg:  '#fef2f2',
  offlineDim: '#fecaca',
  warning:    '#d97706',
  warningBg:  '#fffbeb',
  warningDim: '#fde68a',

  // ── Alert severity ──────────────────────────────────────────────────────
  critical:   '#dc2626',
  criticalBg: '#fef2f2',
  info:       '#2563eb',
  infoBg:     '#eff6ff',

  // ── Accent palette ──────────────────────────────────────────────────────
  cyan:      '#0891b2',
  cyanBg:    '#ecfeff',
  teal:      '#0d9488',
  tealBg:    '#f0fdfa',
  purple:    '#7c3aed',
  purpleBg:  '#f5f3ff',
  purpleDim: '#ddd6fe',
  pink:      '#db2777',
  pinkBg:    '#fdf2f8',

  // ── Misc ────────────────────────────────────────────────────────────────
  white: '#ffffff',
  black: '#000000',
};

export const THEMES = { dark: DARK, light: LIGHT };

/**
 * CHROME — header & bottom-tab palette that ALWAYS renders dark, regardless
 * of the user's selected light/dark theme. Matches the web app, where the
 * topbar / sidebar stay dark in light mode too.
 *
 * Use these tokens (CHROME.bg, CHROME.text, CHROME.border, etc.) for the
 * app shell only — screen content should still use `C.*`.
 */
export const CHROME = {
  bg:          '#1e2535',                  // web --color-sidebar / --color-topbar (light theme)
  bgDark:      '#0f1420',                  // web dark theme topbar
  border:      'rgba(255,255,255,0.08)',
  borderFaint: 'rgba(255,255,255,0.05)',
  text:        '#e8edf5',
  textSub:     '#c8d4e8',
  textMuted:   '#8ba3be',
  textDim:     '#556a84',
  buttonBg:    'rgba(255,255,255,0.06)',
  buttonBorder:'rgba(255,255,255,0.10)',
};

/**
 * Currently active colour set — mutable object kept in sync by applyTheme().
 *
 * Initialised synchronously using the device's current colour scheme so that
 * every StyleSheet.create() call in screen modules (which execute at import
 * time) receives the correct palette on first render.
 */
const _initScheme = Appearance.getColorScheme() ?? 'dark';
export const C = _initScheme === 'light' ? { ...LIGHT } : { ...DARK };

/**
 * Theme generation counter — bumped every time the active palette changes.
 * `themed()` stylesheets use it to know when to rebuild themselves.
 */
let _themeGen = 0;
export const getThemeGen = () => _themeGen;

/**
 * Mutate `C` in-place to match `scheme`.
 * Called from ThemeContext whenever the active colour scheme changes.
 */
export const applyTheme = (scheme) => {
  const next = scheme === 'light' ? LIGHT : DARK;
  Object.assign(C, next);
  _themeGen += 1;
  return next;
};

/**
 * Reactive replacement for `StyleSheet.create`.
 *
 * Pass a *factory* that returns the style object (so colour tokens are read
 * lazily, not frozen at module-load time):
 *
 *   const styles = themed(() => ({ root: { backgroundColor: C.bg } }));
 *
 * The returned object is a Proxy: accessing `styles.root` rebuilds the
 * underlying StyleSheet whenever the theme generation has advanced, so styles
 * always reflect the current palette. Components re-render on theme change
 * (ThemeProvider remounts the tree), at which point they pick up fresh styles.
 */
export const themed = (factory) => {
  let cache = null;
  let builtGen = -1;
  const rebuild = () => {
    if (builtGen !== _themeGen) {
      cache = StyleSheet.create(factory());
      builtGen = _themeGen;
    }
    return cache;
  };
  return new Proxy(
    {},
    {
      get(_t, prop) { return rebuild()[prop]; },
      has(_t, prop) { return prop in rebuild(); },
      ownKeys()     { return Reflect.ownKeys(rebuild()); },
      getOwnPropertyDescriptor(_t, prop) {
        return Object.getOwnPropertyDescriptor(rebuild(), prop);
      },
    },
  );
};

// ─── Border radii ─────────────────────────────────────────────────────────────
export const R = {
  xs:   6,
  sm:   10,
  md:   14,
  lg:   18,
  xl:   22,
  xxl:  28,
  xxxl: 36,
  full: 9999,
};

// ─── Spacing (4-pt / 8-pt grid) ──────────────────────────────────────────────
export const S = {
  xs:    4,
  sm:    8,
  md:    12,
  lg:    16,
  xl:    20,
  xxl:   24,
  xxxl:  32,
  xxxxl: 48,
};

// ─── Shadow helpers ───────────────────────────────────────────────────────────

/** Standard card shadow */
export const cardShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.35,
  shadowRadius: 8,
  elevation: 4,
};

/**
 * Elevation helper — returns platform shadow + elevation props.
 * @param {number} level  1–5
 */
export const elevation = (level) => ({
  shadowColor: '#000',
  shadowOffset: { width: 0, height: level * 2 },
  shadowOpacity: 0.12 + level * 0.07,
  shadowRadius: level * 4,
  elevation: level * 2,
});

/**
 * Red-glow shadow for prominent primary-action surfaces (iOS only;
 * Android ignores shadowColor).
 */
export const primaryGlow = (opacity = 0.25) => ({
  shadowColor: '#ef4444',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: opacity,
  shadowRadius: 12,
  elevation: 6,
});

// ─── Status → colour maps (live getters on `C`) ───────────────────────────────
export const STATUS_COLOR = {
  get Online()  { return C.online;  },
  get Offline() { return C.offline; },
  get Warning() { return C.warning; },
};

export const STATUS_BG = {
  get Online()  { return C.onlineBg;  },
  get Offline() { return C.offlineBg; },
  get Warning() { return C.warningBg; },
};

export const STATUS_DIM = {
  get Online()  { return C.onlineDim;  },
  get Offline() { return C.offlineDim; },
  get Warning() { return C.warningDim; },
};
