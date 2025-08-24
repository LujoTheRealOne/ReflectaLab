import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { useColorScheme } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/hooks/useAuth';
import { useRevenueCat } from '@/hooks/useRevenueCat';
import { AppStackParamList } from '@/navigation/AppNavigator';
import { AuthStackParamList } from '@/navigation/AuthNavigator';
import SourcesModal, { InsightSource } from '@/components/SourcesModal';
import { useInsights } from '@/hooks/useInsights';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const STORY_DURATION = 10000; // 10 seconds per story
const TOTAL_STORIES = 6;

// Animated Spinner Component
const AnimatedSpinner = ({ size = 12, colors, style }: { size?: number, colors: any, style?: any }) => {
  const spinValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const spinAnimation = Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      })
    );

    spinAnimation.start();

    return () => {
      spinAnimation.stop();
    };
  }, [spinValue]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: Math.max(1.5, size / 8),
          borderColor: `${colors.text}20`,
          borderTopColor: `${colors.text}80`,
          transform: [{ rotate: spin }],
        },
        style,
      ]}
    />
  );
};

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
  const { completeOnboarding, firebaseUser } = useAuth();
  const { isPro, presentPaywallIfNeeded, currentOffering, initialized } = useRevenueCat(firebaseUser?.uid);
  
  // Real insights data
  const { insights, loading: insightsLoading, error: insightsError, hasInsights } = useInsights();
  
  // Sources Modal State
  const [showSourcesModal, setShowSourcesModal] = useState(false);
  const [selectedSources, setSelectedSources] = useState<{
    title: string;
    sources: InsightSource[];
  } | null>(null);
  const sourcesModalOpacity = useRef(new Animated.Value(0)).current;
  
  // Get route parameters  
  const routeParams = route.params as {
    fromOnboarding?: boolean;
    fromCoaching?: boolean;
    sessionId?: string;
    parsedCoachingData?: {
      components: Array<{ type: string; props: Record<string, string> }>;
      rawData: string;
    };
  } | undefined;
  
  const { fromOnboarding = false, fromCoaching = false, sessionId, parsedCoachingData } = routeParams || {};
  
  // Guard refs for subscription check
  const paywallShownRef = useRef<boolean>(false);
  const accessCheckedRef = useRef<boolean>(false);
  
  // Gate access: ALL compass features require Pro. Run once per focus, after RevenueCat initialized.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const check = async () => {
        if (accessCheckedRef.current) return;
        if (!initialized) return; // wait for RC init
        accessCheckedRef.current = true;
        
        // Allow onboarding completion without subscription check
        if (fromOnboarding) {
          console.log('✅ Allowing compass access for onboarding completion - no premium required');
          console.log('🎯 Route params:', { fromOnboarding, fromCoaching, sessionId });
          return;
        }
        
        // Prevent multiple paywall presentations
        if (paywallShownRef.current) {
          return;
        }
        
        console.log('🔒 Compass access check:', { isPro, fromCoaching });
        if (!isPro) {
          console.log('🚫 Not Pro, showing paywall for compass access');
          paywallShownRef.current = true;
          const unlocked = await presentPaywallIfNeeded('reflecta_pro', currentOffering || undefined);
          if (!unlocked && !cancelled) {
            console.log('🔙 Paywall cancelled, going back');
            navigation.goBack();
          } else if (unlocked) {
            console.log('✅ Pro unlocked via paywall for compass');
            // Reset flag so future navigation works
            paywallShownRef.current = false;
          }
        } else {
          console.log('✅ Pro user, allowing compass access');
        }
      };
      check();
      return () => { cancelled = true; accessCheckedRef.current = false; };
    }, [initialized, isPro, presentPaywallIfNeeded, currentOffering, navigation, fromOnboarding])
  );
  
  // Debug: Log the received coaching data and insights status
  useEffect(() => {
    if (parsedCoachingData) {
      console.log('🧭 CompassStory received parsed coaching data:', parsedCoachingData);
      console.log('  Components count:', parsedCoachingData.components?.length || 0);
      parsedCoachingData.components?.forEach((comp: any, index: number) => {
        console.log(`  ${index + 1}. ${comp.type}:`, comp.props);
      });
    } else {
      console.log('🧭 CompassStory: No parsed coaching data received, using fallback');
    }
  }, [parsedCoachingData]);

  // Log insights loading status and detailed content
  useEffect(() => {
    console.log('🧭 Insights status:', { 
      loading: insightsLoading, 
      hasInsights, 
      error: insightsError,
      insightsAvailable: !!insights 
    });

    // Log detailed insights data when available
    if (insights) {
      console.log('🧭 Full insights data:', {
        mainFocus: {
          headline: insights.mainFocus.headline,
          sourcesCount: insights.mainFocus.sources?.length || 0,
          sources: insights.mainFocus.sources
        },
        keyBlockers: {
          headline: insights.keyBlockers.headline,
          sourcesCount: insights.keyBlockers.sources?.length || 0,
          sources: insights.keyBlockers.sources
        },
        plan: {
          headline: insights.plan.headline,
          sourcesCount: insights.plan.sources?.length || 0,
          sources: insights.plan.sources
        },
        userId: insights.userId,
        updatedAt: insights.updatedAt
      });
    }
  }, [insightsLoading, hasInsights, insightsError, insights]);
  
  // Debug: Log session information
  useEffect(() => {
    if (sessionId) {
      console.log('🧭 Compass screen opened with session ID:', sessionId);
      console.log('🔄 Insights should be extracted automatically or need manual trigger...');
    }
  }, [sessionId]);
  
  // Process real insights data or fallback to coaching/placeholder data
  const processCompassData = () => {
    // Priority 1: Use real insights data if available
    if (insights) {
      console.log('🎯 Using real insights data for compass:', insights);
      return {
        focus: {
          title: "Your Main Focus",
          content: insights.mainFocus.headline,
          context: insights.mainFocus.description,
          sources: insights.mainFocus.sources
        },
        blockers: {
          title: "Key Blockers",
          content: insights.keyBlockers.headline,
          context: insights.keyBlockers.description,
          sources: insights.keyBlockers.sources
        },
        plan: {
          title: "Your Plan",
          content: insights.plan.headline,
          context: insights.plan.description,
          sources: insights.plan.sources
        }
      };
    }

    // Priority 2: Use coaching data if available (from route params) - temporary display
    if (parsedCoachingData && parsedCoachingData.components && parsedCoachingData.components.length > 0) {
      console.log('🎯 Using temporary coaching data for compass (insights processing):', parsedCoachingData);
      const data: any = {};
      
      parsedCoachingData.components.forEach((component: any) => {
        const { type, props } = component;
        
        switch (type) {
          case 'focus':
            data.focus = {
              title: "Your Main Focus",
              content: props.focus || "Main focus not specified",
              context: props.context || null,
              sources: [] // No sources yet - will be available after insight extraction
            };
            break;
            
          case 'blockers':
            const blockerItems = props.items ? props.items.split('|').filter(Boolean) : [];
            data.blockers = {
              title: props.title || "Key Blockers",
              content: blockerItems.length > 0 ? `${blockerItems.length} obstacles identified` : "No blockers specified",
              context: blockerItems.length > 0 ? blockerItems.map((item: string) => `• ${item}`).join('\n') : null,
              sources: []
            };
            break;
            
          case 'actions':
            const actionItems = props.items ? props.items.split('|').filter(Boolean) : [];
            data.plan = {
              title: props.title || "Your Plan",
              content: actionItems.length > 0 ? `${actionItems.length} action steps ready` : "No actions specified",
              context: actionItems.length > 0 ? actionItems.map((item: string, index: number) => `${index + 1}. ${item}`).join('\n') : null,
              sources: []
            };
            break;
        }
      });
      
      return data;
    }
    
    // Priority 3: Fallback placeholder data
    console.log('🎯 Using placeholder data - no insights or coaching data available');
    return {
      focus: {
        title: "Your Main Focus",
        content: "Complete a coaching session to see your insights.",
        context: "Your personal insights will appear here after coaching.",
        sources: []
      },
      blockers: {
        title: "Key Blockers",
        content: "Insights will show what's blocking your progress.",
        context: "Sources from your conversations will appear here.",
        sources: []
      },
      plan: {
        title: "Your Plan", 
        content: "Your personalized action plan will appear here.",
        context: "Based on your coaching conversations and insights.",
        sources: []
      }
    };
  };

  // Helper function to format last updated time
  const formatLastUpdated = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Updated from current session';
    if (diffInHours < 24) return `Updated from session ${diffInHours} hours ago`;
    if (diffInHours < 48) return 'Updated from session yesterday';
    return `Updated from session ${Math.floor(diffInHours / 24)} days ago`;
  };

  const compassData = processCompassData();
  
  // Debug: Log processed compass data
  useEffect(() => {
    console.log('🎯 Compass data processed:', {
      focus: { 
        title: compassData.focus?.title, 
        sourcesCount: compassData.focus?.sources?.length || 0,
        sources: compassData.focus?.sources 
      },
      blockers: { 
        title: compassData.blockers?.title, 
        sourcesCount: compassData.blockers?.sources?.length || 0,
        sources: compassData.blockers?.sources 
      },
      plan: { 
        title: compassData.plan?.title, 
        sourcesCount: compassData.plan?.sources?.length || 0,
        sources: compassData.plan?.sources 
      }
    });
  }, [compassData]);
  
  // Simple story content - first 3 pages stay the same, 4-6 will use special layout
  const storyContent = [...baseStoryContent, "", "", ""]; // Placeholders for pages 4-6
  
  const [currentStory, setCurrentStory] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);

  // Auto-advance story
  useEffect(() => {
    if (isPaused || showSourcesModal) return;

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
  }, [currentStory, isPaused, showSourcesModal]);

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

  // Sources Modal Functions
  const openSourcesModal = (title: string, sources: InsightSource[]) => {
    console.log('🔍 Opening sources modal:', { title, sourcesCount: sources?.length, sources });
    setSelectedSources({ title, sources: sources || [] });
    setShowSourcesModal(true);
    
    // Animate modal appearance
    Animated.timing(sourcesModalOpacity, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const closeSourcesModal = () => {
    Animated.timing(sourcesModalOpacity, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setShowSourcesModal(false);
      setSelectedSources(null);
    });
  };

  // Render the enhanced coaching insight pages (4-6)
  const renderCoachingInsightPage = () => {
    const pageIndex = currentStory - 3; // 0, 1, 2 for pages 4, 5, 6
    const pageTypes = ['focus', 'blockers', 'plan'] as const;
    const pageColors = ['#2563EB', '#EA580C', '#16A34A'];
    
    const currentType = pageTypes[pageIndex];
    const currentColor = pageColors[pageIndex];
    
    // Use processed coaching data
    const currentData = compassData[currentType];
    if (!currentData) return null;

    const { title, content, context } = currentData;
    
    console.log('🎯 Rendering insight page:', { 
      currentType, 
      title, 
      sourcesCount: currentData.sources?.length || 0,
      sources: currentData.sources 
    });

    return (
      <View style={styles.insightPageContainer}>
        {/* Compass Image */}
        <View style={styles.compassImageContainer}>
          <Image 
            source={compassImages[currentType]}
            style={[styles.compassImage, {
              tintColor: colors.tint
            }]}
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
          {insightsError ? (
            <Text style={[styles.errorText, { color: '#EF4444' }]}>
              Failed to load insights
            </Text>
          ) : insightsLoading ? (
            <View style={styles.loadingContainer}>
              <AnimatedSpinner size={12} colors={colors} />
              <Text style={[styles.loadingText, { color: `${colors.text}60` }]}>
                Extracting insights...
              </Text>
            </View>
          ) : insights ? (
            <Text style={[styles.updatedText, { color: `${colors.text}60` }]}>
              {formatLastUpdated(
                currentData.sources && currentData.sources.length > 0 
                  ? Math.max(...(currentData.sources as InsightSource[]).map(s => s.extractedAt)) 
                  : insights.updatedAt
              )}
            </Text>
          ) : sessionId ? (
            <View style={styles.processingContainer}>
              <AnimatedSpinner size={16} colors={colors} style={{ marginBottom: 4 }} />
              <Text style={[styles.processingText, { color: `${colors.text}60` }]}>
                AI is analyzing your session...
              </Text>
              <Text style={[styles.processingSubtext, { color: `${colors.text}40` }]}>
                This usually takes 30-60 seconds
              </Text>
            </View>
          ) : (
            <Text style={[styles.updatedText, { color: `${colors.text}60` }]}>
              Complete a coaching session to generate insights
            </Text>
          )}
          
          <TouchableOpacity 
            style={[
              styles.viewSourcesButton, 
              { 
                backgroundColor: (insightsLoading || sessionId && !insights) ? `${colors.text}05` : `${colors.text}10` 
              }
            ]}
            onPress={() => {
              console.log('🔍 View Sources button pressed:', { 
                title, 
                sourcesData: currentData.sources,
                sourcesLength: currentData.sources?.length,
                hasInsights: !!insights,
                sessionId,
                isLoading: insightsLoading
              });
              
              openSourcesModal(title, currentData.sources || []);
            }}
            disabled={insightsLoading}
          >
            {(insightsLoading || (sessionId && !insights)) ? (
              <View style={styles.buttonLoadingContainer}>
                <AnimatedSpinner size={10} colors={colors} />
                <Text style={[styles.viewSourcesText, { color: `${colors.text}40` }]}>
                  Processing...
                </Text>
              </View>
            ) : (
              <Text style={[styles.viewSourcesText, { color: `${colors.text}80` }]}>
                View Sources {currentData.sources ? currentData.sources.length : 0}
              </Text>
            )}
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
          onPress={() => {
            navigation.goBack();
          }}
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

      {/* Sources Modal */}
      {showSourcesModal && selectedSources && (
        <SourcesModal
          isVisible={showSourcesModal}
          onClose={closeSourcesModal}
          title={selectedSources.title}
          sources={selectedSources.sources}
          overlayOpacity={sourcesModalOpacity}
          isProcessing={insightsLoading || (sessionId !== undefined && !insights)}
        />
      )}
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
  errorText: {
    fontSize: 14,
    fontWeight: '500',
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
  // Loading states
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '400',
  },
  processingContainer: {
    alignItems: 'center',
    gap: 4,
  },
  processingText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  processingSubtext: {
    fontSize: 12,
    fontWeight: '400',
    textAlign: 'center',
  },
  buttonLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
}); 