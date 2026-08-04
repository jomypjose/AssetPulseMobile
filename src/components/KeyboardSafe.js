/**
 * KeyboardSafe — drop-in replacement for the root <View> on any screen that
 * has TextInputs. Ensures the keyboard never covers the focused field.
 *
 * Use:
 *   <KeyboardSafe>
 *     ...screen contents with TextInput...
 *   </KeyboardSafe>
 *
 * Why: with `expo.edgeToEdgeEnabled=true` the Android system stops auto-
 * shrinking the layout for the keyboard, so even `adjustResize` in the
 * manifest leaves the input under the keys. `KeyboardAvoidingView` is the
 * canonical fix on both platforms.
 */
import React from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { themed, C } from '../theme';

const KeyboardSafe = ({ children, style, extraOffset = 0, ...rest }) => {
  return (
    <KeyboardAvoidingView
      style={[styles.root, style]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={extraOffset}
      {...rest}
    >
      {children}
    </KeyboardAvoidingView>
  );
};

const styles = themed(() => ({
  root: { flex: 1, backgroundColor: C.bg },
}));

export default KeyboardSafe;
