/**
 * MiniMap — compact preview card shown on the Dashboard.
 *
 * Tap anywhere → navigates to the full MapScreen.
 * The map itself is non-interactive here (pointer-events disabled) so
 * the tap gesture reaches React Native cleanly.
 *
 * Uses react-native-webview — requires a native rebuild once.
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { Map } from 'lucide-react-native';
import { themed, C, R, S, elevation, primaryGlow } from '../theme';
import { getBranchMapData } from '../services/api';
import { buildMapHtml } from '../utils/mapHtml';

let WebView = null;
try { WebView = require('react-native-webview').WebView; } catch (_) {}

// ─── Placeholder (shown before native rebuild) ────────────────────────────────
const MapPlaceholder = ({ height, onPress }) => (
  <TouchableOpacity
    style={[styles.card, { height }, styles.placeholder]}
    onPress={onPress}
    activeOpacity={0.85}
  >
    <View style={styles.placeholderIcon}>
      <Map color={C.primary} size={28} strokeWidth={1.5} />
    </View>
    <Text style={styles.placeholderTitle}>Branch Network Map</Text>
    <Text style={styles.placeholderSub}>
      Tap to open · rebuild required{'\n'}
      <Text style={styles.placeholderCode}>expo run:android</Text>
    </Text>
  </TouchableOpacity>
);

// ─── Component ────────────────────────────────────────────────────────────────
const MiniMap = ({ height = 220, style, isDark = true, onPress }) => {
  const [branches, setBranches] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');

  useEffect(() => {
    if (!WebView) { setLoading(false); return; }
    getBranchMapData()
      .then((data) => { setBranches(data.branches || []); setLoading(false); })
      .catch((err)  => { setError(err.message || 'Map unavailable'); setLoading(false); });
  }, []);

  if (!WebView) return <MapPlaceholder height={height} onPress={onPress} />;

  // Mini-map is read-only (no postMessage, no topBar changes needed)
  const html = buildMapHtml(branches, isDark, { postMessage: false, hideTopBar: false });

  return (
    <TouchableOpacity
      style={[styles.card, { height }, style]}
      onPress={onPress}
      activeOpacity={0.92}
    >
      {/* Map preview (pointer-events none so tap goes to RN) */}
      <View style={styles.mapWrap} pointerEvents="none">
        {loading && (
          <View style={styles.center}>
            <ActivityIndicator color={C.primary} size="small" />
            <Text style={styles.loadingText}>Loading map…</Text>
          </View>
        )}

        {!loading && error ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {!loading && !error && (
          <WebView
            source={{ html }}
            style={styles.webView}
            scrollEnabled={false}
            pinchGestureEnabled={false}
            androidLayerType="hardware"
            javaScriptEnabled
            originWhitelist={['*']}
            scalesPageToFit={false}
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
            // Interactive JS disabled for preview — tap goes to MapScreen
            injectedJavaScript="document.body.style.pointerEvents='none';"
          />
        )}
      </View>

      {/* Expand hint overlay */}
      <View style={styles.expandHint} pointerEvents="none">
        <Map color={C.white} size={13} strokeWidth={2} />
        <Text style={styles.expandText}>Tap to open full map</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = themed(() => ({
  card: {
    backgroundColor: C.card,
    borderRadius:    R.xl,
    overflow:        'hidden',
    borderWidth:     1,
    borderColor:     `${C.primary}20`,
    marginBottom:    S.xl,
    ...elevation(2),
    ...primaryGlow(0.08),
  },
  mapWrap: { flex: 1 },
  webView: {
    flex:            1,
    backgroundColor: 'transparent',
  },
  center: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    gap:            S.sm,
  },
  loadingText: { color: C.textMuted, fontSize: 12 },
  errorText:   { color: C.textMuted, fontSize: 12, textAlign: 'center', paddingHorizontal: S.lg },

  // Expand hint (bottom-right corner)
  expandHint: {
    position:        'absolute',
    bottom:          S.sm,
    right:           S.sm,
    flexDirection:   'row',
    alignItems:      'center',
    gap:             5,
    paddingHorizontal: S.sm,
    paddingVertical: 4,
    borderRadius:    R.sm,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  expandText: { color: C.white, fontSize: 10, fontWeight: '600' },

  // Placeholder
  placeholder: {
    alignItems:     'center',
    justifyContent: 'center',
    gap:            S.sm,
  },
  placeholderIcon: {
    width: 56, height: 56, borderRadius: R.lg,
    backgroundColor: C.primaryBg,
    borderWidth: 1, borderColor: `${C.primary}44`,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: S.xs,
  },
  placeholderTitle: { fontSize: 14, fontWeight: '700', color: C.text },
  placeholderSub:   { fontSize: 12, color: C.textMuted, textAlign: 'center', lineHeight: 18 },
  placeholderCode:  { fontFamily: 'monospace', color: C.primary, fontSize: 11 },
}));

export default MiniMap;
