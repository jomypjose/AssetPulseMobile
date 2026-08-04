/**
 * WeatherChip — compact temperature + condition pill that opens a detailed
 * weather card on tap.
 *
 * Requests location once on mount (cached in module state so subsequent
 * screen mounts skip GPS), then queries Open-Meteo (no API key needed) for
 * current conditions + today's high/low. Renders nothing while loading and
 * silently hides if anything fails (permissions denied, no network, etc.).
 *
 * Drop into any screen header:
 *   <WeatherChip />
 */
import React, { useEffect, useState } from 'react';
import { View, Text, Modal, Pressable, TouchableOpacity } from 'react-native';
import {
  CloudSun, Cloud, CloudRain, CloudSnow, CloudLightning, CloudFog, Sun,
  Droplets, Wind, Thermometer, ArrowUp, ArrowDown, MapPin, X,
} from 'lucide-react-native';
import { themed, C, R, S, elevation } from '../theme';

let Location = null;
try { Location = require('expo-location'); } catch (_) { /* not installed */ }

// Module-level cache so we don't re-prompt for location on every screen mount.
let _cache = null;          // { temp, feelsLike, humidity, wind, precip, code, hi, lo, city, region, country, lat, lng, ts }
const CACHE_MS = 15 * 60 * 1000;  // 15 minutes

// Open-Meteo "weather code" → icon + label.
// https://open-meteo.com/en/docs#weathervariables
const codeMeta = (code) => {
  if (code === 0)                 return { Icon: Sun,           label: 'Clear' };
  if (code >= 1 && code <= 3)     return { Icon: CloudSun,      label: 'Partly cloudy' };
  if (code >= 45 && code <= 48)   return { Icon: CloudFog,      label: 'Fog' };
  if (code >= 51 && code <= 67)   return { Icon: CloudRain,     label: 'Rain' };
  if (code >= 71 && code <= 77)   return { Icon: CloudSnow,     label: 'Snow' };
  if (code >= 80 && code <= 82)   return { Icon: CloudRain,     label: 'Showers' };
  if (code >= 95 && code <= 99)   return { Icon: CloudLightning, label: 'Thunderstorm' };
  return { Icon: Cloud, label: 'Cloudy' };
};

const fetchWeather = async () => {
  if (!Location) throw new Error('expo-location not installed');
  // Cached value still fresh? reuse.
  if (_cache && Date.now() - _cache.ts < CACHE_MS) return _cache;

  const perm = await Location.requestForegroundPermissionsAsync();
  if (perm.status !== 'granted') throw new Error('Location permission denied');

  const loc = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy?.Balanced ?? 3,
  });
  const { latitude, longitude } = loc.coords;

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation` +
    `&daily=temperature_2m_max,temperature_2m_min&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weather API ${res.status}`);
  const data = await res.json();
  const cur = data?.current || {};
  const temp = cur.temperature_2m;
  const code = cur.weather_code;
  if (temp == null || code == null) throw new Error('Empty weather payload');

  // Place name via the device's on-device reverse geocoder (reliable, no key).
  let city = '', region = '', country = '';
  try {
    const places = await Location.reverseGeocodeAsync({ latitude, longitude });
    const p = places?.[0] || {};
    city    = p.city || p.subregion || p.district || p.name || '';
    region  = p.region || '';
    country = p.country || '';
  } catch { /* ignore */ }

  _cache = {
    temp,
    feelsLike: cur.apparent_temperature,
    humidity:  cur.relative_humidity_2m,
    wind:      cur.wind_speed_10m,
    precip:    cur.precipitation,
    code,
    hi: data?.daily?.temperature_2m_max?.[0],
    lo: data?.daily?.temperature_2m_min?.[0],
    city, region, country,
    lat: latitude, lng: longitude,
    ts: Date.now(),
  };
  return _cache;
};

// ─── Detail row inside the modal ──────────────────────────────────────────────
const DetailItem = ({ icon: Icon, label, value }) => (
  <View style={styles.detailItem}>
    <Icon color={C.textMuted} size={16} strokeWidth={2} />
    <View style={styles.detailText}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  </View>
);

const WeatherChip = ({ onPress, compact = false }) => {
  const [state, setState]   = useState(null);   // weather object | null
  const [loading, setLoading] = useState(true);
  const [open, setOpen]     = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const w = await fetchWeather();
        if (!cancelled) setState(w);
      } catch {
        if (!cancelled) setState(null);   // silently hide
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handlePress = () => {
    if (onPress) return onPress();
    if (state) setOpen(true);
  };

  // While loading, render nothing (prevents header layout shift / flash).
  if (loading || !state) return null;

  const { Icon, label } = codeMeta(state.code);
  const round = (n) => (n == null ? '—' : Math.round(n));
  const placeLine = [state.city, state.region, state.country].filter(Boolean).join(', ');

  return (
    <>
      <TouchableOpacity
        style={[styles.chip, compact && styles.chipCompact]}
        onPress={handlePress}
        activeOpacity={0.75}
      >
        <Icon color={C.primary} size={14} strokeWidth={2.2} />
        <Text style={styles.temp}>{round(state.temp)}°</Text>
        {!compact && (
          <Text style={styles.sub} numberOfLines={1}>
            {state.city || label}
          </Text>
        )}
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
        statusBarTranslucent
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.card} onPress={() => {}}>
            {/* Close */}
            <TouchableOpacity style={styles.close} onPress={() => setOpen(false)} hitSlop={10}>
              <X color={C.textMuted} size={18} strokeWidth={2.2} />
            </TouchableOpacity>

            {/* Location */}
            <View style={styles.locRow}>
              <MapPin color={C.primary} size={15} strokeWidth={2.2} />
              <Text style={styles.locText} numberOfLines={2}>
                {placeLine || 'Current location'}
              </Text>
            </View>

            {/* Hero: big temp + condition */}
            <View style={styles.hero}>
              <Icon color={C.primary} size={52} strokeWidth={1.6} />
              <View>
                <Text style={styles.heroTemp}>{round(state.temp)}°C</Text>
                <Text style={styles.heroLabel}>{label}</Text>
              </View>
            </View>

            {/* Details grid */}
            <View style={styles.grid}>
              <DetailItem icon={Thermometer} label="Feels like" value={`${round(state.feelsLike)}°`} />
              <DetailItem icon={Droplets}    label="Humidity"   value={state.humidity == null ? '—' : `${round(state.humidity)}%`} />
              <DetailItem icon={Wind}        label="Wind"       value={state.wind == null ? '—' : `${round(state.wind)} km/h`} />
              <DetailItem icon={CloudRain}   label="Precip."    value={state.precip == null ? '—' : `${state.precip} mm`} />
              <DetailItem icon={ArrowUp}     label="High"       value={`${round(state.hi)}°`} />
              <DetailItem icon={ArrowDown}   label="Low"        value={`${round(state.lo)}°`} />
            </View>

            {/* Coordinates */}
            <Text style={styles.coords}>
              {state.lat?.toFixed(3)}, {state.lng?.toFixed(3)}
            </Text>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = themed(() => ({
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: S.sm + 2, paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: R.full,
    maxWidth: 160,
  },
  chipCompact: { paddingHorizontal: S.sm, paddingVertical: 3 },
  temp:        { fontSize: 13, fontWeight: '800', color: '#e8edf5' },
  sub:         { fontSize: 11, color: '#c8d4e8', fontWeight: '600', flexShrink: 1 },

  // ── Modal ──
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center', padding: S.xl,
  },
  card: {
    width: '100%', maxWidth: 360,
    backgroundColor: C.card, borderRadius: R.xl,
    borderWidth: 1, borderColor: C.border,
    padding: S.xl, ...elevation(4),
  },
  close: { position: 'absolute', top: S.md, right: S.md, padding: 4, zIndex: 2 },

  locRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: S.xl },
  locText: { fontSize: 13, color: C.textSub, fontWeight: '600', flexShrink: 1 },

  hero:      { flexDirection: 'row', alignItems: 'center', gap: S.lg, marginVertical: S.lg },
  heroTemp:  { fontSize: 40, fontWeight: '800', color: C.text, lineHeight: 44 },
  heroLabel: { fontSize: 14, color: C.textSub, fontWeight: '600' },

  grid: {
    flexDirection: 'row', flexWrap: 'wrap',
    borderTopWidth: 1, borderTopColor: C.borderFaint, paddingTop: S.md,
  },
  detailItem: {
    width: '50%', flexDirection: 'row', alignItems: 'center', gap: S.sm,
    paddingVertical: S.sm,
  },
  detailText:  { gap: 1 },
  detailLabel: { fontSize: 10, color: C.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  detailValue: { fontSize: 15, color: C.text, fontWeight: '700' },

  coords: {
    fontSize: 10, color: C.textDim, textAlign: 'center',
    marginTop: S.md, fontVariant: ['tabular-nums'],
  },
}));

export default WeatherChip;
