import React, { useEffect, useState } from 'react';
import { View, Keyboard } from 'react-native';
import BottomNavBar from './BottomNavBar';

interface ScreenWrapperProps {
  children: React.ReactNode;
  showNavBar?: boolean;
}

export default function ScreenWrapper({ children, showNavBar = true }: ScreenWrapperProps) {
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  // Listen for keyboard events
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
      setIsKeyboardVisible(true);
    });
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setIsKeyboardVisible(false);
    });

    return () => {
      keyboardDidShowListener?.remove();
      keyboardDidHideListener?.remove();
    };
  }, []);

  return (
    <View style={{ flex: 1 }}>
      {children}
      {showNavBar && <BottomNavBar isVisible={!isKeyboardVisible} />}
    </View>
  );
}
