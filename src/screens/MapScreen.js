/**
 * MapScreen — full-screen interactive branch network map.
 *
 * Receives branch data via its own fetch (caches result in state).
 * Uses a two-way bridge with the Leaflet WebView:
 *   WebView → RN  :  postMessage  (state drill-in, branch tap, back-to-overview)
 *   RN → WebView  :  injectJavaScript  (back button triggers showOverview())
 *
 * Layout
 *   ┌─────────────────────────────────┐
 *   │  ← header (dynamic title)  stats│
 *   ├─────────────────────────────────┤
 *   │                                 │
 *   │      Full-height Leaflet map    │
 *   │                                 │
 *   └──────────────────�▲──────────────┘
 *                  Branch detail panel
 *                  (slides up on tap)
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, ActivityIndicator, BackHandler,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  ArrowLeft, MapPin, X, Network,
  GitBranch, Layers, ChevronRight,
} from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { getBranchMapData } from '../services/api';
import { buildMapHtml } from '../utils/mapHtml';
import { themed, C, R, S, elevation, CHROME } from '../theme';

let WebView = null;
try { WebView = require('react-native-webview').WebView; } catch (_) {}

// ─── Stat chip ────────────────────────────────────────────────────────────────
const StatChip = ({ label, value, color }) => (
  <View style={chip.wrap}>
    <Text style={[chip.value, { color }]}>{value}</Text>
    <Text style={chip.label}>{label}</Text>
  </View>
);
const chip = themed(() => ({
  wrap:  { alignItems: 'center', paddingHorizontal: S.md },
  value: { fontSize: 18, fontWeight: '800', lineHeight: 22 },
  label: { fontSize: 10, color: C.textMuted, fontWeight: '600', letterSpacing: 0.5, marginTop: 1 },
}));

// ─── Detail row (inside bottom panel) ────────────────────────────────────────
const DetailRow = ({ label, children }) => (
  <View style={dr.row}>
    <Text style={dr.label}>{label}</Text>
    <View style={dr.right}>{children}</View>
  </View>
);
const dr = themed(() => ({
  row:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: S.sm },
  label: { fontSize: 12, color: C.textMuted, fontWeight: '500' },
  right: { flexDirection: 'row', alignItems: 'center', gap: S.xs },
}));

// ─── Screen ───────────────────────────────────────────────────────────────────
const MapScreen = ({ navigation }) => {
  const { isDark } = useTheme();
  const insets     = useSafeAreaInsets();

  const [branches,       setBranches]       = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState('');
  const [currentState,   setCurrentState]   = useState(null);  // { name, count }
  const [selectedBranch, setSelectedBranch] = useState(null);  // { name, code, state, net }

  const webViewRef = useRef(null);
  const panelAnim  = useRef(new Animated.Value(0)).current;

  // ── Derived stats ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const states   = new Set(branches.map((b) => b.state).filter(Boolean));
    const devices  = branches.reduce((s, b) => s + (b.network_count || 0), 0);
    return { states: states.size, branches: branches.length, devices };
  }, [branches]);

  // ── Fetch data ─────────────────────────────────────────────────────────────
  useEffect(() => {
    getBranchMapData()
      .then((data) => { setBranches(data.branches || []); setLoading(false); })
      .catch((err)  => { setError(err.message || 'Map unavailable'); setLoading(false); });
  }, []);

  // ── Animate bottom panel ───────────────────────────────────────────────────
  useEffect(() => {
    Animated.spring(panelAnim, {
      toValue: selectedBranch ? 1 : 0,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start();
  }, [selectedBranch]);

  // ── Header back logic ──────────────────────────────────────────────────────
  const handleBack = useCallback(() => {
    if (selectedBranch) {
      setSelectedBranch(null);
      return true;
    }
    if (currentState) {
      // Tell the Leaflet map to return to overview
      webViewRef.current?.injectJavaScript('showOverview(); true;');
      setCurrentState(null);
      return true;
    }
    navigation.goBack();
    return true;
  }, [selectedBranch, currentState, navigation]);

  // Android hardware back
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', handleBack);
    return () => sub.remove();
  }, [handleBack]);

  // ── WebView → RN messages ──────────────────────────────────────────────────
  const handleMessage = useCallback((event) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'state') {
        setCurrentState({ name: msg.name, count: msg.count });
        setSelectedBranch(null);
      } else if (msg.type === 'branch') {
        setSelectedBranch({ name: msg.name, code: msg.code, state: msg.state, net: msg.net });
      } else if (msg.type === 'overview') {
        setCurrentState(null);
        setSelectedBranch(null);
      }
    } catch { /* ignore malformed */ }
  }, []);

  // ── Branch status helpers ──────────────────────────────────────────────────
  const branchStatus = useMemo(() => {
    if (!selectedBranch) return { color: C.textDim, bg: C.card, label: '' };
    const { net } = selectedBranch;
    if (net === 0)  return { color: C.offline, bg: C.offlineBg, label: 'No Devices' };
    if (net <  3)   return { color: C.warning, bg: C.warningBg, label: 'Low Coverage' };
    return          { color: C.online,  bg: C.onlineBg,  label: 'Active' };
  }, [selectedBranch]);

  // ── Map HTML ───────────────────────────────────────────────────────────────
  const html = useMemo(
    () => buildMapHtml(branches, isDark, { postMessage: true, hideTopBar: true }),
    [branches, isDark],
  );

  // ── Panel slide ───────────────────────────────────────────────────────────
  const panelTranslateY = panelAnim.interpolate({
    inputRange: [0, 1], outputRange: [320, 0],
  });
  const overlayOpacity = panelAnim.interpolate({
    inputRange: [0, 1], outputRange: [0, 0.5],
  });

  const isInDrillDown = !!currentState;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn} activeOpacity={0.7}>
          <ArrowLeft
            color={isInDrillDown ? C.primary : C.textSub}
            size={20}
            strokeWidth={2.2}
          />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {isInDrillDown ? currentState.name : 'Branch Network Map'}
          </Text>
          {isInDrillDown ? (
            <Text style={styles.headerSub}>
              {currentState.count} branch{currentState.count !== 1 ? 'es' : ''}
            </Text>
          ) : (
            <Text style={styles.headerSub}>Tap a state to drill down</Text>
          )}
        </View>

        {isInDrillDown ? (
          // Show "All States" pill
          <TouchableOpacity
            style={styles.allStatesBtn}
            onPress={handleBack}
            activeOpacity={0.75}
          >
            <Layers color={C.primary} size={13} strokeWidth={2} />
            <Text style={styles.allStatesText}>All</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.headerRight} />
        )}
      </View>

      {/* ── Stats bar (overview level only) ── */}
      {!loading && !error && !isInDrillDown && (
        <View style={styles.statsBar}>
          <StatChip label="States"   value={stats.states}   color={C.primary} />
          <View style={styles.statDivider} />
          <StatChip label="Branches" value={stats.branches} color={C.cyan}    />
          <View style={styles.statDivider} />
          <StatChip label="Devices"  value={stats.devices}  color={C.online}  />
        </View>
      )}

      {/* ── Map ── */}
      <View style={styles.mapContainer}>
        {loading && (
          <View style={styles.center}>
            <ActivityIndicator color={C.primary} size="large" />
            <Text style={styles.loadingText}>Loading branch network…</Text>
          </View>
        )}

        {!loading && !!error && (
          <View style={styles.center}>
            <MapPin color={C.textDim} size={32} strokeWidth={1.2} />
            <Text style={styles.errorTitle}>Map unavailable</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {!loading && !error && !WebView && (
          <View style={styles.center}>
            <Text style={styles.placeholderEmoji}>🗺️</Text>
            <Text style={styles.errorTitle}>Rebuild required</Text>
            <Text style={styles.errorText}>Run expo run:android once to enable the map.</Text>
          </View>
        )}

        {!loading && !error && !!WebView && (
          <WebView
            key={isDark ? 'dark' : 'light'}
            ref={webViewRef}
            source={{ html }}
            style={styles.webView}
            scrollEnabled={false}
            pinchGestureEnabled={true}
            androidLayerType="hardware"
            javaScriptEnabled
            originWhitelist={['*']}
            scalesPageToFit={false}
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
            onMessage={handleMessage}
          />
        )}
      </View>

      {/* ── Dim overlay (when panel is open) ── */}
      {selectedBranch && (
        <Animated.View
          style={[styles.dimOverlay, { opacity: overlayOpacity }]}
          pointerEvents="box-none"
        >
          <TouchableOpacity
            style={{ flex: 1 }}
            onPress={() => setSelectedBranch(null)}
            activeOpacity={1}
          />
        </Animated.View>
      )}

      {/* ── Branch detail bottom panel ── */}
      <Animated.View
        style={[
          styles.panel,
          { paddingBottom: insets.bottom + S.lg },
          { transform: [{ translateY: panelTranslateY }] },
        ]}
        pointerEvents={selectedBranch ? 'auto' : 'none'}
      >
        {/* Handle */}
        <View style={styles.panelHandle} />

        {selectedBranch && (
          <>
            {/* Panel header */}
            <View style={styles.panelHeader}>
              <View style={[styles.panelIconBox, { backgroundColor: branchStatus.bg }]}>
                <MapPin color={branchStatus.color} size={18} strokeWidth={2} />
              </View>
              <View style={styles.panelHeaderText}>
                <Text style={styles.panelBranchName} numberOfLines={1}>
                  {selectedBranch.name}
                </Text>
                {selectedBranch.code ? (
                  <Text style={styles.panelBranchCode}>
                    Code: {selectedBranch.code}
                  </Text>
                ) : null}
              </View>
              <TouchableOpacity
                onPress={() => setSelectedBranch(null)}
                style={styles.panelClose}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                activeOpacity={0.7}
              >
                <X color={C.textDim} size={18} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            {/* Divider */}
            <View style={styles.panelDivider} />

            {/* Details */}
            <View style={styles.panelBody}>
              <DetailRow label="State">
                <Text style={styles.detailValue}>{selectedBranch.state}</Text>
              </DetailRow>

              <DetailRow label="Network devices">
                <View style={[styles.deviceChip, { backgroundColor: branchStatus.bg, borderColor: `${branchStatus.color}44` }]}>
                  <View style={[styles.deviceDot, { backgroundColor: branchStatus.color }]} />
                  <Text style={[styles.deviceCount, { color: branchStatus.color }]}>
                    {selectedBranch.net}
                  </Text>
                  <Text style={[styles.deviceLabel, { color: branchStatus.color }]}>
                    {branchStatus.label}
                  </Text>
                </View>
              </DetailRow>
            </View>
          </>
        )}
      </Animated.View>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const PANEL_HEIGHT = 220;

const styles = themed(() => ({
  root: { flex: 1, backgroundColor: C.bg },

  // ── Header ──
  header: {
    flexDirection:    'row',
    alignItems:       'center',
    paddingHorizontal: S.md,
    paddingVertical:   S.sm,
    backgroundColor:  CHROME.bg,
    borderBottomWidth: 1,
    borderBottomColor: CHROME.border,
    gap: S.sm,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: R.md,
    backgroundColor: CHROME.buttonBg, borderWidth: 1, borderColor: CHROME.buttonBorder,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  headerCenter: { flex: 1 },
  headerTitle:  { fontSize: 16, fontWeight: '800', color: CHROME.text },
  headerSub:    { fontSize: 11, color: CHROME.textMuted, marginTop: 1 },
  headerRight:  { width: 48 },

  allStatesBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: S.sm, paddingVertical: 6,
    borderRadius: R.sm,
    backgroundColor: C.primaryBg,
    borderWidth: 1, borderColor: `${C.primary}40`,
    flexShrink: 0,
  },
  allStatesText: { fontSize: 11, color: C.primary, fontWeight: '700' },

  // ── Stats bar ──
  statsBar: {
    flexDirection:    'row',
    alignItems:       'center',
    justifyContent:   'center',
    backgroundColor:  C.surface,
    paddingVertical:  S.md,
    paddingHorizontal: S.xl,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  statDivider: { width: 1, height: 30, backgroundColor: C.border },

  // ── Map ──
  mapContainer: { flex: 1 },
  webView:      { flex: 1, backgroundColor: 'transparent' },

  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: S.md,
    paddingHorizontal: S.xxxl,
  },
  loadingText:    { color: C.textMuted, fontSize: 13 },
  placeholderEmoji: { fontSize: 40 },
  errorTitle:     { fontSize: 16, fontWeight: '700', color: C.text },
  errorText:      { fontSize: 13, color: C.textMuted, textAlign: 'center', lineHeight: 19 },

  // ── Dim overlay ──
  dimOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    zIndex: 10,
  },

  // ── Bottom panel ──
  panel: {
    position:        'absolute',
    bottom:          0,
    left:            0,
    right:           0,
    minHeight:       PANEL_HEIGHT,
    backgroundColor: C.card,
    borderTopLeftRadius:  R.xxl,
    borderTopRightRadius: R.xxl,
    borderTopWidth:  1,
    borderColor:     C.border,
    paddingTop:      S.sm,
    paddingHorizontal: S.xl,
    zIndex:          20,
    ...elevation(6),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
  },
  panelHandle: {
    width: 36, height: 4, borderRadius: R.full,
    backgroundColor: C.border,
    alignSelf: 'center',
    marginBottom: S.lg,
  },

  panelHeader: {
    flexDirection: 'row', alignItems: 'center', gap: S.md,
    marginBottom: S.sm,
  },
  panelIconBox: {
    width: 42, height: 42, borderRadius: R.md,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  panelHeaderText:  { flex: 1 },
  panelBranchName:  { fontSize: 17, fontWeight: '800', color: C.text },
  panelBranchCode:  { fontSize: 12, color: C.textMuted, marginTop: 2 },
  panelClose: {
    width: 32, height: 32, borderRadius: R.md,
    backgroundColor: C.cardAlt,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },

  panelDivider: {
    height: 1, backgroundColor: C.borderFaint,
    marginVertical: S.sm,
  },
  panelBody: { gap: S.xs },

  detailValue: { fontSize: 13, fontWeight: '600', color: C.text },

  deviceChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: S.sm, paddingVertical: 4,
    borderRadius: R.sm, borderWidth: 1,
  },
  deviceDot:   { width: 6, height: 6, borderRadius: R.full },
  deviceCount: { fontSize: 13, fontWeight: '800' },
  deviceLabel: { fontSize: 11, fontWeight: '600' },
}));

export default MapScreen;
