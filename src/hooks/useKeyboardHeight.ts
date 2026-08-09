import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * Current on-screen keyboard height, or 0 when hidden.
 *
 * Preferred over `KeyboardAvoidingView` for content inside a `<Modal>` here:
 * the app is edge-to-edge with targetSdk 36, and from Android 15 the window no
 * longer auto-insets for `adjustResize`, so `behavior="height"` has nothing
 * dependable to shrink against. A Modal is also its own window, which makes the
 * component's screen-frame maths unreliable. Padding driven straight off the
 * keyboard events avoids both problems.
 */
export const useKeyboardHeight = (): number => {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    // iOS gets the "will" events so the padding animates with the keyboard;
    // Android only reports reliable metrics on the "did" events.
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates?.height ?? 0);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return keyboardHeight;
};
