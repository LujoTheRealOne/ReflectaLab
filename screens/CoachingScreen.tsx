import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { StyleSheet, Text, TextInput, View, useColorScheme, TouchableOpacity, ScrollView, SafeAreaView, KeyboardAvoidingView, Platform, Keyboard, ColorSchemeName, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ArrowLeft, Mic, X, Check, ArrowUp, RotateCcw } from 'lucide-react-native';
import * as Crypto from 'expo-crypto';
import { Colors } from '@/constants/Colors';
import { AppStackParamList } from '@/navigation/AppNavigator';
import { Button } from '@/components/ui/Button';
import { useAICoaching, CoachingMessage } from '@/hooks/useAICoaching';
import { useAuth } from '@/hooks/useAuth';
import { useAudioTranscriptionAv } from '@/hooks/useAudioTranscriptionAv';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

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
  const { messages, isLoading, sendMessage, resendMessage, setMessages, progress } = useAICoaching();
  
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

  // Function to clean message content by removing finish tokens and structured data
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
  } = useAudioTranscriptionAv({
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
  });

  const scrollViewRef = useRef<ScrollView>(null);
  const textInputRef = useRef<TextInput>(null);

  // Scroll position tracking to prevent auto-scroll during manual scrolling
  const isUserScrolling = useRef(false);
  const isNearBottom = useRef(true);
  const lastScrollY = useRef(0);
  const scrollTimeout = useRef<NodeJS.Timeout | null>(null);

  // Guard against duplicate loads for the same session
  const loadedSessionIdRef = useRef<string | null>(null);

  // Handle scroll events to track user scroll state
  const handleScroll = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const scrollY = contentOffset.y;
    const threshold = 50; // pixels from bottom to consider "near bottom"
    
    // Check if user is near the bottom
    isNearBottom.current = layoutMeasurement.height + scrollY >= contentSize.height - threshold;
    
    // Detect if user is actively scrolling
    if (Math.abs(scrollY - lastScrollY.current) > 1) {
      isUserScrolling.current = true;
      
      // Clear any existing timeout and set a new one
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }
      
      // Stop considering user as scrolling after 500ms of no scroll
      scrollTimeout.current = setTimeout(() => {
        isUserScrolling.current = false;
      }, 500);
    }
    
    lastScrollY.current = scrollY;
  };

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

  // Controlled scrolling - only when explicitly needed or user is at bottom
  const scrollToBottomRef = useRef(false);
  const previousMessageCountRef = useRef(0);
  
  useEffect(() => {
    // Only scroll if we explicitly requested it OR if new AI message arrives and user is near bottom
    const shouldScroll = scrollToBottomRef.current || 
      (messages.length > previousMessageCountRef.current && 
       messages.length > 0 && 
       messages[messages.length - 1]?.role === 'assistant' &&
       isNearBottom.current &&
       !isUserScrolling.current);
    
    if (shouldScroll && scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
        scrollToBottomRef.current = false;
      }, 200);
    }
    
    previousMessageCountRef.current = messages.length;
  }, [messages.length]);

  // Auto-scroll during streaming ONLY if user is not actively scrolling and is near bottom
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      
      // Check if completion popup is currently visible
      const hasVisiblePopup = showCompletionForMessage;
      
      // Only auto-scroll during streaming if:
      // 1. Last message is from assistant
      // 2. We're not in loading state (streaming in progress)
      // 3. User is not actively scrolling
      // 4. User is near the bottom of the chat OR there's a visible popup
      const shouldAutoScroll = lastMessage?.role === 'assistant' && 
                              !isLoading && 
                              !isUserScrolling.current && 
                              (isNearBottom.current || hasVisiblePopup);
      
      if (shouldAutoScroll && scrollViewRef.current) {
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    }
  }, [messages, isLoading, showCompletionForMessage]); // Trigger on messages array changes and popup visibility

  // Auto-scroll when completion popup appears to ensure it's visible
  useEffect(() => {
    if (showCompletionForMessage && scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 300); // Delay to ensure popup is rendered
    }
  }, [showCompletionForMessage]);

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

  // Cleanup keep awake and scroll timeout on component unmount
  useEffect(() => {
    return () => {
      deactivateKeepAwake();
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }
    };
  }, []);

  const handleSendMessage = async () => {
    if (chatInput.trim().length === 0) return;

    // Generate session ID for first user message if not already set
    let currentSessionId = sessionId;
    if (!currentSessionId) {
      currentSessionId = generateSessionId();
      setSessionId(currentSessionId);
      console.log(`🆔 Generated new session ID: ${currentSessionId}`);
    }

    const messageContent = chatInput.trim();
    setChatInput('');
    
    // Trigger scroll after sending message
    scrollToBottomRef.current = true;

    // Send message using the AI coaching hook with session ID and session type from route or default
    await sendMessage(messageContent, currentSessionId, {
      sessionType: routeSessionType || 'default-session'
    });
  };

  const handleResendMessage = async (messageId: string) => {
    // Generate session ID if not already set
    let currentSessionId = sessionId;
    if (!currentSessionId) {
      currentSessionId = generateSessionId();
      setSessionId(currentSessionId);
      console.log(`🆔 Generated new session ID for resend: ${currentSessionId}`);
    }

    // Trigger scroll after resending message
    scrollToBottomRef.current = true;

    // Resend message using the AI coaching hook
    await resendMessage(messageId, currentSessionId, {
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
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            scrollEventThrottle={16}
            onScroll={handleScroll}
          >
            {/* Loading existing session */}
            {loadingExistingSession && (
              <View style={[styles.messageContainer, styles.aiMessageContainer]}>
                <View style={styles.typingIndicator}>
                  <View style={[styles.typingDot, { backgroundColor: `${colors.text}40` }]} />
                  <View style={[styles.typingDot, { backgroundColor: `${colors.text}40` }]} />
                  <View style={[styles.typingDot, { backgroundColor: `${colors.text}40` }]} />
                </View>
                <Text style={[styles.messageText, { color: `${colors.text}60`, marginLeft: 8 }]}>
                  Loading session...
                </Text>
              </View>
            )}

            {messages.map((message) => (
              <View
                key={message.id}
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
                   
                   {/* Resend button for error messages */}
                   {message.role === 'assistant' && message.isError && (
                     <TouchableOpacity
                       style={[styles.resendButton, { 
                         backgroundColor: colorScheme === 'dark' ? '#444444' : '#F5F5F5',
                         borderColor: colorScheme === 'dark' ? '#555555' : '#E5E5E5'
                       }]}
                       onPress={() => handleResendMessage(message.id)}
                       disabled={isLoading}
                     >
                       <RotateCcw size={14} color={colors.text} />
                       <Text style={[styles.resendButtonText, { 
                         color: colors.text,
                         opacity: isLoading ? 0.5 : 1 
                       }]}>
                         Resend
                       </Text>
                     </TouchableOpacity>
                   )}
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
            {isLoading && (
              <View style={[styles.messageContainer, styles.aiMessageContainer]}>
                  <View style={styles.typingIndicator}>
                    <View style={[styles.typingDot, { backgroundColor: `${colors.text}40` }]} />
                    <View style={[styles.typingDot, { backgroundColor: `${colors.text}40` }]} />
                    <View style={[styles.typingDot, { backgroundColor: `${colors.text}40` }]} />
                  </View>
              </View>
            )}
          </ScrollView>
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
    overflow: 'visible'
  },
  messagesContent: {
    paddingBottom: 10,
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
    gap: 4,
    paddingVertical: 4,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
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
  resendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  resendButtonText: {
    fontSize: 13,
    fontWeight: '500',
  },
}); 