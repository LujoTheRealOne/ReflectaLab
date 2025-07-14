import Editor from '@/components/TipTap';
import { Colors } from '@/constants/Colors';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { ArrowDown, Check, User, UserCog } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View
} from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedGestureHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';

type DrawerNavigation = DrawerNavigationProp<any>;

export default function HomeContent() {
  const navigation = useNavigation<DrawerNavigation>();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  // Get today's date in the format shown in screenshot
  const today = new Date();
  const formattedDate = today.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' });
  const time = today.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const [entry, setEntry] = useState('');
  const [editorLoaded, setEditorLoaded] = useState(false);
  const [hasTriggeredHaptic, setHasTriggeredHaptic] = useState(false);

  // Animation values
  const translateY = useSharedValue(0);
  const TRIGGER_THRESHOLD = 200; // Pixels to trigger haptic and console log

  // Gesture handler functions
  const triggerHapticFeedback = () => {
    if (!hasTriggeredHaptic) {
      setHasTriggeredHaptic(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      console.log("created");
    }
  };

  const resetHapticFlag = () => {
    setHasTriggeredHaptic(false);
  };

  const gestureHandler = useAnimatedGestureHandler({
    onStart: (_, context: any) => {
      context.startY = translateY.value;
    },
    onActive: (event, context: any) => {
      const newTranslateY = Math.max(0, context.startY + event.translationY);
      translateY.value = newTranslateY;

      // Trigger haptic feedback and console log when threshold is reached
      if (newTranslateY >= TRIGGER_THRESHOLD) {
        runOnJS(triggerHapticFeedback)();
      }
    },
    onEnd: () => {
      // Always snap back to original position with controlled spring
      translateY.value = withSpring(0, {
        damping: 20,
        stiffness: 300,
        overshootClamping: true
      });
      runOnJS(resetHapticFlag)();
    },
  });

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
    };
  });

  const textAnimatedStyle = useAnimatedStyle(() => {
    const opacity = translateY.value > 5 ? 1 : 0; // Show text when sliding starts
    return {
      transform: [{ translateY: translateY.value / 2 + 20 }], // Stay centered in revealed black area
      opacity,
    };
  });

  const curvedEdgesStyle = useAnimatedStyle(() => {
    const maxBorderRadius = 30;
    const borderRadius = Math.min((translateY.value / TRIGGER_THRESHOLD) * maxBorderRadius, maxBorderRadius);
    return {
      borderTopLeftRadius: borderRadius,
      borderTopRightRadius: borderRadius,
    };
  });

  return (
    <View style={[styles.container, { backgroundColor: 'black' }]}>

      {/* Floating text that follows the gesture */}
      <Animated.View style={[styles.floatingText, textAnimatedStyle]}>
        <Text style={styles.instructionText}>Swipe down to create</Text>
        <Animated.View>
          {translateY.value < 30 ?
            <ArrowDown size={24} color={'white'} />
            :
            <Check size={24} color={'white'} />
          }
        </Animated.View>
      </Animated.View>

      {/* Main content that slides down */}
      <PanGestureHandler onGestureEvent={gestureHandler}>
        <Animated.View style={[styles.mainContent, animatedStyle, curvedEdgesStyle]}>
          <Animated.View style={[styles.safeArea, { backgroundColor: colors.background }, curvedEdgesStyle]}>
            <SafeAreaView style={[styles.safeAreaInner]}>
              {/* Header */}
              <View style={styles.header}>
                <TouchableOpacity onPress={() => {
                  navigation.navigate('Settings' as never);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}>
                  <UserCog size={28} color={colors.text} />
                </TouchableOpacity>
              </View>

              {/* Content */}
              <View style={styles.content}>
                <Text style={{ fontSize: 16, marginTop: 10, marginRight: 5, color: colors.text, textAlign: 'right', opacity: 0.3 }}>Saved</Text>
                {/* Date Input */}
                <View style={{ flexDirection: 'row', gap: 15, alignItems: 'center' }}>
                  <Text
                    style={[styles.dateText, { color: colors.text }]}
                  >
                    {formattedDate}
                  </Text>
                  <View style={{ width: 30, height: 3, backgroundColor: 'orange', borderRadius: 5 }} />
                  <Text
                    style={[styles.timeText, { color: colors.text, opacity: 0.5 }]}
                  >
                    {time}
                  </Text>
                </View>

                {/* Thoughts Section */}
                <View style={{ flex: 1 }}>
                  <Editor content={entry} onUpdate={setEntry} isLoaded={setEditorLoaded} />
                </View>
              </View>
            </SafeAreaView>
          </Animated.View>
        </Animated.View>
      </PanGestureHandler>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  floatingText: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    pointerEvents: 'none',
  },
  instructionText: {
    color: 'white',
    fontSize: 24,
    fontWeight: '500',
    opacity: 1,
    marginBottom: 10,
  },
  mainContent: {
    flex: 1,
    backgroundColor: 'transparent',
    zIndex: 2,
  },
  safeArea: {
    flex: 1,
  },
  safeAreaInner: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  dateText: {
    fontSize: 28,
    fontWeight: '600',
    paddingVertical: 10,
  },
  timeText: {
    fontSize: 16,
    fontWeight: '400',
    paddingVertical: 10,
  },
  journalInput: {
    minHeight: 100,
    fontSize: 16,
    lineHeight: 24,
    textAlignVertical: 'top',
  },
  floatingButtons: {
    position: 'absolute',
    alignItems: 'flex-end',
    bottom: 30,
    right: 20,
    gap: 15,
  },
  floatingButton: {
    width: 56,
    height: 56,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
}); 