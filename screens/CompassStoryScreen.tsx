import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Animated,
  Dimensions,
  StatusBar,
  SafeAreaView,
  TouchableWithoutFeedback,
  Image,
} from 'react-native';
import { X } from 'lucide-react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useColorScheme } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/hooks/useAuth';
import { AppStackParamList } from '@/navigation/AppNavigator';
import { AuthStackParamList } from '@/navigation/AuthNavigator';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const STORY_DURATION = 10000; // 10 seconds per story
const TOTAL_STORIES = 6;

type CompassStoryRouteProp = RouteProp<AppStackParamList, 'CompassStory'> | RouteProp<AuthStackParamList, 'CompassStory'>;

// Import compass images
const compassImages = {
  focus: require('@/assets/images/MainFocus.png'),
  blockers: require('@/assets/images/KeyBlockers.png'),
  plan: require('@/assets/images/YourPlan.png'),
};

// Base story content - first 3 pages are always the same
const baseStoryContent = [
  "This is your\npersonal compass.",
  "It will be with you\non this journey.", 
  "It reflects your current state\nof mind and guides\nyour direction.",
];

interface ProgressBarProps {
  index: number;
  currentStory: number;
  progress: Animated.Value;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ index, currentStory, progress }) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const animatedWidth = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    if (index < currentStory) {
      // Completed stories - full width
      Animated.timing(animatedWidth, {
        toValue: 1,
        duration: 100,
        useNativeDriver: false,
      }).start();
    } else if (index === currentStory) {
      // Current story - animate with progress
      const listener = progress.addListener(({ value }) => {
        animatedWidth.setValue(value);
      });
      return () => progress.removeListener(listener);
    } else {
      // Future stories - empty
      animatedWidth.setValue(0);
    }
  }, [currentStory, index, progress, animatedWidth]);

  return (
    <View style={styles.progressBarContainer}>
      <View style={[styles.progressBarBackground, { backgroundColor: `${colors.text}30` }]}>
        <Animated.View
          style={[
            styles.progressBarFill,
            {
              backgroundColor: colors.text,
              width: animatedWidth.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>
    </View>
  );
};

export default function CompassStoryScreen() {
  const navigation = useNavigation();
  const route = useRoute<CompassStoryRouteProp>();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { completeOnboarding } = useAuth();
  
  // Get route parameters
  const { fromOnboarding = false, fromCoaching = false, parsedCoachingData } = route.params || {};
  
  // For now, use dummy data to test the visual design
  const dummyCoachingData = {
    focus: {
      title: "Your Main Focus",
      content: "Design transformative first-time experience.",
      context: "Building trust and depth in first 15 minutes."
    },
    blockers: {
      title: "Key Blockers",
      content: "Why the current experience falls flat.",
      context: "Lacks emotional depth, clear insights, and structured outcome format."
    },
    plan: {
      title: "Your Plan", 
      content: "What to do next.",
      context: "1. Map ideal emotional journey\n2. Design trust-building opening\n3. Create insight+action template"
    }
  };
  
  // Simple story content - first 3 pages stay the same, 4-6 will use special layout
  const storyContent = [...baseStoryContent, "", "", ""]; // Placeholders for pages 4-6
  
  const [currentStory, setCurrentStory] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);

  // Auto-advance story
  useEffect(() => {
    if (isPaused) return;

    progressAnim.setValue(0);
    
    animationRef.current = Animated.timing(progressAnim, {
      toValue: 1,
      duration: STORY_DURATION,
      useNativeDriver: false,
    });

    animationRef.current.start(({ finished }) => {
      if (finished) {
        nextStory();
      }
    });

    return () => {
      if (animationRef.current) {
        animationRef.current.stop();
      }
    };
  }, [currentStory, isPaused]);

  const nextStory = () => {
    if (currentStory < TOTAL_STORIES - 1) {
      setCurrentStory(currentStory + 1);
    } else {
      // End of stories - handle navigation based on source
      handleCompassComplete();
    }
  };

  const handleCompassComplete = async () => {
    if (fromOnboarding) {
      // Complete onboarding and navigate to home
      try {
        await completeOnboarding();
        console.log('✅ Onboarding completed successfully from compass');
      } catch (error) {
        console.error('❌ Failed to complete onboarding:', error);
      }
    } else {
      // Just navigate back (for regular coaching or manual compass viewing)
      navigation.goBack();
    }
  };

  const previousStory = () => {
    if (currentStory > 0) {
      setCurrentStory(currentStory - 1);
    }
  };

  const pauseStory = () => {
    setIsPaused(true);
    if (animationRef.current) {
      animationRef.current.stop();
    }
  };

  const resumeStory = () => {
    setIsPaused(false);
  };

  const handleTapNavigation = (event: any) => {
    const { locationX } = event.nativeEvent;
    const tapArea = screenWidth / 3;
    
    if (locationX < tapArea) {
      // Left tap - previous story
      previousStory();
    } else if (locationX > screenWidth - tapArea) {
      // Right tap - next story  
      nextStory();
    }
  };

  // Render the enhanced coaching insight pages (4-6)
  const renderCoachingInsightPage = () => {
    const pageIndex = currentStory - 3; // 0, 1, 2 for pages 4, 5, 6
    const pageTypes = ['focus', 'blockers', 'plan'] as const;
    const pageColors = ['#2563EB', '#EA580C', '#16A34A'];
    
    const currentType = pageTypes[pageIndex];
    const currentColor = pageColors[pageIndex];
    
    // Use dummy data for now
    const currentData = dummyCoachingData[currentType];
    if (!currentData) return null;

    const { title, content, context } = currentData;

    return (
      <View style={styles.insightPageContainer}>
        {/* Compass Image */}
        <View style={styles.compassImageContainer}>
          <Image 
            source={compassImages[currentType]}
            style={styles.compassImage}
            resizeMode="contain"
          />
        </View>

        {/* Content */}
        <View style={styles.insightContent}>
          {/* Section Title */}
          <Text style={[styles.insightTitle, { color: currentColor }]}>
            {title}
          </Text>

          {/* Main Content */}
          <Text style={[styles.insightMainText, { color: colors.text }]}>
            {content}
          </Text>

          {/* Context/Subtext */}
          {context && (
            <Text style={[styles.insightContext, { color: `${colors.text}80` }]}>
              {context}
            </Text>
          )}
        </View>

        {/* Bottom Section */}
        <View style={styles.insightFooter}>
          <Text style={[styles.updatedText, { color: `${colors.text}60` }]}>
            Updated from today's session.
          </Text>
          
          <TouchableOpacity style={[styles.viewSourcesButton, { backgroundColor: `${colors.text}10` }]}>
            <Text style={[styles.viewSourcesText, { color: `${colors.text}80` }]}>
              View Sources 5+
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar 
        barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} 
        backgroundColor="transparent" 
        translucent 
      />
      
      {/* Progress Bars */}
      <View style={styles.progressContainer}>
        {Array.from({ length: TOTAL_STORIES }).map((_, index) => (
          <ProgressBar
            key={index}
            index={index}
            currentStory={currentStory}
            progress={progressAnim}
          />
        ))}
      </View>

      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Compass</Text>
        <TouchableOpacity
          style={[styles.closeButton, { backgroundColor: `${colors.text}15` }]}
          onPress={handleCompassComplete}
        >
          <X size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Story Content with tap navigation */}
      <TouchableWithoutFeedback onPress={handleTapNavigation}>
        <View style={styles.contentContainer}>
          <View style={styles.storyContent}>
            {/* Pages 1-3: Simple text */}
            {currentStory < 3 && storyContent[currentStory] && (
              <Text style={[styles.storyText, { color: colors.text }]}>
                {storyContent[currentStory]}
              </Text>
            )}
            
            {/* Pages 4-6: Enhanced layout with compass visual */}
            {currentStory >= 3 && renderCoachingInsightPage()}
          </View>
        </View>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  progressContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 4,
    zIndex: 10,
  },
  progressBarContainer: {
    flex: 1,
    height: 2,
  },
  progressBarBackground: {
    flex: 1,
    borderRadius: 1,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    zIndex: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  storyContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyText: {
    fontSize: 28,
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 36,
  },
  // Enhanced insight page styles
  insightPageContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
    paddingVertical: 40,
  },
  compassImageContainer: {
    width: 180,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: -100,
  },
  compassImage: {
    width: 130,
    height: 130,
  },
  insightContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: '100%',
  },
  insightTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 24,
  },
  insightMainText: {
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 32,
    marginBottom: 16,
  },
  insightContext: {
    fontSize: 16,
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 22,
  },
  insightFooter: {
    alignItems: 'center',
    gap: 16,
    marginTop: 40,
  },
  updatedText: {
    fontSize: 14,
    fontWeight: '400',
    textAlign: 'center',
  },
  viewSourcesButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  viewSourcesText: {
    fontSize: 14,
    fontWeight: '500',
  },
}); 