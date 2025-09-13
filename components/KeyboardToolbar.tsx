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
  Heading,
  X
} from 'lucide-react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming 
} from 'react-native-reanimated';

interface KeyboardToolbarProps {
  isVisible: boolean;
  onFormatText: (formatType: string) => void;
  keyboardHeight: number;
  activeFormats: string[];
}

export default function KeyboardToolbar({ 
  isVisible, 
  onFormatText, 
  keyboardHeight,
  activeFormats 
}: KeyboardToolbarProps) {
  // All hooks must be called before any conditional returns
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const rotation = useSharedValue(0);

  const [lastClickTime, setLastClickTime] = React.useState(0);
  const [processingFormat, setProcessingFormat] = React.useState<string | null>(null);

  const handleFormatPress = (formatType: string) => {
    const now = Date.now();
    
    // Prevent rapid successive clicks (debouncing)
    if (now - lastClickTime < 200) {
      console.log(`🚫 KeyboardToolbar: Blocked rapid click on ${formatType}`);
      return;
    }

    // Prevent clicking while another format is processing
    if (processingFormat && processingFormat !== formatType) {
      console.log(`🚫 KeyboardToolbar: Blocked click - ${processingFormat} is processing`);
      return;
    }

    setLastClickTime(now);
    setProcessingFormat(formatType);
    
    // Clear processing state after a delay
    setTimeout(() => {
      setProcessingFormat(null);
    }, 300);

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onFormatText(formatType);
  };

  const handleToggleCollapse = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsCollapsed(!isCollapsed);
    // Animate rotation: 0 degrees (X) to 45 degrees (+)
    rotation.value = withTiming(isCollapsed ? 0 : 45, { duration: 200 });
  };

  const animatedIconStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${rotation.value}deg` }],
    };
  });

  // Early return after all hooks are defined
  if (!isVisible || keyboardHeight === 0) {
    return null;
  }

  // Calculate proper bottom position - move toolbar higher
  const bottomPosition = Platform.OS === 'ios' 
    ? keyboardHeight - insets.bottom + 30
    : keyboardHeight + 30;
  
  // Collapsed button position - higher than toolbar
  const collapsedBottomPosition = Platform.OS === 'ios' 
    ? keyboardHeight - insets.bottom + 38
    : keyboardHeight + 38;

  const formatButtons = [
    {
      icon: Heading,
      label: 'Heading',
      formatType: 'heading1',
      onPress: () => handleFormatPress('heading1'),
    },
    {
      icon: Bold,
      label: 'Bold',
      formatType: 'bold',
      onPress: () => handleFormatPress('bold'),
    },
    {
      icon: Italic,
      label: 'Italic', 
      formatType: 'italic',
      onPress: () => handleFormatPress('italic'),
    },
    {
      icon: List,
      label: 'Bullet List',
      formatType: 'bullet',
      onPress: () => handleFormatPress('bullet'),
    },
    {
      icon: ListOrdered,
      label: 'Numbered List',
      formatType: 'number',
      onPress: () => handleFormatPress('number'),
    },
  ];

  if (isCollapsed) {
    // Collapsed state - show only toggle button without extra container
    return (
      <View 
        style={[
          styles.collapsedContainer, 
          { 
            bottom: collapsedBottomPosition,
            backgroundColor: colorScheme === 'dark' ? 'rgba(28, 28, 30, 0.95)' : 'rgba(248, 248, 248, 0.95)',
          }
        ]}
      >
        <TouchableOpacity
          style={[
            styles.collapsedButton,
            {
              backgroundColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
            }
          ]}
          onPress={handleToggleCollapse}
          accessibilityLabel="Expand toolbar"
          accessibilityRole="button"
          activeOpacity={0.6}
        >
          <Animated.View style={animatedIconStyle}>
            <X
              size={18}
              color={colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)'}
              strokeWidth={1.5}
            />
          </Animated.View>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View 
      style={[
        styles.toolbar, 
        { 
          borderTopColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          bottom: bottomPosition,
          backgroundColor: colorScheme === 'dark' ? 'rgba(28, 28, 30, 0.95)' : 'rgba(248, 248, 248, 0.95)',
        }
      ]}
    >
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1 }}
      >
        {formatButtons.map((button, index) => {
          const IconComponent = button.icon;
          const isActive = activeFormats.includes(button.formatType);
          const isProcessing = processingFormat === button.formatType;
          
          return (
            <TouchableOpacity
              key={index}
              style={[
                styles.formatButton,
                { 
                  backgroundColor: isActive 
                    ? (colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)')
                    : isProcessing
                    ? (colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)')
                    : 'transparent',
                  borderRadius: 8,
                  opacity: isProcessing ? 0.7 : 1,
                }
              ]}
              onPress={button.onPress}
              accessibilityLabel={button.label}
              accessibilityRole="button"
              delayPressIn={0}
              delayPressOut={0}
              activeOpacity={0.6}
              disabled={isProcessing}
            >
              <IconComponent
                size={22}
                color={isActive 
                  ? (colorScheme === 'dark' ? '#FFFFFF' : '#000000')
                  : (colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)')
                }
                strokeWidth={isActive ? 2 : 1.5}
              />
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Close/Collapse Button */}
      <TouchableOpacity
        style={[
          styles.closeButton,
          {
            backgroundColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
          }
        ]}
        onPress={handleToggleCollapse}
        accessibilityLabel="Collapse toolbar"
        accessibilityRole="button"
        activeOpacity={0.6}
      >
        <Animated.View style={animatedIconStyle}>
          <X
            size={18}
            color={colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)'}
            strokeWidth={1.5}
          />
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingVertical: 8,
    paddingLeft: 16,
    paddingRight: 8,
    borderTopWidth: 0.5,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    zIndex: 1000,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
  },
  scrollContent: {
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 8,
  },
  formatButton: {
    width: 44,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  collapsedContainer: {
    position: 'absolute',
    right: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    zIndex: 1000,
  },
  collapsedButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
