/**
 * UserAvatar — shows a user's profile photo or a coloured initials fallback.
 *
 * Props:
 *   user       — the user object from AuthContext (needs full_name, username, profile_picture)
 *   serverUrl  — the configured server URL (used to build the full photo URL)
 *   size       — diameter in pixels (default 46)
 *   style      — extra style on the outer container
 *   textStyle  — extra style on the initials text
 */
import React, { useMemo, useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { themed, C } from '../theme';

// Deterministic hue from user's name
const nameToHue = (name = '') => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
    hash |= 0;
  }
  return Math.abs(hash) % 360;
};

const initials = (name) => {
  if (!name) return '?';
  return name.split(' ').map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
};

const UserAvatar = ({ user, serverUrl, size = 46, style, textStyle }) => {
  const [imgError, setImgError] = useState(false);

  const displayName = user?.full_name || user?.username || '';
  const hue         = useMemo(() => nameToHue(displayName), [displayName]);

  // Build full image URL / data URI from the stored profile_picture value.
  // The server stores one of:
  //   • base64 data URI  — "data:image/jpeg;base64,..."  → use directly
  //   • absolute URL     — "https://..."                 → use directly
  //   • relative path    — "/uploads/..."                → prepend server base
  const photoUrl = useMemo(() => {
    const pic = user?.profile_picture;
    if (!pic || imgError) return null;
    if (pic.startsWith('data:'))    return pic;                          // base64
    if (pic.startsWith('http://') || pic.startsWith('https://')) return pic; // absolute
    // Relative path: strip /api suffix from the server URL
    const base = (serverUrl || '').replace(/\/api\/?$/, '').replace(/\/$/, '');
    return base ? `${base}${pic.startsWith('/') ? '' : '/'}${pic}` : null;
  }, [user?.profile_picture, serverUrl, imgError]);

  const borderColor   = `hsl(${hue}, 70%, 60%)`;
  const bgColor       = `hsl(${hue}, 50%, 14%)`;
  const textColor     = `hsl(${hue}, 80%, 72%)`;
  const fontSize      = Math.round(size * 0.3);
  const borderRadius  = size / 2;

  if (photoUrl) {
    return (
      <Image
        source={{ uri: photoUrl }}
        style={[
          styles.img,
          {
            width: size,
            height: size,
            borderRadius,
            borderColor,
          },
          style,
        ]}
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        {
          width: size,
          height: size,
          borderRadius,
          backgroundColor: bgColor,
          borderColor,
        },
        style,
      ]}
    >
      <Text style={[styles.initials, { color: textColor, fontSize }, textStyle]}>
        {initials(displayName)}
      </Text>
    </View>
  );
};

const styles = themed(() => ({
  img: {
    borderWidth: 2,
    resizeMode: 'cover',
  },
  fallback: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontWeight: '800',
  },
}));

export default UserAvatar;
