import React from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  ScrollView,
  useColorScheme,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import * as Haptics from 'expo-haptics';
import { 
  Bold, 
  Italic, 
  List, 
  ListOrdered, 
  Heading1, 
  Strikethrough
} from 'lucide-react-native';

interface KeyboardToolbarProps {
  isVisible: boolean;
  onFormatText: (formatType: string, prefix?: string, suffix?: string) => void;
  keyboardHeight: number;
  activeFormats: string[];
}

export default function KeyboardToolbar({ 
  isVisible, 
  onFormatText, 
  keyboardHeight,
  activeFormats 
}: KeyboardToolbarProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();

  if (!isVisible || keyboardHeight === 0) {
    return null;
  }

  // Calculate proper bottom position - move toolbar higher
  const bottomPosition = Platform.OS === 'ios' 
    ? keyboardHeight - insets.bottom + 30
    : keyboardHeight + 30;
    
  

  const handleFormatPress = (formatType: string, prefix?: string, suffix?: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onFormatText(formatType, prefix, suffix);
  };

  const formatButtons = [
    {
      icon: Bold,
      label: 'Bold',
      formatType: 'bold',
      onPress: () => handleFormatPress('bold', '**', '**'),
    },
    {
      icon: Italic,
      label: 'Italic', 
      formatType: 'italic',
      onPress: () => handleFormatPress('italic', '*', '*'),
    },
    {
      icon: Strikethrough,
      label: 'Strike',
      formatType: 'strike',
      onPress: () => handleFormatPress('strike', '~~', '~~'),
    },
    {
      icon: Heading1,
      label: 'H1',
      formatType: 'heading1',
      onPress: () => handleFormatPress('heading1', '# ', ''),
    },
    {
      icon: List,
      label: 'Bullet',
      formatType: 'bullet',
      onPress: () => handleFormatPress('bullet', '• ', ''),
    },
    {
      icon: ListOrdered,
      label: 'Number',
      formatType: 'number',
      onPress: () => handleFormatPress('number', '1. ', ''),
    },
  ];

  return (
    <View 
      style={[
        styles.toolbar, 
        { 
          borderTopColor: colors.border,
          bottom: bottomPosition,
          backgroundColor: colorScheme === 'dark' ? 'rgba(17, 17, 17, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        }
      ]}
    >
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {formatButtons.map((button, index) => {
          const IconComponent = button.icon;
          const isActive = activeFormats.includes(button.formatType);
          
          return (
            <TouchableOpacity
              key={index}
              style={[
                styles.formatButton,
                { 
                  backgroundColor: isActive 
                    ? (colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.08)')
                    : 'transparent',
                }
              ]}
              onPress={button.onPress}
              accessibilityLabel={button.label}
              accessibilityRole="button"
              delayPressIn={0}
              delayPressOut={0}
              activeOpacity={0.7}
            >
              <IconComponent
                size={16}
                color={isActive ? colors.text : colors.tabIconDefault}
                strokeWidth={isActive ? 2 : 1.5}
              />
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    position: 'absolute',
    left: 0,
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderTopWidth: 0.5,
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    zIndex: 1000,
    height: 52,
  },
  scrollContent: {
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  formatButton: {
    width: 40,
    height: 40,
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 3,
  },

});
