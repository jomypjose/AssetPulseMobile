import React, { useRef } from 'react';
import { View, Animated, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { themed, C, R, S, elevation, cardGradient } from '../theme';

/**
 * The app's standard surface: a card with a soft top-down sheen over
 * `C.card`, a hairline border and a soft shadow — the "glass" look the web
 * app uses, translated to native.
 *
 * Pass `onPress` to make it interactive; it then springs down slightly on
 * touch, which is what makes tapping feel responsive rather than flat.
 */
const GradientCard = ({
  children, style, onPress, disabled,
  padded = true, radius = R.lg, level = 2,
}) => {
  const scale = useRef(new Animated.Value(1)).current;

  const spring = (toValue, speed, bounciness) =>
    Animated.spring(scale, { toValue, speed, bounciness, useNativeDriver: true }).start();

  const body = (
    <LinearGradient
      colors={cardGradient()}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={[
        styles.card,
        { borderRadius: radius },
        padded && styles.padded,
        elevation(level),
        style,
      ]}
    >
      {children}
    </LinearGradient>
  );

  if (!onPress) return body;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => spring(0.975, 40, 0)}
      onPressOut={() => spring(1, 20, 6)}
    >
      <Animated.View style={{ transform: [{ scale }] }}>{body}</Animated.View>
    </Pressable>
  );
};

const styles = themed(() => ({
  card: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  padded: { padding: S.lg },
}));

export default GradientCard;
