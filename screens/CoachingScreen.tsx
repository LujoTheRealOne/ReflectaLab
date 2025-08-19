import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { StyleSheet, Text, TextInput, View, useColorScheme, TouchableOpacity, ScrollView, SafeAreaView, KeyboardAvoidingView, Platform, Keyboard, ColorSchemeName, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ArrowLeft, Mic, X, Check, ArrowUp, ArrowDown } from 'lucide-react-native';
import * as Crypto from 'expo-crypto';
import { Colors } from '@/constants/Colors';
import { AppStackParamList } from '@/navigation/AppNavigator';
import { Button } from '@/components/ui/Button';
import { useAICoaching, CoachingMessage } from '@/hooks/useAICoaching';
import { useAuth } from '@/hooks/useAuth';
import { useAudioTranscriptionHybrid } from '@/hooks/useAudioTranscriptionNew';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { ActionPlanCard, BlockersCard, FocusCard, MeditationCard } from '@/components/cards';
import { useRevenueCat } from '@/hooks/useRevenueCat';
import { Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

type CoachingScreenNavigationProp = NativeStackNavigationProp<AppStackParamList, 'Coaching'>;

// Spinning animation component
const SpinningAnimation = ({ colorScheme }: { colorScheme: ColorSchemeName }) => {
  const spinValue = useRef(new Animated.Value(0)).current;
  
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

export default function CoachingScreen() {
  const navigation = useNavigation<CoachingScreenNavigationProp>();
  const route = useRoute();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const { user, firebaseUser, getToken } = useAuth();
  const { isPro, presentPaywallIfNeeded, currentOffering, initialized } = useRevenueCat(firebaseUser?.uid);

  // Get route parameters for existing session
  const routeSessionId = (route.params as any)?.sessionId;
  const routeSessionType = (route.params as any)?.sessionType;

  // Session ID state - will be generated when first message is sent or loaded from route
  const [sessionId, setSessionId] = useState<string | null>(routeSessionId || null);
  const [loadingExistingSession, setLoadingExistingSession] = useState(!!routeSessionId);
  
  // Generate unique session ID using proper UUID
  const generateSessionId = (): string => {
    return Crypto.randomUUID();
  };

  // Use the AI coaching hook
  const { messages, isLoading, sendMessage, setMessages, progress } = useAICoaching();
  
  const [chatInput, setChatInput] = useState('');
  const [isChatInputFocused, setIsChatInputFocused] = useState(false);
  const [showCompletionForMessage, setShowCompletionForMessage] = useState<string | null>(null);
  const [sessionStartTime] = useState(new Date());
  const [completionStats, setCompletionStats] = useState({
    minutes: 0,
    words: 0,
    keyInsights: 0
  });
  const [parsedCoachingData, setParsedCoachingData] = useState<{
    components: Array<{ type: string; props: Record<string, string> }>;
    rawData: string;
  } | null>(null);

  // Enhanced loading state management
  const [showLoadingIndicator, setShowLoadingIndicator] = useState(false);

  // Track AI response state more reliably
  const [aiResponseStarted, setAiResponseStarted] = useState(false);

  // Track when AI response actually starts
  useEffect(() => {
    if (isLoading) {
      setShowLoadingIndicator(true);
    } else {
      // Add a small delay before hiding loading indicator to ensure AI response is visible
      const timer = setTimeout(() => {
        setShowLoadingIndicator(false);
      }, 500); // 500ms delay to ensure AI response is rendered
      
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  // Monitor when AI response actually starts
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      const isLastMessageAI = lastMessage?.role === 'assistant';
      
      if (isLastMessageAI && isLoading) {
        // AI response has started
        setAiResponseStarted(true);
      } else if (!isLoading && aiResponseStarted) {
        // AI response has completed
        setAiResponseStarted(false);
      }
    }
  }, [messages, isLoading, aiResponseStarted]);

  // Enhanced loading indicator logic
  const shouldShowLoadingIndicator = isLoading || (aiResponseStarted && messages.length > 0);

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
    if (shouldShowLoadingIndicator) {
      totalHeight += 60;
    }
    
    return totalHeight;
  }, [messages, isLoading, shouldShowLoadingIndicator]);

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

  // Function to parse coaching completion data between finish tokens
  const parseCoachingCompletion = (content: string) => {
    const finishStartIndex = content.indexOf('[finish-start]');
    const finishEndIndex = content.indexOf('[finish-end]');
    
    if (finishStartIndex === -1 || finishEndIndex === -1) {
      return { components: [], rawData: '' };
    }
    
    // Extract content between finish tokens
    const finishContent = content.slice(finishStartIndex + '[finish-start]'.length, finishEndIndex).trim();
    
    // Parse component markers like [focus:focus="...",context="..."]
    const componentRegex = /\[(\w+):([^\]]+)\]/g;
    const components: Array<{ type: string; props: Record<string, string> }> = [];
    
    let match;
    while ((match = componentRegex.exec(finishContent)) !== null) {
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
      
      components.push({ type: componentType, props });
    }
    
    console.log('🎯 Parsed coaching completion:', { 
      componentsCount: components.length, 
      components,
      rawFinishContent: finishContent
    });
    
    return { components, rawData: finishContent };
  };

  // Function to parse coaching cards from any content
  const parseCoachingCards = (content: string) => {
    // Parse component markers like [focus:focus="...",context="..."]
    const componentRegex = /\[(\w+):([^\]]+)\]/g;
    const components: Array<{ type: string; props: Record<string, string> }> = [];
    
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
      
      components.push({ type: componentType, props });
    }
    
    return components;
  };

  // Function to render a coaching card based on type and props
  const renderCoachingCard = (type: string, props: Record<string, string>, index: number) => {
    const baseProps = {
      key: `coaching-card-${type}-${index}`,
      editable: false, // Cards in messages should not be editable
    };

    switch (type) {
      case 'meditation':
        return (
          <MeditationCard
            {...baseProps}
            title={props.title || 'Guided Meditation'}
            duration={parseInt(props.duration || '300')}
            description={props.description}
            type={(props.type as 'breathing' | 'mindfulness' | 'body-scan') || 'breathing'}
          />
        );
      case 'focus':
        // Handle both expected format (focus/context) and AI output format (headline/explanation)
        const focusText = props.focus || props.headline || 'Main focus not specified';
        const contextText = props.context || props.explanation;
        
        return (
          <FocusCard
            {...baseProps}
            focus={focusText}
            context={contextText}
          />
        );
      case 'blockers':
        const blockers = props.items ? props.items.split('|').map((item: string) => item.trim()).filter(Boolean) : [];
        return (
          <BlockersCard
            {...baseProps}
            blockers={blockers}
            title={props.title}
          />
        );
      case 'actions':
        const actions = props.items ? props.items.split('|').map((item: string) => item.trim()).filter(Boolean) : [];
        return (
          <ActionPlanCard
            {...baseProps}
            actions={actions}
            title={props.title}
          />
        );
      case 'checkin':
        // Check-in cards are handled by the scheduling popup system
        return null;
      default:
        return (
          <View key={`unknown-card-${index}`} style={{
            padding: 16, 
            backgroundColor: colorScheme === 'dark' ? '#374151' : '#F3F4F6', 
            borderRadius: 8, 
            marginVertical: 8
          }}>
            <Text style={{ color: colorScheme === 'dark' ? '#9CA3AF' : '#6B7280', fontSize: 14 }}>
              Unknown component: {type}
            </Text>
          </View>
        );
    }
  };

  // Function to clean message content by removing finish tokens and coaching cards
  const getDisplayContent = (content: string) => {
    let cleanContent = content;
    
    // Remove content between finish tokens, but preserve content after [finish-end]
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
    
    // Clean up extra whitespace/newlines that might be left
    cleanContent = cleanContent.replace(/\n\s*\n\s*\n/g, '\n\n'); // Replace multiple newlines with double newlines
    cleanContent = cleanContent.trim();
    
    return cleanContent;
  };

  // Use the audio transcription hook
  const {
    isRecording,
    isTranscribing,
    recordingStartTime,
    audioLevel,
    startRecording,
    stopRecordingAndTranscribe,
    cancelRecording,
  } = useAudioTranscriptionHybrid({
    onTranscriptionComplete: (transcription) => {
      // Append transcription to existing text or set it as new text
      const existingText = chatInput.trim();
      const newText = existingText 
        ? `${existingText} ${transcription}` 
        : transcription;
      setChatInput(newText);
      // Focus the text input after transcription is complete
      setTimeout(() => {
        textInputRef.current?.focus();
      }, 100);
    },
    onTranscriptionError: (error) => {
      console.error('Transcription error:', error);
    },
    isPro,
    onProRequired: async () => {
      const unlocked = await presentPaywallIfNeeded('reflecta_pro', currentOffering || undefined);
      console.log('🎤 Voice transcription Pro check:', unlocked ? 'unlocked' : 'cancelled');
    },
  });

  const scrollViewRef = useRef<ScrollView>(null);
  const textInputRef = useRef<TextInput>(null);

  // Guard against duplicate loads for the same session
  const loadedSessionIdRef = useRef<string | null>(null);
  const paywallShownRef = useRef<boolean>(false);
  const accessCheckedRef = useRef<boolean>(false);
  
  // Gate access: ALL coaching requires Pro. Run once per focus, after RevenueCat initialized.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const check = async () => {
        if (accessCheckedRef.current) return;
        if (!initialized) return; // wait for RC init
        accessCheckedRef.current = true;
        // Prevent multiple paywall presentations
        if (paywallShownRef.current) {
          return;
        }
        
        // console.log('🔒 Coaching access check:', { isPro, routeSessionId });
        if (!isPro) {
          // console.log('🚫 Not Pro, showing paywall');
          paywallShownRef.current = true;
          const unlocked = await presentPaywallIfNeeded('reflecta_pro', currentOffering || undefined);
          if (!unlocked && !cancelled) {
            // console.log('🔙 Paywall cancelled, going back');
            navigation.goBack();
          } else if (unlocked) {
            // console.log('✅ Pro unlocked via paywall');
            // Reset flag so future navigation works
            paywallShownRef.current = false;
          }
        } else {
          // console.log('✅ Pro user, allowing access');
        }
      };
      check();
      return () => { cancelled = true; accessCheckedRef.current = false; };
    }, [initialized, isPro, presentPaywallIfNeeded, currentOffering, navigation])
  );

  // Initialize chat - either load existing session or create new one
  useEffect(() => {
    // Load existing session via route param
    if (routeSessionId && firebaseUser) {
      // Prevent duplicate fetches for the same session
      if (loadedSessionIdRef.current === routeSessionId) return;
      loadedSessionIdRef.current = routeSessionId;

      setLoadingExistingSession(true);
      (async () => {
        try {
          const token = await getToken();
          if (!token) throw new Error('No auth token');

          const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}api/coaching/sessions?sessionId=${encodeURIComponent(routeSessionId)}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });

          if (!response.ok) {
            if (response.status === 404) {
              console.warn('Coaching session not found:', routeSessionId);
              return;
            }
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const result = await response.json();
          if (result.success && result.session) {
            const sessionMessages: CoachingMessage[] = result.session.messages.map((msg: any) => ({
              id: msg.id,
              role: msg.role,
              content: msg.content,
              timestamp: new Date(msg.timestamp)
            }));

            setMessages(sessionMessages);
            console.log(`✅ Loaded existing session: ${routeSessionId} with ${sessionMessages.length} messages`);
          }
        } catch (error) {
          console.error('Error loading coaching session:', error);
        } finally {
          setLoadingExistingSession(false);
        }
      })();
      return;
    }

    // Create new session with initial message if no route session and no messages yet
    if (!routeSessionId && messages.length === 0) {
      setTimeout(() => {
        const initialMessage: CoachingMessage = {
          id: '1',
          content: `Hello ${user?.firstName || 'there'}!\n\nI'm here to support your growth and reflection. What's on your mind today? Feel free to share anything that's weighing on you, exciting you, or simply present in your awareness right now.`,
          role: 'assistant',
          timestamp: new Date()
        };
        setMessages([initialMessage]);
      }, 1000);
    }
  }, [routeSessionId, firebaseUser, messages.length, setMessages, user?.firstName, getToken]);

  // Auto-scroll to position new messages below header
  const scrollToNewMessageRef = useRef(false);
  
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

  // 5. Remove position maintenance during AI response - too complex
  // Instead, adjust position once when AI response starts:
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

  // Check for completion when progress reaches 100%
  useEffect(() => {
    if (progress === 100 && !showCompletionForMessage) {
      console.log('🎯 Progress reached 100%! Showing completion popup...');
      
      // Find the final AI message
      const lastAIMessage = [...messages].reverse().find(msg => msg.role === 'assistant');
      
      if (lastAIMessage) {
        // Calculate session statistics
        const sessionEndTime = new Date();
        const sessionDurationMs = sessionEndTime.getTime() - sessionStartTime.getTime();
        const sessionMinutes = Math.round(sessionDurationMs / 60000);
        
        // Count words from user messages
        const userMessages = messages.filter(msg => msg.role === 'user');
        const totalWords = userMessages.reduce((count, msg) => {
          return count + msg.content.trim().split(/\s+/).filter(word => word.length > 0).length;
        }, 0);

        // Parse coaching completion data if available
        const parsedData = parseCoachingCompletion(lastAIMessage.content);
        const keyInsights = Math.max(parsedData.components.length, 3); // Use actual parsed components count
        
        setCompletionStats({
          minutes: Math.max(sessionMinutes, 1),
          words: totalWords,
          keyInsights
        });
        
        // Store parsed coaching data for future use
        setParsedCoachingData(parsedData);
        
        // Show completion popup for this specific message
        setShowCompletionForMessage(lastAIMessage.id);
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

    let currentSessionId = sessionId;
    if (!currentSessionId) {
      currentSessionId = generateSessionId();
      setSessionId(currentSessionId);
    }

    const messageContent = chatInput.trim();
    setChatInput('');
    
    // Set positioning flag
    hasUserScrolled.current = false;
    scrollToNewMessageRef.current = true; // This flag will trigger positioning

    console.log('📤 Sending message, positioning will be triggered');

    await sendMessage(messageContent, currentSessionId, {
      sessionType: routeSessionType || 'default-session'
    });
  };

  const handleMicrophonePress = () => {
    startRecording();
  };

  const handleRecordingCancel = () => {
    cancelRecording();
  };

  const handleRecordingConfirm = () => {
    stopRecordingAndTranscribe();
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

  const handleCompletionAction = async () => {
    console.log('User clicked End this session');
    console.log('📊 Session Stats:', completionStats);
    console.log('🎯 Parsed Coaching Data:', parsedCoachingData);
    
    if (parsedCoachingData) {
      parsedCoachingData.components.forEach((component, index) => {
        console.log(`  ${index + 1}. ${component.type.toUpperCase()}:`, component.props);
      });
    }
    
    // Navigate to compass story for coaching completion immediately
    navigation.navigate('CompassStory', { 
      fromCoaching: true,
      sessionId: sessionId || undefined,
      parsedCoachingData: parsedCoachingData || undefined
    } as any);
    setShowCompletionForMessage(null);
    
    // Trigger insight extraction in background if we have a session ID
    if (sessionId) {
      console.log('🧠 Starting insight extraction for session:', sessionId);
      triggerInsightExtraction(sessionId); // Don't await - run in background
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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* Header */}
        <View style={[styles.chatHeader, { backgroundColor: colors.background, paddingTop: insets.top + 25, borderColor: `${colors.tint}12` }]}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <ArrowLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.chatHeaderText, { color: colors.text }]}>
            Coaching
          </Text>
          <View style={{ width: 24 }} />
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
            {/* Loading existing session */}
            {loadingExistingSession && (
              <View style={[styles.messageContainer, styles.aiMessageContainer]}>
                <AnimatedTypingIndicator colorScheme={colorScheme} />
                <Text style={[styles.messageText, { color: `${colors.text}60`, marginLeft: 8 }]}>
                  Loading session...
                </Text>
              </View>
            )}

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

                   {/* Render coaching cards for AI messages */}
                   {message.role === 'assistant' && (() => {
                     const coachingCards = parseCoachingCards(message.content);
                     if (coachingCards.length > 0) {
                       return (
                         <View style={{ marginTop: 8, marginBottom: 16 }}>
                           {coachingCards.map((card, index) => renderCoachingCard(card.type, card.props, index))}
                         </View>
                       );
                     }
                     return null;
                   })()}
                 </View>

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
                         Session complete!
                       </Text>
                       <Text style={[styles.aiPopupText, { color: `${colors.text}80` }]}>
                         Great work on your coaching session.
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
                         >
                           View your compass
                         </Button>
                       </View>
                     </View>
                   </View>
                 )}
               </View>
             ))}
            {shouldShowLoadingIndicator && (
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

        {/* Input */}
        <View style={styles.chatInputContainer}>
          <View style={[
            styles.chatInputWrapper,
            {
              backgroundColor: colors.background,
              borderTopWidth: 1,
              borderLeftWidth: 1,
              borderRightWidth: 1,
              borderColor: `${colors.tint}12`,
              paddingBottom: Math.max(insets.bottom, 20),
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
                placeholder="Share what's on your mind..."
                placeholderTextColor={`${colors.text}66`}
                multiline
                maxLength={500}
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
    maxHeight: 160,
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
  recordingTimer: {
    fontSize: 14,
    fontWeight: '500',
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