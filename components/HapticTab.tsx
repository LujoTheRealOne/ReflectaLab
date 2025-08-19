import { PlatformPressable } from '@react-navigation/elements';
import * as Haptics from 'expo-haptics';
import React from 'react';

type HapticTabProps = React.ComponentProps<typeof PlatformPressable>;

export function HapticTab(props: HapticTabProps) {
  const { onPress, onPressIn, ...rest } = props;
  
  const handlePress = (event: any) => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress?.(event);
  };
  
  const handlePressIn = (event: any) => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPressIn?.(event);
  };
  
  return (
    <PlatformPressable
      {...rest}
      onPress={handlePress}
      onPressIn={handlePressIn}
    />
  );
}