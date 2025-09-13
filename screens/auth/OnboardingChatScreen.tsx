import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { StyleSheet, Text, TextInput, View, useColorScheme, TouchableOpacity, ScrollView, SafeAreaView, KeyboardAvoidingView, Platform, Keyboard, ColorSchemeName, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Mic, X, Check, ArrowUp, ArrowDown } from 'lucide-react-native';
import * as Crypto from 'expo-crypto';
import { Colors } from '@/constants/Colors';
import { AuthStackParamList } from '@/navigation/AuthNavigator';
import * as Progress from 'react-native-progress';
import { Button } from '@/components/ui/Button';
import { useAICoaching, CoachingMessage } from '@/hooks/useAICoaching';
import { useNotificationPermissions } from '@/hooks/useNotificationPermissions';
import { useAuth } from '@/hooks/useAuth';
import { useAudioTranscription } from '@/hooks/useAudioTranscription';
import { useOnboardingProgress } from '@/hooks/useOnboardingProgress';
import { useAnalytics } from '@/hooks/useAnalytics';
import { FirestoreService } from '@/lib/firestore';
import { UserAccount } from '@/types/journal';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

type OnboardingChatScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'OnboardingChat'>;
type OnboardingChatScreenRouteProp = RouteProp<AuthStackParamList, 'OnboardingChat'>;

// Spinning animation component
const SpinningAnimation = ({ colorScheme }: { colorScheme: ColorSchemeName }) => {
  const spinValue = useRef(new Animated.Value(0)).current;
  
  // Animation effect
  useEffect(() => {
    const spinAnimation = Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true
      })
    );
    
    spinAnimation.start();
    
    return () => {
      spinAnimation.stop();
    };
  }, [spinValue]);
  
  // Interpolate the spin value to create a full 360 degree rotation
  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });
  
  return (
    <View style={styles.loadingSpinner}>
      <Animated.View 
        style={[
          styles.spinner,
          { 
            backgroundColor: colorScheme === 'dark' ? '#666666' : '#333333',
            transform: [{ rotate: spin }]
          }
        ]}
      />
    </View>
  );
};

// Audio level indicator component
const AudioLevelIndicator = ({ audioLevel, colorScheme }: { audioLevel: number, colorScheme: ColorSchemeName }) => {
  const totalDots = 6;
  
  const isDotActive = (index: number) => {
    const threshold = (index + 1) / totalDots;
    return audioLevel >= threshold;
  };
  
  return (
    <View style={styles.audioLevelContainer}>
      {Array.from({ length: totalDots }).map((_, index) => {
        const isActive = isDotActive(index);
        
        return (
          <View 
            key={index}
            style={[
              styles.audioLevelDot, 
              { 
                backgroundColor: isActive
                  ? (colorScheme === 'dark' ? '#888888' : '#111111')
                  : (colorScheme === 'dark' ? '#444444' : '#E5E5E5')
              }
            ]}
          />
        );
      })}
    </View>
  );
};

// Animated typing indicator component
const AnimatedTypingIndicator = ({ colorScheme }: { colorScheme: ColorSchemeName }) => {
  const dot1Animation = useRef(new Animated.Value(0)).current;
  const dot2Animation = useRef(new Animated.Value(0)).current;
  const dot3Animation = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    // Create individual animations for each dot
    const animation1 = Animated.loop(
      Animated.sequence([
        Animated.timing(dot1Animation, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true
        }),
        Animated.timing(dot1Animation, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true
        })
      ])
    );

    const animation2 = Animated.loop(
      Animated.sequence([
        Animated.timing(dot2Animation, {
          toValue: 1,
          duration: 600,
          delay: 200,
          useNativeDriver: true
        }),
        Animated.timing(dot2Animation, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true
        })
      ])
    );

    const animation3 = Animated.loop(
      Animated.sequence([
        Animated.timing(dot3Animation, {
          toValue: 1,
          duration: 600,
          delay: 400,
          useNativeDriver: true
        }),
        Animated.timing(dot3Animation, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true
        })
      ])
    );

    animation1.start();
    animation2.start();
    animation3.start();

    return () => {
      animation1.stop();
      animation2.stop();
      animation3.stop();
    };
  }, [dot1Animation, dot2Animation, dot3Animation]);

  const dot1Opacity = dot1Animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 1]
  });

  const dot2Opacity = dot2Animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 1]
  });

  const dot3Opacity = dot3Animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 1]
  });

  return (
    <View style={styles.typingIndicator}>
      <Animated.View 
        style={[
          styles.typingDot, 
          { 
            backgroundColor: colorScheme === 'dark' ? '#888888' : '#333333',
            opacity: dot1Opacity
          }
        ]} 
      />
      <Animated.View 
        style={[
          styles.typingDot, 
          { 
            backgroundColor: colorScheme === 'dark' ? '#888888' : '#333333',
            opacity: dot2Opacity
          }
        ]} 
      />
      <Animated.View 
        style={[
          styles.typingDot, 
          { 
            backgroundColor: colorScheme === 'dark' ? '#888888' : '#333333',
            opacity: dot3Opacity
          }
        ]} 
      />
    </View>
  );
};

// Recording timer component
const RecordingTimer = ({ startTime, colorScheme }: { startTime: Date | null, colorScheme: ColorSchemeName }) => {
  const [elapsed, setElapsed] = useState('00:00');
  
  useEffect(() => {
    if (!startTime) return;
    
    const interval = setInterval(() => {
      const now = new Date();
      const diffMs = now.getTime() - startTime.getTime();
      const diffSec = Math.floor(diffMs / 1000);
      const minutes = Math.floor(diffSec / 60).toString().padStart(2, '0');
      const seconds = (diffSec % 60).toString().padStart(2, '0');
      setElapsed(`${minutes}:${seconds}`);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [startTime]);
  
  return (
    <Text style={[styles.recordingTimer, { color: colorScheme === 'dark' ? '#FFFFFF' : '#333333' }]}>
      {elapsed}
    </Text>
  );
};

export default function OnboardingChatScreen() {
  const navigation = useNavigation<OnboardingChatScreenNavigationProp>();
  const route = useRoute<OnboardingChatScreenRouteProp>();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  


  // Extract all the onboarding data from navigation params
  const {
    name,
    selectedRoles,
    selectedSelfReflection,
    clarityLevel,
    stressLevel,
    coachingStylePosition,
    timeDuration
  } = route.params;

  // Use the new AI coaching hook with progress tracking
  const { messages, isLoading, sendMessage, setMessages, progress } = useAICoaching();
  const { requestPermissions, expoPushToken, savePushTokenToFirestore, permissionStatus } = useNotificationPermissions();
  const { completeOnboarding, firebaseUser, getToken } = useAuth();
  const { clearProgress, saveProgress } = useOnboardingProgress();
  const { 
    trackCoachingSessionStarted, 
    trackCoachingSessionCompleted, 
    trackOnboardingStep,
    trackNotificationPermissionRequested,
    trackNotificationPermissionGranted,
    trackNotificationPermissionDenied,
    trackCoachingMessagesOptIn
  } = useAnalytics();

  // Save progress as step 17 (OnboardingChat) when entering this screen
  useEffect(() => {
    console.log('💾 OnboardingChatScreen - Component mounted, saving progress as step 17');
    console.log('📋 OnboardingChatScreen - Route params:', {
      name,
      selectedRoles,
      selectedSelfReflection,
      clarityLevel,
      stressLevel,
      coachingStylePosition,
      timeDuration
    });
    
    // CRITICAL: Ensure onboarding is NOT marked as completed in Firestore
    // This fixes cases where user was previously marked as completed but is still in deep dive
    const ensureOnboardingNotCompleted = async () => {
      if (firebaseUser?.uid) {
        try {
          console.log('🔄 Ensuring onboarding is not marked as completed in Firestore...');
          await FirestoreService.updateUserAccount(firebaseUser.uid, {
            onboardingData: {
              onboardingCompleted: false,
              onboardingCompletedAt: 0,
              whatDoYouDoInLife: selectedRoles,
              selfReflectionPracticesTried: selectedSelfReflection,
              clarityInLife: clarityLevel,
              stressInLife: stressLevel,
            },
            updatedAt: new Date(),
          });
          console.log('✅ Onboarding completion status reset in Firestore');
        } catch (error) {
          console.error('❌ Failed to reset onboarding completion status:', error);
        }
      }
    };
    
    // Immediately save progress to ensure consistency
    const progressData = {
      currentStep: 17, // Special step for OnboardingChat
      name,
      selectedRoles,
      selectedSelfReflection,
      clarityLevel,
      stressLevel,
      hasInteractedWithClaritySlider: true,
      hasInteractedWithStressSlider: true,
      coachingStylePosition,
      hasInteractedWithCoachingStyle: true,
      timeDuration,
    };
    
    console.log('💾 Saving progress data:', progressData);
    
    // Run both operations
    Promise.all([
      saveProgress(progressData),
      ensureOnboardingNotCompleted()
    ]).then(() => {
      console.log('✅ OnboardingChatScreen - Progress saved and completion status reset');
    }).catch(error => {
      console.error('❌ Failed to save OnboardingChat progress or reset completion:', error);
    });
  }, []); // Only run once when component mounts
  
  // Save progress when component unmounts (user navigates away) - NO DEPENDENCIES TO AVOID INFINITE LOOP
  useEffect(() => {
    return () => {
      // Don't save progress if onboarding is already completed to prevent endless loop
      if (isOnboardingCompletedRef.current) {
        console.log('🚪 OnboardingChatScreen - Component unmounting but onboarding completed, skipping progress save');
        return;
      }
      
      console.log('🚪 OnboardingChatScreen - Component truly unmounting, saving final progress');
      // Use ref to get latest values or save what we have
      saveProgress({
        currentStep: 17,
        name,
        selectedRoles,
        selectedSelfReflection,
        clarityLevel,
        stressLevel,
        hasInteractedWithClaritySlider: true,
        hasInteractedWithStressSlider: true,
        coachingStylePosition,
        hasInteractedWithCoachingStyle: true,
        timeDuration,
      }).catch(error => {
        console.error('❌ Failed to save progress on unmount:', error);
      });
    };
  }, []); // EMPTY DEPENDENCIES - only run on actual unmount

  // Use user ID as session ID for onboarding (consistent with main coaching)
  const getSessionId = (): string => {
    return firebaseUser?.uid || 'anonymous-onboarding';
  };
  
  const [chatInput, setChatInput] = useState('');
  const [isChatInputFocused, setIsChatInputFocused] = useState(false);
  const [showPopupForMessage, setShowPopupForMessage] = useState<string | null>(null);
  const [showCompletionForMessage, setShowCompletionForMessage] = useState<string | null>(null);
  const [showSchedulingForMessage, setShowSchedulingForMessage] = useState<string | null>(null);
  const [selectedFrequency, setSelectedFrequency] = useState<string>('daily');
  const [confirmedSchedulingForMessage, setConfirmedSchedulingForMessage] = useState<string | null>(null);
  const [confirmedSchedulingMessages, setConfirmedSchedulingMessages] = useState<Set<string>>(new Set());
  const [sessionStartTime] = useState(new Date());
  const [isCompletingOnboarding, setIsCompletingOnboarding] = useState(false);
  const [isOnboardingCompleted, setIsOnboardingCompleted] = useState(false);
  const isOnboardingCompletedRef = useRef(false);

  // Use the audio transcription hook
  const {
    isRecording,
    isTranscribing,
    recordingStartTime,
    audioLevel,
    startRecording,
    stopRecordingAndTranscribe,
    cancelRecording,
  } = useAudioTranscription({
    onTranscriptionComplete: (transcription) => {
      const existingText = chatInput.trim();
      const newText = existingText 
        ? `${existingText} ${transcription}` 
        : transcription;
      setChatInput(newText);
      setTimeout(() => {
        textInputRef.current?.focus();
      }, 100);
    },
    onTranscriptionError: (error) => {
      console.error('Transcription error:', error);
    },
  });
  const [completionStats, setCompletionStats] = useState({
    minutes: 0,
    words: 0,
    keyInsights: 0
  });
  const [parsedCoachingData, setParsedCoachingData] = useState<{
    components: Array<{ type: string; props: Record<string, string> }>;
    rawData: string;
  } | null>(null);

  // Function to parse coaching cards from any content
  const parseCoachingCards = (content: string) => {
    const components: Array<{ type: string; props: Record<string, string> }> = [];
    
    // First check for simple card format without parameters (e.g., [checkin])
    const simpleComponentRegex = /\[(\w+)\]/g;
    let simpleMatch;
    while ((simpleMatch = simpleComponentRegex.exec(content)) !== null) {
      const componentType = simpleMatch[1];
      
      // Add empty props for simple cards
      const props: Record<string, string> = {};
      components.push({ type: componentType, props });
    }
    
    // Also parse component markers with parameters like [checkin:frequency="once a day",what="morning routine progress",notes="..."]
    const componentRegex = /\[(\w+):([^\]]+)\]/g;
    let match;
    while ((match = componentRegex.exec(content)) !== null) {
      const componentType = match[1];
      const propsString = match[2];
      
      // Parse props from key="value" format
      const props: Record<string, string> = {};
      const propRegex = /(\w+)="([^"]+)"/g;
      let propMatch;
      
      while ((propMatch = propRegex.exec(propsString)) !== null) {
        const [, key, value] = propMatch;
        props[key] = value;
      }
      
      // Replace simple version if we have a parameterized version
      const existingIndex = components.findIndex(comp => comp.type === componentType);
      if (existingIndex !== -1) {
        components[existingIndex] = { type: componentType, props };
      } else {
        components.push({ type: componentType, props });
      }
    }
    
    return components;
  };

  // Function to parse coaching completion data from sessionEnd tokens
  const parseCoachingCompletion = (content: string) => {
    // ✅ NEW: Check for sessionEnd tokens (web standard)
    const sessionEndMatch = content.match(/\[sessionEnd(?::([^\]]+))?\]/);
    
    if (sessionEndMatch) {
      console.log('🎯 Found sessionEnd token:', sessionEndMatch[0]);
      
      // Parse sessionEnd attributes if present
      const attributesStr = sessionEndMatch[1] || '';
      const sessionEndProps: Record<string, string> = {};
      
      if (attributesStr) {
        const propRegex = /(\w+)="([^"]+)"/g;
        let propMatch;
        while ((propMatch = propRegex.exec(attributesStr)) !== null) {
          const [, key, value] = propMatch;
          sessionEndProps[key] = value;
        }
      }
      
      // Create sessionEnd component
      const sessionEndComponent = {
        type: 'sessionEnd',
        props: {
          title: sessionEndProps.title || 'Ready to Complete Your Session',
          message: sessionEndProps.message || 'I have gathered enough context to create your personalized life compass.'
        }
      };
      
      // Also parse any other coaching cards in the message
      const otherComponents = parseCoachingCards(content);
      const allComponents = [...otherComponents, sessionEndComponent];
      
      console.log('🎯 Parsed coaching completion (sessionEnd):', { 
        componentsCount: allComponents.length, 
        components: allComponents,
        sessionEndProps
      });
      
      return { components: allComponents, rawData: content };
    }
    
    // ❌ LEGACY: Still support old finish tokens for backward compatibility
    const finishStartIndex = content.indexOf('[finish-start]');
    const finishEndIndex = content.indexOf('[finish-end]');
    
    if (finishStartIndex !== -1 && finishEndIndex !== -1) {
      const finishContent = content.slice(finishStartIndex + '[finish-start]'.length, finishEndIndex).trim();
      const components = parseCoachingCards(finishContent);
      
      console.log('🎯 Parsed coaching completion (legacy finish tokens):', { 
        componentsCount: components.length, 
        components,
        rawFinishContent: finishContent
      });
      
      return { components, rawData: finishContent };
    }
    
    return { components: [], rawData: '' };
  };

  // Function to call coaching chat API for coaching blocks
  const callCoachingInteractionAPI = async (entryContent: string) => {
    try {
      // Validate input
      if (!entryContent || entryContent.trim().length === 0) {
        throw new Error('Entry content is required and cannot be empty');
      }

      const token = await getToken();
      if (!token) {
        throw new Error('Authentication token not available');
      }

      // Use user ID as session ID for onboarding
      const currentSessionId = getSessionId();
      console.log(`🆔 Using user ID as session ID for onboarding: ${currentSessionId}`);

      const requestBody = {
        message: entryContent.trim(),
        sessionId: currentSessionId,
        sessionType: 'initial-life-deep-dive',
        sessionDuration: timeDuration,
        conversationHistory: messages.slice(0, 5) // Limit history to avoid large requests
      };

      console.log('📤 API Request:', {
        endpoint: `${process.env.EXPO_PUBLIC_API_URL}api/coaching/chat`,
        messageLength: requestBody.message.length,
        sessionId: requestBody.sessionId,
        historyCount: requestBody.conversationHistory.length
      });

      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}api/coaching/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error('❌ Coaching Chat API Error:', errorText);
        throw new Error(`API Error: ${response.status} - ${errorText}`);
      }

      // Note: The coaching/chat endpoint returns streaming SSE, but we're just checking if the call succeeds
      // for now since we're using it to trigger backend processing
      console.log('✅ API call successful');
      return { success: true };
    } catch (error) {
      console.error('❌ Error calling coaching chat API:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  };

  // Function to map UI frequency to UserAccount type and update coaching config
  const updateCoachingConfiguration = async (selectedFrequency: string) => {
    if (!firebaseUser?.uid) {
      console.error('❌ No user ID available for updating coaching config');
      return { success: false, error: 'User not authenticated' };
    }

    try {
      // Map UI frequency to UserAccount type
      const frequencyMap: Record<string, 'daily' | 'multipleTimesPerWeek' | 'onceAWeek'> = {
        'once a week': 'onceAWeek',
        'couple times a week': 'multipleTimesPerWeek',
        'daily': 'daily'
      };

      const mappedFrequency = frequencyMap[selectedFrequency];
      if (!mappedFrequency) {
        console.error('❌ Invalid frequency:', selectedFrequency);
        return { success: false, error: 'Invalid frequency' };
      }

      console.log('📊 Updating coaching configuration:', {
        userId: firebaseUser.uid,
        frequency: selectedFrequency,
        mappedFrequency,
        enableCoachingMessages: true
      });

      // Get current user account to preserve existing coaching settings
      const currentAccount = await FirestoreService.getUserAccount(firebaseUser.uid);
      
      // Update user's coaching configuration in Firestore, preserving existing settings
      const updates: Partial<UserAccount> = {
        coachingConfig: {
          challengeDegree: currentAccount.coachingConfig?.challengeDegree || 'moderate',
          harshToneDegree: currentAccount.coachingConfig?.harshToneDegree || 'supportive',
          coachingMessageFrequency: mappedFrequency,
          enableCoachingMessages: true,
          lastCoachingMessageSentAt: 0,
          coachingMessageTimePreference: 'morning',
        }
      };

      await FirestoreService.updateUserAccount(firebaseUser.uid, updates);
      
      console.log('✅ Successfully updated coaching configuration');
      return { success: true };
    } catch (error) {
      console.error('❌ Error updating coaching configuration:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  };

  // Function to clean message content by removing sessionEnd tokens and coaching cards
  const getDisplayContent = (content: string) => {
    let cleanContent = content;
    
    // ✅ NEW: Remove sessionEnd tokens
    cleanContent = cleanContent.replace(/\[sessionEnd(?::[^\]]+)?\]/g, '').trim();
    
    // ❌ LEGACY: Remove content between finish tokens for backward compatibility
    const finishStartIndex = cleanContent.indexOf('[finish-start]');
    const finishEndIndex = cleanContent.indexOf('[finish-end]');
    
    if (finishStartIndex !== -1 && finishEndIndex !== -1) {
      // Keep content before [finish-start] and after [finish-end]
      const beforeFinish = cleanContent.slice(0, finishStartIndex).trim();
      const afterFinish = cleanContent.slice(finishEndIndex + '[finish-end]'.length).trim();
      cleanContent = beforeFinish + (afterFinish ? '\n\n' + afterFinish : '');
    } else if (finishStartIndex !== -1) {
      // If only [finish-start] is found, remove everything after it
      cleanContent = cleanContent.slice(0, finishStartIndex).trim();
    }
    
    // Remove coaching card syntax like [checkin:...], [focus:...], etc.
    const coachingCardRegex = /\[(\w+):[^\]]+\]/g;
    cleanContent = cleanContent.replace(coachingCardRegex, '').trim();
    
    // Remove simple coaching cards like [checkin], [lifeCompassUpdated]
    const simpleCardRegex = /\[(\w+)\]/g;
    cleanContent = cleanContent.replace(simpleCardRegex, '').trim();
    
    // Clean up extra whitespace/newlines that might be left
    cleanContent = cleanContent.replace(/\n\s*\n\s*\n/g, '\n\n'); // Replace multiple newlines with double newlines
    cleanContent = cleanContent.trim();
    
    return cleanContent;
  };

  const scrollViewRef = useRef<ScrollView>(null);
  const textInputRef = useRef<TextInput>(null);

  //POWERFUL MESSAGE POSITIONING SYSTEM

  // 1. Define constant values
  const HEADER_HEIGHT = 120;
  const INPUT_HEIGHT = 160;
  const MESSAGE_TARGET_OFFSET = 20; // How many pixels below the header

  // Dynamic content height calculation
  const dynamicContentHeight = useMemo(() => {
    let totalHeight = 12; // paddingTop
    
    messages.forEach((message, index) => {
      const contentLength = message.content.length;
      const lines = Math.max(1, Math.ceil(contentLength / 40));
      let messageHeight = lines * 22 + 32;
      
      if (message.role === 'assistant') {
        const isLastMessage = index === messages.length - 1;
        const isCurrentlyStreaming = isLastMessage && isLoading;
        
        if (isCurrentlyStreaming) {
          messageHeight += 200;
        } else {
          messageHeight += 80;
        }
      }
      
      totalHeight += messageHeight + 16;
    });
    
    // Add loading indicator height
    if (isLoading) {
      totalHeight += 60;
    }
    
    return totalHeight;
  }, [messages, isLoading]);

  // 2. Simplify dynamicBottomPadding - only two states:
  const dynamicBottomPadding = useMemo(() => {
    const screenHeight = 700; 
    const availableHeight = screenHeight - HEADER_HEIGHT - INPUT_HEIGHT; // ~420px
    
    // If user sent a message and waiting for AI response -> Positioning padding
    const lastMessage = messages[messages.length - 1];
    const isUserWaitingForAI = lastMessage?.role === 'user' || isLoading;
    
    if (isUserWaitingForAI) {
      return availableHeight + 100; // Sufficient space for precise positioning
    } else {
      return 50; // Minimal padding - just bottom space
    }
  }, [messages, isLoading]);

  // New state for content height tracking
  const [contentHeight, setContentHeight] = useState(0);
  const [scrollViewHeight, setScrollViewHeight] = useState(0);

  // Scroll limits calculation - simplified
  const scrollLimits = useMemo(() => {
    const minContentHeight = dynamicContentHeight + dynamicBottomPadding;
    const maxScrollDistance = Math.max(0, minContentHeight - (scrollViewHeight || 500) + 50);
    
    return {
      minContentHeight,
      maxScrollDistance
    };
  }, [dynamicContentHeight, dynamicBottomPadding, scrollViewHeight]);

  // Enhanced scroll position tracking for scroll-to-bottom button
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  
  // Store refs for each message to measure their positions
  const messageRefs = useRef<{ [key: string]: View | null }>({});
  
  // Store the target scroll position after user message positioning
  const targetScrollPosition = useRef<number | null>(null);
  
  // Track if user has manually scrolled
  const hasUserScrolled = useRef<boolean>(false);

  // 3. Completely rewrite scrollToShowLastMessage:
  const scrollToShowLastMessage = useCallback(() => {
    if (!scrollViewRef.current || messages.length === 0) return;
    
    const lastMessage = messages[messages.length - 1];
    
    // Only position user messages
    if (lastMessage.role !== 'user') return;
    
    console.log('🎯 Positioning user message:', lastMessage.content.substring(0, 30) + '...');
    
    // Target position: MESSAGE_TARGET_OFFSET pixels below header
    const targetFromTop = MESSAGE_TARGET_OFFSET;
    
    // Get user message ref
    const lastMessageRef = messageRefs.current[lastMessage.id];
    
    if (lastMessageRef) {
      // Measure current position of the message
      setTimeout(() => {
        lastMessageRef.measureLayout(
          scrollViewRef.current as any,
          (msgX: number, msgY: number, msgWidth: number, msgHeight: number) => {
            // Target scroll position = message Y position - target position
            const targetScrollY = Math.max(0, msgY - targetFromTop);
            
            console.log('📐 Measurement:', {
              messageY: msgY,
              targetFromTop,
              targetScrollY
            });
            
            // Perform scroll
            scrollViewRef.current?.scrollTo({
              y: targetScrollY,
              animated: true
            });
            
            // Save position
            targetScrollPosition.current = targetScrollY;
            hasUserScrolled.current = false;
            
            console.log('✅ User message positioned at scroll:', targetScrollY);
          },
          () => {
            console.log('❌ Measurement failed, using estimation');
            
            // Fallback: estimate message position
            let estimatedY = 12; // paddingTop
            
            // Sum up height of all previous messages
            for (let i = 0; i < messages.length - 1; i++) {
              const msg = messages[i];
              const lines = Math.max(1, Math.ceil(msg.content.length / 40));
              const msgHeight = lines * 22 + 48; // text + padding
              estimatedY += msgHeight + 16; // marginBottom
            }
            
            // Last message Y position
            const targetScrollY = Math.max(0, estimatedY - targetFromTop);
            
            scrollViewRef.current?.scrollTo({
              y: targetScrollY,
              animated: true
            });
            
            targetScrollPosition.current = targetScrollY;
            hasUserScrolled.current = false;
          }
        );
      }, 150); // Wait for layout to stabilize
    }
  }, [messages]);

  // Auto-scroll to position new messages below header
  const scrollToNewMessageRef = useRef(false);

  // 4. Simplify useEffect:
  useEffect(() => {
    // Only scroll when user sends a message
    if (scrollToNewMessageRef.current && scrollViewRef.current) {
      setTimeout(() => {
        scrollToShowLastMessage();
        scrollToNewMessageRef.current = false;
      }, 100);
    }
  }, [messages.length, scrollToShowLastMessage]);

  // 5. Adjust position once when AI response starts:
  useEffect(() => {
    if (isLoading && targetScrollPosition.current !== null) {
      // Adjust position once when AI response starts
      const maintainedPosition = targetScrollPosition.current;
      
      setTimeout(() => {
        if (scrollViewRef.current && !hasUserScrolled.current) {
          scrollViewRef.current.scrollTo({
            y: maintainedPosition,
            animated: false
          });
        }
      }, 100);
    }
  }, [isLoading]);

  // 6. Clear when progress reaches 100%:
  useEffect(() => {
    if (progress === 100) {
      setTimeout(() => {
        targetScrollPosition.current = null;
        hasUserScrolled.current = false;
        console.log('🧹 Positioning cleared after AI response');
      }, 1000);
    }
  }, [progress]);

  // Initialize chat with first message when component mounts
  useEffect(() => {
    if (messages.length === 0) {
      setTimeout(() => {
        const initialMessage: CoachingMessage = {
          id: '1',
          content: `Hey, ${name}.\n
Once you're ready, I'd love to hear: If you had to name what's most alive in you right now—what would it be?\n
Maybe it's a tension you're holding, a quiet longing, or something you don't quite have words for yet. Whatever shows up—start there.`,
          role: 'assistant',
          timestamp: new Date()
        };
        setMessages([initialMessage]);
      }, 1000);
    }
  }, [name, messages.length, setMessages]);

  // 7. Simplify handleScroll:
  const handleScroll = (event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const scrollY = contentOffset.y;
    
    // User scroll detection
    if (targetScrollPosition.current !== null) {
      const savedPosition = targetScrollPosition.current;
      const scrollDifference = Math.abs(scrollY - savedPosition);
      
      if (scrollDifference > 50) { // Larger threshold
        console.log('👆 User scrolled manually, clearing positioning');
        hasUserScrolled.current = true;
        targetScrollPosition.current = null;
      }
    }
    
    // Scroll to bottom button - only when AI response is complete
    const hasMessages = messages.length > 0;
    const lastMessage = hasMessages ? messages[messages.length - 1] : null;
    const isAIResponseComplete = !isLoading && lastMessage?.role === 'assistant';
    
    if (isAIResponseComplete && targetScrollPosition.current === null) {
      const contentHeight = contentSize.height;
      const screenHeight = layoutMeasurement.height;
      const distanceFromBottom = contentHeight - screenHeight - scrollY;
      setShowScrollToBottom(distanceFromBottom > 200);
    } else {
      setShowScrollToBottom(false);
    }
  };

  const handleScrollToBottom = () => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      const lastMessageRef = messageRefs.current[lastMessage.id];
      
      if (lastMessageRef) {
        lastMessageRef.measureLayout(
          scrollViewRef.current as any,
          (x, y, width, height) => {
            // Check if it's a long AI response
            const isLongResponse = lastMessage.role === 'assistant' && lastMessage.content.length >= 200;
            
            if (isLongResponse) {
              // For long responses: scroll to the very end of the message
              const targetY = Math.max(0, y + height - 100); // Show end of message with some space
              scrollViewRef.current?.scrollTo({
                y: targetY,
                animated: true
              });
            } else {
              // For short responses: scroll to show the message with minimal space below
              const targetY = Math.max(0, y - 20); // Small offset
              scrollViewRef.current?.scrollTo({
                y: targetY,
                animated: true
              });
            }
          },
          () => {
            // Fallback: scroll to a position that shows the last message
            const estimatedPosition = Math.max(0, (messages.length - 1) * 80 - 30);
            scrollViewRef.current?.scrollTo({
              y: estimatedPosition,
              animated: true
            });
          }
        );
      } else {
        // Fallback: scroll to a position that shows the last message
        const estimatedPosition = Math.max(0, (messages.length - 1) * 80 - 30);
        scrollViewRef.current?.scrollTo({
          y: estimatedPosition,
          animated: true
        });
      }
    } else {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }
  };



  // Check for notification suggestions in new AI messages
  useEffect(() => {
    if (messages.length === 0) return;

    const lastMessage = messages[messages.length - 1];
    
    // Only check assistant messages that have content and aren't already showing a popup
    if (lastMessage && 
        lastMessage.role === 'assistant' && 
        lastMessage.content.length > 0 &&
        !showPopupForMessage &&
        lastMessage.content.toLowerCase().includes('notification')) {
      
      // Small delay to ensure message is fully rendered
      setTimeout(() => {
        setShowPopupForMessage(lastMessage.id);
      }, 300);
    }
  }, [messages, showPopupForMessage]);

  // Check for scheduling/checkin cards in new AI messages
  useEffect(() => {
    if (messages.length === 0) return;

    const lastMessage = messages[messages.length - 1];
    
    // Only check assistant messages that have content and aren't already showing a popup
    if (lastMessage && 
        lastMessage.role === 'assistant' && 
        lastMessage.content.length > 0 &&
        !showSchedulingForMessage &&
        !showPopupForMessage &&
        !showCompletionForMessage &&
        !confirmedSchedulingForMessage) {
      
      // Parse coaching cards from the message
      const coachingCards = parseCoachingCards(lastMessage.content);
      const hasCheckinCard = coachingCards.some(card => card.type === 'checkin');
      
      if (hasCheckinCard && !confirmedSchedulingMessages.has(lastMessage.id)) {
        console.log('📅 Found checkin card in message:', lastMessage.id, coachingCards);
        
        // Small delay to ensure message is fully rendered
        setTimeout(() => {
          setShowSchedulingForMessage(lastMessage.id);
          setSelectedFrequency('daily');
        }, 300);
      }
    }
  }, [messages, showSchedulingForMessage, showPopupForMessage, showCompletionForMessage, confirmedSchedulingMessages]);

  // Track when progress reaches 100% to keep Enter App button visible
  const [hasReached100, setHasReached100] = useState(false);
  
  useEffect(() => {
    console.log('🎯 OnboardingChat Progress Update:', progress);
    if (progress >= 100) {
      setHasReached100(true);
      console.log('✅ Progress reached 100%, Enter App button will stay visible');
    }
  }, [progress]);

  // Check for completion when progress reaches 100%
  useEffect(() => {
    if (progress >= 100 && !showCompletionForMessage) {
      console.log('🎯 Progress reached 100%! Showing completion popup...');
      
      // ✅ NEW: Find the final AI message that contains sessionEnd token
      const lastAIMessage = [...messages].reverse().find(msg => 
        msg.role === 'assistant' && 
        msg.content.includes('[sessionEnd')
      );
      
      // ❌ LEGACY: Fallback to old finish tokens for backward compatibility
      if (!lastAIMessage) {
        const legacyMessage = [...messages].reverse().find(msg => 
          msg.role === 'assistant' && 
          (msg.content.includes('[finish-start]') || msg.content.includes('[finish-end]'))
        );
        
        if (legacyMessage) {
          console.log('🎯 Found legacy finish tokens, using for completion');
        }
      }
      
      const finalMessage = lastAIMessage || [...messages].reverse().find(msg => 
        msg.role === 'assistant' && 
        (msg.content.includes('[finish-start]') || msg.content.includes('[finish-end]'))
      );
      
      if (finalMessage) {
        // Calculate session statistics
        const sessionEndTime = new Date();
        const sessionDurationMs = sessionEndTime.getTime() - sessionStartTime.getTime();
        const sessionMinutes = Math.round(sessionDurationMs / 60000); // Convert to minutes
        
        // Count words from user messages
        const userMessages = messages.filter(msg => msg.role === 'user');
        const totalWords = userMessages.reduce((count, msg) => {
          return count + msg.content.trim().split(/\s+/).filter(word => word.length > 0).length;
        }, 0);
        
        // Parse coaching completion data to get accurate insights count
        const parsedData = parseCoachingCompletion(finalMessage.content);
        const keyInsights = Math.max(parsedData.components.length, 3); // Use actual parsed components count
        
        setCompletionStats({
          minutes: Math.max(sessionMinutes, 1), // At least 1 minute
          words: totalWords,
          keyInsights
        });
        
        // Store parsed coaching data for future use
        setParsedCoachingData(parsedData);
        
        // Log initial life deep dive session completion
        const currentSessionId = getSessionId();
        console.log('✅ [COACHING] Completing initial life deep dive session...', {
          sessionId: currentSessionId,
          duration: sessionMinutes,
          messageCount: messages.length,
          wordsWritten: totalWords,
          insights: keyInsights
        });
        
        // Track initial life deep dive session completion
        if (currentSessionId && currentSessionId !== 'anonymous-onboarding') {
          trackCoachingSessionCompleted({
            session_id: currentSessionId,
            duration_minutes: Math.max(sessionMinutes, 1),
            message_count: messages.length,
            words_written: totalWords,
            insights_generated: keyInsights,
            session_type: 'initial_life_deep_dive',
          });
        }
        
        // Show completion popup for this specific message
        setShowCompletionForMessage(finalMessage.id);
      }
    }
  }, [progress, showCompletionForMessage, messages, sessionStartTime]);

  // Keep screen awake while recording
  useEffect(() => {
    if (isRecording) {
      activateKeepAwakeAsync()
        .catch(error => console.error('❌ Failed to activate keep awake:', error));
    } else {
      deactivateKeepAwake();
    }
  }, [isRecording]);

  // Cleanup keep awake on component unmount
  useEffect(() => {
    return () => {
      deactivateKeepAwake();
    };
  }, []);





  // 8. Set flag correctly in handleSendMessage:
  const handleSendMessage = async () => {
    if (chatInput.trim().length === 0) return;

    // Use user ID as session ID for onboarding
    const currentSessionId = getSessionId();
    console.log(`🆔 Using user ID as session ID for onboarding: ${currentSessionId}`);
    
    // Log initial life deep dive session activity
    console.log('🎯 [COACHING] Initial life deep dive session activity...', {
      sessionId: currentSessionId,
      sessionType: 'initial_life_deep_dive',
      trigger: 'manual'
    });
    
    // Track initial life deep dive session started on first user message
    trackCoachingSessionStarted({
      session_id: currentSessionId,
      session_type: 'initial_life_deep_dive',
      trigger: 'manual',
    });
    
    // Also track this as an onboarding step completion
    trackOnboardingStep({
      step_name: 'initial_life_deep_dive_started',
      step_number: 17,
      time_spent: Math.floor((Date.now() - sessionStartTime.getTime()) / 1000),
    });

    const messageContent = chatInput.trim();
    setChatInput('');
    
    // Set positioning flag
    hasUserScrolled.current = false;
    scrollToNewMessageRef.current = true; // This flag will trigger positioning

    console.log('📤 Sending message, positioning will be triggered');

    // Send message using the AI coaching hook with session ID, type, and duration
    await sendMessage(messageContent, currentSessionId, {
      sessionType: 'initial-life-deep-dive',
      sessionDuration: timeDuration
    });
  };

  const handleMicrophonePress = () => {
    // Start recording without losing keyboard focus
    const wasInputFocused = isChatInputFocused;
    startRecording();
    
    // Keep input focused if it was focused before
    if (wasInputFocused && textInputRef.current) {
      setTimeout(() => {
        textInputRef.current?.focus();
      }, 100);
    }
  };

  const handleRecordingCancel = () => {
    // Remember if input was focused before recording started
    const wasInputFocused = isChatInputFocused;
    cancelRecording();
    
    // Restore focus after canceling recording
    if (wasInputFocused && textInputRef.current) {
      setTimeout(() => {
        textInputRef.current?.focus();
      }, 100);
    }
  };

  const handleRecordingConfirm = () => {
    // Remember if input was focused before recording started
    const wasInputFocused = isChatInputFocused;
    stopRecordingAndTranscribe();
    
    // Restore focus after recording ends
    if (wasInputFocused && textInputRef.current) {
      setTimeout(() => {
        textInputRef.current?.focus();
      }, 200);
    }
  };

  const handlePopupAction = async (action: string, messageId: string) => {
    console.log(`Action: ${action} for message: ${messageId}`);
    setShowPopupForMessage(null);
    
    // Handle specific actions here
    switch (action) {
      case 'decline':
        console.log('User declined notification permissions');
        // Track notification permission denied
        trackNotificationPermissionDenied({ denied_via: 'onboarding' });
        break;
      case 'accept':
        try {
          // Track notification permission requested
          trackNotificationPermissionRequested();
          const granted = await requestPermissions();
          if (granted) {
            console.log('✅ Notification permissions granted and push token saved');
            // Track notification permission granted
            trackNotificationPermissionGranted({ granted_via: 'onboarding' });
            
            // Send confirmation message to chat
            const confirmationMessage: CoachingMessage = {
              id: (Date.now() + 3).toString(),
              role: 'assistant',
              content: "Perfect! I've saved your notification preferences. You'll receive thoughtful reflection prompts to help you stay connected with your insights and growth.",
              timestamp: new Date()
            };
            setMessages([...messages, confirmationMessage]);
          } else {
            console.log('❌ Notification permissions denied');
            // Track notification permission denied
            trackNotificationPermissionDenied({ denied_via: 'onboarding' });
            // Add message about manual setup
            const declineMessage: CoachingMessage = {
              id: (Date.now() + 3).toString(),
              role: 'assistant',
              content: "No problem! You can always enable notifications later in your device settings if you change your mind.",
              timestamp: new Date()
            };
            setMessages([...messages, declineMessage]);
          }
        } catch (error) {
          console.error('Error setting up notifications:', error);
        }
        break;
    }
  };

  const handleSchedulingAction = async (action: string, messageId: string, frequency?: string) => {
    console.log(`Scheduling action: ${action} for message: ${messageId}`, { frequency, selectedFrequency });
    
    // Find the message with checkin card
    const message = messages.find(msg => msg.id === messageId);
    if (!message) return;
    
    const coachingCards = parseCoachingCards(message.content);
    const checkinCard = coachingCards.find(card => card.type === 'checkin');
    
    if (!checkinCard) return;
    
    switch (action) {
      case 'decline':
        console.log('User declined scheduling checkins');
        setShowSchedulingForMessage(null);
        // Track coaching messages opt-in as declined
        trackCoachingMessagesOptIn({
          opted_in: false,
          context: 'onboarding',
        });
        // Add optional decline message
        const declineMessage: CoachingMessage = {
          id: (Date.now() + 3).toString(),
          role: 'assistant',
          content: "No worries! You can always set up check-ins later when you're ready to dive deeper into your growth journey.",
          timestamp: new Date()
        };
        setMessages([...messages, declineMessage]);
        break;
        
      case 'toggle-frequency':
        if (frequency) {
          console.log('User toggled frequency to:', frequency);
          setSelectedFrequency(frequency);
        }
        break;
        
      case 'confirm':
        try {
          console.log('✅ User confirmed scheduling:', { frequency: selectedFrequency, checkinCard: checkinCard.props });
          
          // Track coaching messages opt-in as confirmed
          trackCoachingMessagesOptIn({
            opted_in: true,
            frequency: selectedFrequency === 'once a week' ? 'weekly' : selectedFrequency === 'couple times a week' ? 'weekly' : 'daily',
            context: 'onboarding',
          });
          
          // Show confirmed state immediately
          setShowSchedulingForMessage(null);
          setConfirmedSchedulingForMessage(messageId);
          setConfirmedSchedulingMessages(prev => new Set([...prev, messageId]));
          
          // 1. Request notification permissions and save push token
          console.log('📱 Requesting notification permissions for check-ins...');
          const notificationGranted = await requestPermissions();
          
          // 2. Update user's coaching configuration in Firestore
          console.log('💾 Saving coaching configuration to user profile...');
          const configResult = await updateCoachingConfiguration(selectedFrequency);
          
          // 3. Call coaching interaction API with user's current context
          const userMessages = messages.filter(msg => msg.role === 'user');
          const contextContent = userMessages.map(msg => msg.content).join(' ').trim();
          
          // Provide a meaningful message for the API call
          const apiMessage = contextContent || `User confirmed ${selectedFrequency} check-ins about ${checkinCard.props.what || 'their progress'}`;
          
          console.log('📤 Sending to API:', { message: apiMessage, contextLength: contextContent.length });
          const apiResult = await callCoachingInteractionAPI(apiMessage);
          
          // 4. Show appropriate confirmation message based on results
          const what = checkinCard.props.what || 'your progress';
          
          if (configResult.success && apiResult && apiResult.success) {
            console.log('📅 Both config update and API call successful');
            
            const confirmationMessage: CoachingMessage = {
              id: (Date.now() + 3).toString(),
              role: 'assistant',
              content: notificationGranted 
                ? `Perfect! I've scheduled ${selectedFrequency} check-ins about ${what}. You'll receive thoughtful prompts to help you stay on track with your goals.`
                : `Great! I've scheduled ${selectedFrequency} check-ins about ${what}. You can enable notifications in your device settings to receive prompts directly.`,
              timestamp: new Date()
            };
            setMessages([...messages, confirmationMessage]);
          } else if (configResult.success) {
            console.log('📊 Config saved successfully, API call failed');
            
            const confirmationMessage: CoachingMessage = {
              id: (Date.now() + 3).toString(),
              role: 'assistant',
              content: notificationGranted
                ? `Great! I've saved your preference for ${selectedFrequency} check-ins about ${what}. Your coaching schedule is now active and you'll receive notifications.`
                : `Great! I've saved your preference for ${selectedFrequency} check-ins about ${what}. Your coaching schedule is now active.`,
              timestamp: new Date()
            };
            setMessages([...messages, confirmationMessage]);
          } else {
            console.log('⚠️ Config update failed, showing fallback message');
            
            const confirmationMessage: CoachingMessage = {
              id: (Date.now() + 3).toString(),
              role: 'assistant',
              content: notificationGranted
                ? `Got it! I've noted your preference for ${selectedFrequency} check-ins about ${what}. This will help you stay accountable to your goals, and you'll receive notifications when it's time to check in.`
                : `Got it! I've noted your preference for ${selectedFrequency} check-ins about ${what}. This will help you stay accountable to your goals.`,
              timestamp: new Date()
            };
            setMessages([...messages, confirmationMessage]);
          }
          
          // Keep confirmed popup visible permanently
          
        } catch (error) {
          console.error('Error setting up scheduling:', error);
          setShowSchedulingForMessage(null);
          // Add error message
          const errorMessage: CoachingMessage = {
            id: (Date.now() + 3).toString(),
            role: 'assistant',
            content: "I had trouble setting up the scheduling right now, but don't worry - we can try again later.",
            timestamp: new Date()
          };
          setMessages([...messages, errorMessage]);
        }
        break;
    }
  };

  // Function to trigger insight extraction
  const triggerInsightExtraction = async (sessionId: string) => {
    try {
      const token = await getToken();
      if (!token) {
        console.error('❌ No auth token available for insight extraction');
        return;
      }

      console.log('📤 Calling insight extraction API...', {
        endpoint: `${process.env.EXPO_PUBLIC_API_URL}api/coaching/insightExtractor`,
        sessionId: sessionId,
        hasToken: !!token
      });

      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}api/coaching/insightExtractor`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          sessionId: sessionId
        }),
      });

      console.log('📥 Insight extraction API response:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Insight extraction successful:', result);
      } else {
        const errorText = await response.text();
        console.error('❌ Insight extraction failed:', {
          status: response.status,
          statusText: response.statusText,
          errorText: errorText
        });
      }
    } catch (error) {
      console.error('❌ Error calling insight extraction API:', error);
    }
  };

  const handleCompletionAction = async () => {
    console.log('User clicked View Compass Results');
    console.log('📊 Session Stats:', completionStats);
    console.log('🎯 Parsed Coaching Data:', parsedCoachingData);
    
    if (parsedCoachingData) {
      parsedCoachingData.components.forEach((component, index) => {
        console.log(`  ${index + 1}. ${component.type.toUpperCase()}:`, component.props);
      });
    }
    
    try {
      setIsCompletingOnboarding(true);
      console.log('🚀 Starting onboarding completion from deep dive...');
      
      // Complete onboarding first
      const result = await completeOnboarding();
      console.log('✅ Onboarding completion finished successfully', result);
      
      // Clear onboarding progress from AsyncStorage
      await clearProgress();

      // Navigate to compass story with onboarding completed
      navigation.navigate('CompassStory', { 
        fromOnboarding: true,
        sessionId: getSessionId(), // Pass sessionId for insight tracking
        parsedCoachingData: parsedCoachingData || undefined
      });
      setShowCompletionForMessage(null);

      // Trigger insight extraction in background if we have a session ID
      const finalSessionId = getSessionId();
      if (finalSessionId && finalSessionId !== 'anonymous-onboarding') {
        console.log('🧠 Starting insight extraction for onboarding session:', finalSessionId);
        triggerInsightExtraction(finalSessionId); // Don't await - run in background
      }

      // After compass story, navigate to main app
      setTimeout(() => {
        // @ts-ignore - allow parent navigator access
        navigation.getParent()?.reset({
          index: 0,
          routes: [{ name: 'App' as never }],
        });
      }, 2000); // Give time for compass story to show

    } catch (error) {
      console.error('❌ Error completing onboarding from deep dive:', error);
      setIsCompletingOnboarding(false);
    }
  };

  const handleEnterApp = async () => {
    console.log('🏁 User clicked Enter App - completing onboarding');
    console.log('📊 Session Stats:', completionStats);
    console.log('🎯 Parsed Coaching Data:', parsedCoachingData);
    
    try {
      setIsCompletingOnboarding(true);
      console.log('🚀 Starting onboarding completion...');
      const result = await completeOnboarding();
      console.log('✅ Onboarding completion finished successfully', result);
      
      // Track onboarding completion analytics
      const sessionEndTime = new Date();
      const sessionDurationMs = sessionEndTime.getTime() - sessionStartTime.getTime();
      const onboardingDuration = Math.floor(sessionDurationMs / 1000);
      
      trackOnboardingCompleted({
        onboarding_duration: onboardingDuration,
        steps_completed: 17, // All steps including deep dive completed
        user_responses: completionStats.words,
      });
      
      // Clear onboarding progress from AsyncStorage
      console.log('🗑️ Clearing onboarding progress from AsyncStorage...');
      await clearProgress();
      console.log('✅ Onboarding progress cleared successfully');
      
      // Mark onboarding as completed to prevent saving progress on unmount
      setIsOnboardingCompleted(true);
      isOnboardingCompletedRef.current = true;
      console.log('✅ Marked onboarding as completed - will skip progress save on unmount');

      // After marking onboarding complete, forcefully go to the main app route at the root navigator
      // This avoids relying solely on state propagation timing
      console.log('🔄 Navigating to main app...');
      // @ts-ignore - allow parent navigator access
      navigation.getParent()?.reset({
        index: 0,
        routes: [{ name: 'App' as never }],
      });
    } catch (error) {
      console.error('❌ Error completing onboarding:', error);
    } finally {
      setIsCompletingOnboarding(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* Header */}
        <View style={[styles.chatHeader, { backgroundColor: colors.background, paddingTop: insets.top + 25, borderColor: `${colors.tint}12` }]}>
          <Text style={[styles.chatHeaderText, { color: colors.text }]}>
            Life Deep Dive
          </Text>
          
          <View style={styles.progressSection}>
            <Text style={[styles.chatProgressText, { color: `${colors.text}66` }]}>
              {Math.round(progress)}%
            </Text>
            
            {/* Circular Progress Bar */}
            <Progress.Circle
              size={20}
              animated={true}
              progress={Math.min(progress / 100, 1)} // Ensure it doesn't exceed 1
              color={colors.tint}
              unfilledColor={`${colors.text}20`}
              borderWidth={0}
              thickness={4}
              strokeCap='round'
              showsText={false}
            />
          </View>
        </View>

        {/* Messages */}
        <View style={styles.messagesContainer}>
          <ScrollView
            ref={scrollViewRef}
            style={styles.messagesList}
            contentContainerStyle={[
              styles.messagesContent, 
              { 
                minHeight: scrollLimits.minContentHeight,
                paddingBottom: dynamicBottomPadding
              }
            ]}
            scrollEventThrottle={16}
            onScroll={(event) => {
              // Call existing handleScroll function
              handleScroll(event);
              
              // Update content height
              const { contentSize } = event.nativeEvent;
              setContentHeight(contentSize.height);
            }}
            onLayout={(event) => {
              // ScrollView height'ını kaydet
              const { height } = event.nativeEvent.layout;
              setScrollViewHeight(height);
            }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            bounces={false}
            overScrollMode="never"
            // Scroll limiti ekle
            onScrollEndDrag={(event) => {
              const { contentOffset } = event.nativeEvent;
              
              // Eğer maksimum scroll limitini aşmışsa, geri getir
              if (contentOffset.y > scrollLimits.maxScrollDistance) {
                scrollViewRef.current?.scrollTo({
                  y: scrollLimits.maxScrollDistance,
                  animated: true
                });
              }
            }}
            // Momentum scroll sonrası da kontrol et
            onMomentumScrollEnd={(event) => {
              const { contentOffset } = event.nativeEvent;
              
              if (contentOffset.y > scrollLimits.maxScrollDistance) {
                scrollViewRef.current?.scrollTo({
                  y: scrollLimits.maxScrollDistance,
                  animated: true
                });
              }
            }}
          >
            {messages.map((message) => (
              <View
                key={message.id}
                ref={(ref) => {
                  messageRefs.current[message.id] = ref;
                }}
                style={[
                  styles.messageContainer,
                  message.role === 'user' ? styles.userMessageContainer : styles.aiMessageContainer
                ]}
              >
                <View>
                  <Text
                    style={[
                      styles.messageText,
                      message.role === 'user'
                        ? { color: `${colors.text}99` }
                        : { color: colors.text }
                    ]}
                  >
                    {getDisplayContent(message.content)}
                  </Text>
                </View>

                                {/* AI Chat Popup */}
                {message.role === 'assistant' && showPopupForMessage === message.id && (
                  <View style={[
                    styles.aiPopup,
                    {
                      backgroundColor: colorScheme === 'dark' ? '#2A2A2A' : '#FFFFFF',
                      borderColor: colorScheme === 'dark' ? '#333' : '#0000001A',
                    }
                  ]}>
                    <View style={styles.aiPopupContent}>
                      <Text style={[styles.aiPopupHeader, { color: colors.text }]}>
                        Accept suggested notifications?
                      </Text>
                      <Text style={[styles.aiPopupText, { color: `${colors.text}80` }]}>
                        Would you like to implement this notification schedule?
                      </Text>

                      <View style={styles.aiPopupButtons}>
                        <Button
                          variant="secondary"
                          size="sm"
                          onPress={() => handlePopupAction('decline', message.id)}
                          style={{ flex: 1 }}
                        >
                          Decline
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onPress={() => handlePopupAction('accept', message.id)}
                          style={{ flex: 1 }}
                        >
                          Accept
                        </Button>
                      </View>
                    </View>
                  </View>
                )}

                {/* Scheduling Popup - appears when checkin cards are detected */}
                {message.role === 'assistant' && showSchedulingForMessage === message.id && (() => {
                  const coachingCards = parseCoachingCards(message.content);
                  const checkinCard = coachingCards.find(card => card.type === 'checkin');
                  const what = checkinCard?.props.what || 'your progress';
                  
                  return (
                    <View style={[
                      styles.aiPopup,
                      {
                        backgroundColor: colorScheme === 'dark' ? '#2A2A2A' : '#FFFFFF',
                        borderColor: colorScheme === 'dark' ? '#333' : '#0000001A',
                      }
                    ]}>
                      <View style={styles.aiPopupContent}>
                        <Text style={[styles.aiPopupHeader, { color: colors.text }]}>
                          How often would you like check-ins?
                        </Text>
                        <Text style={[styles.aiPopupText, { color: `${colors.text}80` }]}>
                          Choose a frequency for check-ins about {what}
                        </Text>

                        {/* Frequency Toggle Options */}
                        <View style={[styles.aiPopupButtons, { flexDirection: 'column', gap: 8, marginBottom: 8 }]}>
                          <Button
                            variant={selectedFrequency === 'daily' ? 'primary' : 'secondary'}
                            size="sm"
                            onPress={() => handleSchedulingAction('toggle-frequency', message.id, 'daily')}
                            style={{ width: '100%' }}
                          >
                            Daily
                          </Button>
                          <Button
                            variant={selectedFrequency === 'once a week' ? 'primary' : 'secondary'}
                            size="sm"
                            onPress={() => handleSchedulingAction('toggle-frequency', message.id, 'once a week')}
                            style={{ width: '100%' }}
                          >
                            Once a week
                          </Button>
                          <Button
                            variant={selectedFrequency === 'couple times a week' ? 'primary' : 'secondary'}
                            size="sm"
                            onPress={() => handleSchedulingAction('toggle-frequency', message.id, 'couple times a week')}
                            style={{ width: '100%' }}
                          >
                            Couple times a week
                          </Button>
                        </View>

                        {/* Action Buttons */}
                        <View style={styles.aiPopupButtons}>
                          <Button
                            variant="primary"
                            size="sm"
                            onPress={() => handleSchedulingAction('confirm', message.id)}
                            style={{ width: '100%' }}
                          >
                            Confirm
                          </Button>
                        </View>
                      </View>
                    </View>
                  );
                })()}

                {/* Confirmed Scheduling Popup - appears after user confirms */}
                {message.role === 'assistant' && confirmedSchedulingForMessage === message.id && (() => {
                  return (
                    <View style={[
                      styles.aiPopup,
                      {
                        backgroundColor: colorScheme === 'dark' ? '#2A2A2A' : '#FFFFFF',
                        borderColor: colorScheme === 'dark' ? '#333' : '#0000001A',
                      }
                    ]}>
                      <View style={styles.aiPopupContent}>
                        <Text style={[styles.aiPopupHeader, { color: colors.text }]}>
                          Check-in schedule confirmed
                        </Text>
                        <Text style={[styles.aiPopupText, { color: `${colors.text}80` }]}>
                          You'll receive {selectedFrequency} reminders to help you stay on track.
                        </Text>

                        {/* Confirmed Button */}
                        <View style={styles.aiPopupButtons}>
                          <Button
                            variant="secondary"
                            size="sm"
                            onPress={() => {}} // No action needed, disabled state
                            style={{ width: '100%', opacity: 0.6 }}
                            disabled={true}
                          >
                            Confirmed
                          </Button>
                        </View>
                      </View>
                    </View>
                  );
                })()}

                {/* Completion Popup - appears on final message when progress reaches 100% */}
                {message.role === 'assistant' && showCompletionForMessage === message.id && (
                  <View style={[
                    styles.aiPopup,
                    {
                      backgroundColor: colorScheme === 'dark' ? '#2A2A2A' : '#FFFFFF',
                      borderColor: colorScheme === 'dark' ? '#333' : '#0000001A',
                    }
                  ]}>
                    <View style={styles.aiPopupContent}>
                      <Text style={[styles.aiPopupHeader, { color: colors.text }]}>
                        You've invested in yourself.
                      </Text>
                      <Text style={[styles.aiPopupText, { color: `${colors.text}80` }]}>
                        Now let's see what is reflecting.
                      </Text>
                      
                      <Text style={[styles.aiPopupText, { color: `${colors.text}66`, fontSize: 13, marginTop: 4 }]}>
                        {completionStats.minutes} min • {completionStats.words} words • {completionStats.keyInsights} key insights
                      </Text>

                      <View style={styles.aiPopupButtons}>
                        <Button
                          variant="primary"
                          size="sm"
                          onPress={handleCompletionAction}
                          style={{ flex: 1 }}
                          disabled={isCompletingOnboarding}
                          isLoading={isCompletingOnboarding}
                        >
                          {isCompletingOnboarding ? 'Completing...' : 'View Compass Results'}
                        </Button>
                      </View>
                    </View>
                  </View>
                )}
              </View>
            ))}
            {isLoading && (
              <View style={[
                styles.messageContainer, 
                styles.aiMessageContainer,
                styles.loadingMessageContainer
              ]}>
                <AnimatedTypingIndicator colorScheme={colorScheme} />
              </View>
            )}
          </ScrollView>
          
          {/* Scroll to bottom button */}
          {showScrollToBottom && (
            <TouchableOpacity
              style={[
                styles.scrollToBottomButton,
                {
                  backgroundColor: colorScheme === 'dark' ? '#333333' : '#FFFFFF',
                  borderColor: colorScheme === 'dark' ? '#555555' : '#E5E5E5',
                }
              ]}
              onPress={handleScrollToBottom}
            >
              <ArrowDown size={20} color={colors.text} />
            </TouchableOpacity>
          )}
        </View>

        {/* Bottom section with Enter App button and input */}
        <View style={styles.bottomSection}>
          {/* Enter App Button when progress is complete - appears above input */}
          {hasReached100 && (
            <View style={styles.enterAppContainer}>
              <Button
                variant="primary"
                size="default"
                onPress={handleEnterApp}
                style={styles.enterAppButton}
                disabled={isCompletingOnboarding}
                isLoading={isCompletingOnboarding}
              >
                {isCompletingOnboarding ? 'Starting your journey...' : 'Enter App'}
              </Button>
            </View>
          )}

          {/* Input - always visible */}
          <View style={styles.chatInputContainer}>
            <View style={[
              styles.chatInputWrapper,
              {
                backgroundColor: colors.background,
                borderTopWidth: 1,
                borderLeftWidth: 1,
                borderRightWidth: 1,
                borderColor: `${colors.tint}12`,
                paddingBottom: Math.max(insets.bottom, 20), // Ensure minimum padding + safe area
                flexDirection: isRecording ? 'column' : 'row',
              }
            ]}>
              {/* Full-width TextInput with text constrained to left side */}
              {isTranscribing ? (
                <View style={[styles.chatInput, styles.transcribingInputContainer]}>
                  <SpinningAnimation colorScheme={colorScheme} />
                </View>
              ) : !isRecording ? (
                <TextInput
                  ref={textInputRef}
                  style={[
                    styles.chatInput,
                    { color: colors.text }
                  ]}
                  value={chatInput}
                  onChangeText={setChatInput}
                  onFocus={() => setIsChatInputFocused(true)}
                  onBlur={() => setIsChatInputFocused(false)}
                  placeholder="Share whats on your mind..."
                  placeholderTextColor={`${colors.text}66`}
                  multiline
                  maxLength={20000}
                  returnKeyType='default'
                  onSubmitEditing={handleSendMessage}
                  cursorColor={colors.tint}
                />
              ) : null}

              {/* Recording state */}
              {isRecording && !isTranscribing && (
                <View style={styles.recordingContainer}>
                  <TouchableOpacity
                    style={[styles.recordingButton, { backgroundColor: `${colors.text}20` }]}
                    onPress={handleRecordingCancel}
                  >
                    <X
                      size={20}
                      color={colors.text}
                    />
                  </TouchableOpacity>
                  
                  <View style={styles.recordingCenterSection}>
                    <AudioLevelIndicator audioLevel={audioLevel} colorScheme={colorScheme} />
                  </View>
                  
                  <View style={styles.recordingRightSection}>
                    <RecordingTimer startTime={recordingStartTime} colorScheme={colorScheme} />
                    <TouchableOpacity
                      style={[styles.recordingButton, { backgroundColor: colors.text }]}
                      onPress={handleRecordingConfirm}
                    >
                      <Check
                        size={20}
                        color={colors.background}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Absolutely positioned buttons overlay */}
              {!isRecording && (
                <View style={styles.buttonOverlay}>
                  {/* Empty input - show microphone only */}
                  {chatInput.trim().length === 0 && !isTranscribing && (
                    <TouchableOpacity
                      style={[styles.microphoneButton, { backgroundColor: colors.text }]}
                      onPress={handleMicrophonePress}
                    >
                      <Mic
                        size={20}
                        color={colors.background}
                      />
                    </TouchableOpacity>
                  )}

                  {/* Text entered - show both microphone and send buttons */}
                  {(chatInput.trim().length > 0 || isTranscribing) && (
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                      <TouchableOpacity
                        style={[styles.microphoneButton, { backgroundColor: colors.text }]}
                        onPress={handleMicrophonePress}
                        disabled={isTranscribing}
                      >
                        <Mic
                          size={20}
                          color={colors.background}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.sendButton, 
                          { 
                            backgroundColor: isTranscribing ? `${colors.text}66` : colors.text 
                          }
                        ]}
                        onPress={handleSendMessage}
                        disabled={isTranscribing}
                      >
                        <ArrowUp
                          size={20}
                          color={colors.background}
                        />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    zIndex: 10,
  },
  chatHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  chatProgressText: {
    fontSize: 16,
    fontWeight: '400',
    textAlign: 'center',
  },
  messagesContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  messagesList: {
    flex: 1,
    paddingTop: 12,
    zIndex: 0,
    overflow: 'visible',
    backgroundColor: 'transparent'
  },
  messagesContent: {
    flexGrow: 1,
  },
  messageContainer: {
    marginBottom: 16,
    paddingVertical: 6,
  },
  userMessageContainer: {
    alignItems: 'flex-end',
  },
  aiMessageContainer: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '85%',
    // paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 20,
  },
  messageText: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 22,
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 4,
    minHeight: 32, // Sabit minimum height
  },
  
  // Loading state'te message container için
  loadingMessageContainer: {
    minHeight: 60, // Loading indicator için sabit alan
    justifyContent: 'center',
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chatInputContainer: {
    paddingHorizontal: 0,
    paddingBottom: 0,
    paddingTop: 0,
    maxHeight: 180,
  },
  chatInputWrapper: {
    position: 'relative',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    paddingHorizontal: 20,
    paddingTop: 20,
    boxShadow: '0px -2px 20.9px 0px #00000005, 0px -4px 18.6px 0px #00000005, 0px 0.5px 0.5px 0px #0000001A inset',
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    maxHeight: 160, // Limit the wrapper height
  },
  buttonOverlay: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    zIndex: 10,
  },
  chatInput: {
    width: '100%',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 22,
    maxHeight: 100,
    paddingVertical: 8,
    paddingHorizontal: 0,
    paddingRight: 90, // Space for buttons to prevent text overlap
    backgroundColor: 'transparent',
  },
  sendButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  microphoneButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  recordingContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingTop: 8,
  },
  recordingCenterSection: {
    flex: 1,
    alignItems: 'flex-start',
    paddingLeft: 10,
  },
  recordingRightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recordingButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  aiPopup: {
    width: '105%',
    alignSelf: 'center',
    gap: 4,
    borderRadius: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#0000001A',
  },
  aiPopupContent: {
    paddingTop: 16,
    paddingRight: 16,
    paddingBottom: 8,
    paddingLeft: 16,
    gap: 4,
  },
  aiPopupHeader: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 16,
  },
  aiPopupText: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 16,
  },
  aiPopupButtons: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 8,
  },
  progressSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  transcribingInputContainer: {
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingLeft: 4,
  },
  loadingSpinner: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 20,
    width: 20,
  },
  spinner: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E5E5E5',
    borderTopColor: '#333333',
  },
  audioLevelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  audioLevelDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  recordingVisualizer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  recordingTimer: {
    fontSize: 14,
    fontWeight: '500',
  },
  bottomSection: {
    backgroundColor: 'transparent',
  },
  enterAppContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: 'transparent',
  },
  enterAppButton: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollToBottomButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 1000,
  },
}); 