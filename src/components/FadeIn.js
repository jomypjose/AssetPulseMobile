import React, { useRef, useEffect } from 'react';
import { Animated } from 'react-native';

/**
 * Subtle fade-in entrance for a screen's content, mirroring the mount
 * animation LoginScreen already uses for its card. Runs on mount only.
 *
 * Opacity ONLY — deliberately no translate. A native-driver `translateY` on
 * a wrapper around a FlatList breaks touch hit-testing on Android: the list
 * renders and scrolls, but taps on its rows never fire. Opacity doesn't
 * affect hit geometry, so it's safe around scrollable content.
 */
const FadeIn = ({ children, style, delay = 0, duration = 280 }) => {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration,
      delay,
      useNativeDriver: true,
    }).start();
  }, [anim, delay, duration]);

  return (
    <Animated.View style={[style, { opacity: anim }]}>
      {children}
    </Animated.View>
  );
};

export default FadeIn;
