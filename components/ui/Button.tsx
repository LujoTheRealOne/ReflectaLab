import * as Haptics from 'expo-haptics';
import React from 'react';
import {
  ActivityIndicator,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  TouchableOpacityProps,
  View,
  ViewStyle
} from 'react-native';

import { Colors } from '@/constants/Colors';
import { useThemeColor } from '@/hooks/useThemeColor';

export type ButtonVariant = 'primary' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
export type ButtonSize = 'default' | 'sm' | 'lg' | 'icon';

export interface ButtonProps extends TouchableOpacityProps {
  children?: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  disabled?: boolean;
  textStyle?: StyleProp<TextStyle>;
  lightColor?: string;
  darkColor?: string;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  iconOnly?: React.ReactNode;
}

export function Button({
  children,
  variant = 'primary',
  size = 'default',
  isLoading = false,
  disabled = false,
  style,
  textStyle,
  lightColor,
  darkColor,
  onPress,
  iconLeft,
  iconRight,
  iconOnly,
  ...rest
}: ButtonProps) {
  const theme = useColorScheme() ?? 'light';
  const backgroundColor = useThemeColor(
    {
      light: lightColor,
      dark: darkColor
    },
    'background'
  );
  const textColor = useThemeColor({}, 'text');

  // Get button styling based on variant
  const getVariantStyle = (): StyleProp<ViewStyle> => {
    switch (variant) {
      case 'primary':
        return {
          borderColor: theme === 'light' ? Colors.light.tint : Colors.dark.tint,
          backgroundColor: theme === 'light' ? Colors.light.tint : Colors.dark.tint,
        };
      case 'destructive':
        return {
          borderColor: '#FF3B30',
          backgroundColor: '#FF3B30',
        };
      case 'outline':
        return {
          backgroundColor: 'transparent',
          borderColor: theme === 'light' ? '#E5E5E7' : '#333',
        };
      case 'secondary':
        return {
          borderColor: theme === 'light' ? '#EEEEEE' : '#222',
          backgroundColor: theme === 'light' ? '#EEEEEE' : '#222',
        };
      case 'ghost':
        return {
          borderWidth: 0,
          backgroundColor: 'transparent',
        };
      case 'link':
        return {
          borderWidth: 0,
          backgroundColor: 'transparent',
        };
      default:
        return {};
    }
  };

  // Get text color based on variant
  const getTextColor = (): string => {
    switch (variant) {
      case 'primary':
        return theme === 'light' ? '#FFFFFF' : '#000000';
      case 'destructive':
        return '#FFFFFF';
      case 'outline':
      case 'ghost':
      case 'link':
        return theme === 'light' ? Colors.light.text : Colors.dark.text;
      case 'secondary':
        return theme === 'light' ? Colors.light.text : Colors.dark.text;
      default:
        return textColor;
    }
  };

  // Get button size styling
  const getSizeStyle = (): StyleProp<ViewStyle> => {
    switch (size) {
      case 'sm':
        return styles.sizeSmall;
      case 'lg':
        return styles.sizeLarge;
      case 'icon':
        return styles.sizeIcon;
      default:
        return styles.sizeDefault;
    }
  };

  // Get text size styling
  const getTextSizeStyle = (): StyleProp<TextStyle> => {
    switch (size) {
      case 'sm':
        return styles.textSmall;
      case 'lg':
        return styles.textLarge;
      case 'icon':
        return styles.textIcon;
      default:
        return styles.textDefault;
    }
  };

  const handlePress = (event: any) => {
    if (!disabled && !isLoading && onPress) {
      // Add haptic feedback on press
      if (variant === 'destructive') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      onPress(event);
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={[
        styles.button,
        getSizeStyle(),
        getVariantStyle(),
        disabled && styles.disabled,
        style,
      ]}
      onPress={handlePress}
      disabled={disabled || isLoading}
      {...rest}
    >
      {isLoading ? (
        <ActivityIndicator
          size="small"
          color={getTextColor()}
        />
      ) : (
        <View style={styles.content}>
          {iconLeft && <View style={styles.icon}>{iconLeft}</View>}
          {typeof children === 'string' ? (
            <Text
              style={[
                {
                  color: getTextColor(),
                  fontWeight: '600',
                },
                getTextSizeStyle(),
                textStyle,
              ]}
            >
              {children}
            </Text>
          ) : (
            children
          )}
          {iconRight && <View style={styles.icon}>{iconRight}</View>}
          {iconOnly && <View style={styles.icon}>{iconOnly}</View>}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  disabled: {
    opacity: 0.5,
  },
  // Size styles
  sizeDefault: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    minWidth: 64,
  },
  sizeSmall: {
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    minWidth: 48,
  },
  sizeLarge: {
    paddingVertical: 18,
    paddingHorizontal: 24,
    minWidth: 80,
  },
  sizeIcon: {
    width: 40,
    height: 40,
    padding: 0,
    minWidth: 40,
  },
  // Text size styles
  textDefault: {
    fontSize: 16,
    lineHeight: 24,
  },
  textSmall: {
    fontSize: 14,
    lineHeight: 20,
  },
  textLarge: {
    fontSize: 18,
    lineHeight: 28,
  },
  textIcon: {
    fontSize: 0,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  icon: {
    marginHorizontal: 4,
  },
});

// For convenience, we're also importing directly from React Native
export const useColorScheme = () => {
  return (require('react-native').useColorScheme)();
}; 