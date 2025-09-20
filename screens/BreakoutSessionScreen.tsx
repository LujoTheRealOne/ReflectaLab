import { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { StyleSheet, Text, TextInput, View, useColorScheme, TouchableOpacity, ScrollView, SafeAreaView, KeyboardAvoidingView, Platform, Keyboard, ColorSchemeName, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Mic, X, Check, ArrowUp, ArrowDown, ArrowLeft, Square } from 'lucide-react-native';
import * as Crypto from 'expo-crypto';
import { Colors } from '@/constants/Colors';
import { AppStackParamList } from '@/navigation/AppNavigator';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Button } from '@/components/ui/Button';
import { useAICoaching, CoachingMessage } from '@/hooks/useAICoaching';
import { loadMessagesFromFirestore, saveMessagesToFirestore, initializeCoachingSession } from '@/services/coachingFirestore';
import { useCoachingScroll } from '@/hooks/useCoachingScroll';
import { useAuth } from '@/hooks/useAuth';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useAudioTranscription } from '@/hooks/useAudioTranscription';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { ActionPlanCard, BlockersCard, CommitmentCard, CommitmentCheckinCard, FocusCard, InsightCard, MeditationCard, SessionSuggestionCard, ScheduledSessionCard, SessionCard } from '@/components/cards';
import { CoachingCardRenderer, parseCoachingCompletion, getDisplayContent, CoachingCardRendererProps } from '@/components/coaching/CoachingCardRenderer';
import { useRevenueCat } from '@/hooks/useRevenueCat';
import { Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { coachingCacheService } from '@/services/coachingCacheService';

type BreakoutSessionScreenNavigationProp = NativeStackNavigationProp<AppStackParamList, 'BreakoutSession'>;
type BreakoutSessionScreenProps = NativeStackScreenProps<AppStackParamList, 'BreakoutSession'>;

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

// Modern loading spinner component
const ModernSpinner = ({ colorScheme, size = 20 }: { colorScheme: ColorSchemeName; size?: number }) => {
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
    
    return () => spinAnimation.stop();
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
          borderWidth: 2,
          borderColor: colorScheme === 'dark' ? '#666666' : '#CCCCCC',
          borderTopColor: colorScheme === 'dark' ? '#FFFFFF' : '#333333',
          transform: [{ rotate: spin }],
        },
      ]}
    />
  );
};

// Date separator component
const DateSeparator = ({ date, colorScheme }: { date: Date; colorScheme: ColorSchemeName }) => {
  const formatDate = (date: Date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const isToday = date.toDateString() === today.toDateString();
    const isYesterday = date.toDateString() === yesterday.toDateString();
    
    if (isToday) {
      return 'Today';
    } else if (isYesterday) {
      return 'Yesterday';
    } else {
      // Format as "Monday, Jan 15" for recent dates
      const daysDiff = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff <= 7) {
        return date.toLocaleDateString('en-US', { weekday: 'long' });
      } else {
        // Format as "Monday, Jan 15" for older dates
        return date.toLocaleDateString('en-US', { 
          weekday: 'long', 
          month: 'short', 
          day: 'numeric' 
        });
      }
    }
  };
  
  return (
    <View style={{
      alignItems: 'center',
      marginVertical: 20,
    }}>
      <View style={{
        backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
      }}>
        <Text style={{
          fontSize: 12,
          fontWeight: '500',
          color: colorScheme === 'dark' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}>
          {formatDate(date)}
        </Text>
      </View>
    </View>
  );
};

// Animated typing indicator component
const AnimatedTypingIndicator = ({ colorScheme }: { colorScheme: ColorSchemeName }) => {
  const dot1Animation = useRef(new Animated.Value(0)).current;
  const dot2Animation = useRef(new Animated.Value(0)).current;
  const dot3Animation = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    // Create smoother, faster animations for each dot
    const animation1 = Animated.loop(
      Animated.sequence([
        Animated.timing(dot1Animation, {
          toValue: 1,
          duration: 400, // Faster animation
          useNativeDriver: true
        }),
        Animated.timing(dot1Animation, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true
        })
      ])
    );

    const animation2 = Animated.loop(
      Animated.sequence([
        Animated.delay(150), // Shorter delay
        Animated.timing(dot2Animation, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true
        }),
        Animated.timing(dot2Animation, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true
        })
      ])
    );

    const animation3 = Animated.loop(
      Animated.sequence([
        Animated.delay(300), // Shorter delay
        Animated.timing(dot3Animation, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true
        }),
        Animated.timing(dot3Animation, {
          toValue: 0,
          duration: 400,
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
    outputRange: [0.4, 1] // Slightly higher minimum opacity
  });

  const dot2Opacity = dot2Animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 1]
  });

  const dot3Opacity = dot3Animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 1]
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

// Error message component
const ErrorMessage = ({ onRetry, colorScheme, isRetrying = false }: { 
  onRetry: () => void; 
  colorScheme: ColorSchemeName; 
  isRetrying?: boolean;
}) => {
  return (
    <View style={styles.errorContainer}>
      <TouchableOpacity
        style={[
          styles.retryButton,
          {
            backgroundColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.12)',
            borderWidth: colorScheme === 'dark' ? 0 : 0.5,
            borderColor: colorScheme === 'dark' ? 'transparent' : 'rgba(0, 0, 0, 0.1)',
            opacity: isRetrying ? 0.6 : 1,
          }
        ]}
        onPress={onRetry}
        disabled={isRetrying}
      >
        <IconSymbol 
          name="arrow.clockwise" 
          size={16} 
          color={colorScheme === 'dark' ? '#FFFFFF' : '#555555'} 
        />
      </TouchableOpacity>
    </View>
  );
};

export default function BreakoutSessionScreen({ route }: BreakoutSessionScreenProps) {
  const navigation = useNavigation<BreakoutSessionScreenNavigationProp>();
  const { sessionId, title, goal } = route.params;
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const { user, firebaseUser, getToken } = useAuth();
  const { 
    trackEntryCreated,
    trackCommitmentCreated
  } = useAnalytics();
  const { isPro, presentPaywallIfNeeded, currentOffering, initialized } = useRevenueCat(firebaseUser?.uid);

  // Get route parameters for existing session
  const routeSessionId = (route.params as any)?.sessionId;
  const routeSessionType = (route.params as any)?.sessionType;

  // ✅ BREAKOUT SESSION PATTERN: Use the actual breakout session ID from route params
  const getSessionId = (): string => {
    // CRITICAL SECURITY: Never allow breakout session to use main session ID
    if (!sessionId) {
      console.error('🚨 [SECURITY] No sessionId provided to breakout session!');
      return 'anonymous';
    }
    
    // CRITICAL SECURITY: Ensure this is a valid breakout session ID
    if (sessionId === user?.id || sessionId === firebaseUser?.uid) {
      console.error('🚨 [SECURITY] Breakout session attempted to use main session ID!', {
        sessionId,
        userId: user?.id,
        firebaseUid: firebaseUser?.uid
      });
      return 'anonymous';
    }
    
    // CRITICAL SECURITY: Ensure breakout session ID has correct format
    if (!sessionId.startsWith('session_')) {
      console.error('🚨 [SECURITY] Invalid breakout session ID format!', { sessionId });
      return 'anonymous';
    }
    
    return sessionId;
  };

  // ✅ COACHING SCREEN PATTERN: debugLog is now provided by useCoachingScroll hook

  // ✅ WEB PATTERN: Message storage is handled by API and useCoachingSession hook

  // ✅ WEB PATTERN: Session loading is now handled by useCoachingSession hook automatically

  // Debug function to clear storage (for testing)
  const clearStorageForUser = useCallback(async (userId: string) => {
    try {
      await coachingCacheService.clearUserMessages(userId);
      console.log('🗑️ Cleared secure cache for user:', userId);
    } catch (error) {
      console.error('Error clearing secure cache:', error);
    }
  }, []);

  // Test function to clear all coaching data
  let clearAllCoachingData: (() => Promise<void>) | null = null;

  // Manual refresh from backend
  let refreshFromBackend: (() => Promise<void>) | null = null;

  // Clear coaching cache for specific user with full state reset
  const clearCoachingCacheForUser = useCallback(async (userId: string) => {
    try {
      console.log('🧹 Clearing coaching cache and state for user:', userId);
      
      // Clear secure cache for this user
      await coachingCacheService.clearUserMessages(userId);
      
      // Reset all coaching-related states
      setAllMessages([]);
      setDisplayedMessageCount(300);
      setHasMoreMessages(false);
      setIsLoadingMore(false);
      setShowCompletionForMessage(null);
      setParsedCoachingData(null);
      setIsInitialized(false);
      
      console.log('✅ Coaching cache and state cleared for user:', userId);
    } catch (error) {
      console.error('❌ Error clearing coaching cache for user:', userId, error);
    }
  }, []);

  // Firestore direct access for breakout sessions
  const loadMessagesFromFirestore = useCallback(async (sessionId: string): Promise<{ allMessages: CoachingMessage[]; totalCount: number }> => {
    try {
      console.log('🔥 Loading messages from Firestore for breakout session:', sessionId);
      
      // Import Firestore dynamically to avoid SSR issues
      const { db } = await import('../lib/firebase');
      
       // Query for the specific breakout session by sessionId
       const { doc, getDoc } = await import('firebase/firestore');
       const sessionDocRef = doc(db, 'coachingSessions', sessionId);
       const sessionDoc = await getDoc(sessionDocRef);
      
       if (sessionDoc.exists()) {
         const sessionData = sessionDoc.data();
         const messages = sessionData.messages || [];
         
         console.log(`🔥 Found breakout session with ${messages.length} messages`);
        
        // Convert to our message format
        const firestoreMessages: CoachingMessage[] = messages.map((msg: any, index: number) => ({
          id: msg.id || `msg_${index}`,
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content || '',
          timestamp: msg.timestamp ? new Date(msg.timestamp.seconds * 1000) : new Date()
        }));
        
        console.log(`✅ Successfully loaded ${firestoreMessages.length} messages from Firestore`);
        return { allMessages: firestoreMessages, totalCount: firestoreMessages.length };
      } else {
        console.log('🔥 No breakout session found for sessionId:', sessionId);
        return { allMessages: [], totalCount: 0 };
      }
    } catch (error) {
      console.log('🔥 Firestore loading failed:', error);
      return { allMessages: [], totalCount: 0 };
    }
  }, []);

  // ✅ WEB PATTERN: Firestore operations are handled by API and useCoachingSession hook

  // Multi-device sync strategy using Firestore
  // ✅ WEB PATTERN: Session loading is now handled by useCoachingSession hook

  // ✅ BREAKOUT SESSION PATTERN: Use separate state management for breakout sessions
  const [messages, setMessages] = useState<CoachingMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(7);
  
  // ✅ BREAKOUT SESSION PATTERN: Track initialization state
  const [isInitialized, setIsInitialized] = useState(false);
  const initializationInProgress = useRef(false);
  
  // ✅ COACHING SCREEN PATTERN: Error handling state
  const [retryingMessageId, setRetryingMessageId] = useState<string | null>(null);
  
  // State for tracking expanded messages
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());

  // Function to check if a USER message is long and should be collapsible (only user messages)
  const isLongMessage = (content: string, role: string) => {
    if (role !== 'user') return false; // Only user messages can be collapsible
    const cleanContent = getDisplayContent(content);
    return cleanContent.length > 300; // Messages longer than 300 characters
  };

  // Function to get truncated message content
  const getTruncatedContent = (content: string, maxLength: number = 200) => {
    const cleanContent = getDisplayContent(content);
    if (cleanContent.length <= maxLength) return cleanContent;
    return cleanContent.substring(0, maxLength) + '...';
  };

  // Function to toggle message expansion
  const toggleMessageExpansion = (messageId: string) => {
    setExpandedMessages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  };
  
  // ✅ COACHING SCREEN PATTERN: CoachingCardRenderer props
  const coachingCardRendererProps: CoachingCardRendererProps = useMemo(() => ({
    messages,
    setMessages,
    firebaseUser: { uid: user?.id }, // Use Clerk user ID
    getToken,
    saveMessagesToFirestore: async (messages: CoachingMessage[], userId: string) => {
      // For breakout sessions, we don't save to Firestore directly
      // The API handles all persistence
      console.log('🔍 [BREAKOUT] CoachingCardRenderer saveMessagesToFirestore called, skipping for breakout session');
    }
  }), [messages, setMessages, user?.id, getToken]);
  
  // ✅ BREAKOUT SESSION PATTERN: Custom sendMessage for breakout sessions
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // ✅ COACHING SCREEN PATTERN: Typewriter effect function for React Native
  const simulateTypewriter = useCallback(async (content: string, messageId: string) => {
    const words = content.split(' ');
    let currentContent = '';
    
    for (let i = 0; i < words.length; i++) {
      currentContent += (i > 0 ? ' ' : '') + words[i];
      
      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, content: currentContent }
          : msg
      ));
      
      // Adjust speed based on word length - shorter delay for shorter words
      const delay = Math.min(Math.max(words[i].length * 10, 30), 100);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }, []);

  // Custom sendMessage function for breakout sessions
  const sendMessage = useCallback(async (content: string, sessionId: string, options?: { sessionType?: string; sessionDuration?: number }) => {
    if (!content.trim()) return;
    if (!sessionId || !sessionId.trim()) {
      throw new Error('Session ID is required for coaching messages');
    }

    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();

    const userMessage: CoachingMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date()
    };

    // Add user message immediately to breakout session state
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    try {
      // Get Clerk token for authentication
      const token = await getToken();
      if (!token) {
        throw new Error('Authentication token not available');
      }

      // Call the web app API endpoint
      console.log('🔍 [BREAKOUT API] Making API call to:', `${process.env.EXPO_PUBLIC_API_URL}api/coaching/chat`);
      console.log('🔍 [BREAKOUT API] Request payload:', {
        message: content.trim().substring(0, 50) + '...',
        sessionId: sessionId,
        sessionType: options?.sessionType || 'default-session',
        sessionDuration: options?.sessionDuration,
        conversationHistoryLength: messages.length
      });

      // CRITICAL FIX: Add React Native specific headers for SSE compatibility
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}api/coaching/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
        body: JSON.stringify({
          message: content.trim(),
          sessionId: sessionId,
          sessionType: options?.sessionType || 'default-session',
          sessionDuration: options?.sessionDuration,
          conversationHistory: messages // Include conversation history for context
        }),
        signal: abortControllerRef.current.signal,
      });

      console.log('🔍 [BREAKOUT API] Response received:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: {
          contentType: response.headers.get('content-type'),
          contentLength: response.headers.get('content-length'),
          connection: response.headers.get('connection')
        },
        hasBody: !!response.body,
        bodyLocked: response.bodyUsed
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [BREAKOUT API] HTTP error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      // ✅ COACHING SCREEN PATTERN: Create AI message placeholder for streaming
      const aiMessageId = (Date.now() + 1).toString();
      const aiMessage: CoachingMessage = {
        id: aiMessageId,
          role: 'assistant',
        content: '',
          timestamp: new Date()
        };
        
      // ✅ COACHING SCREEN PATTERN: Add AI message placeholder and stop loading immediately
      setMessages(prev => [...prev, aiMessage]);
      setIsLoading(false);

      // ✅ COACHING SCREEN PATTERN: React Native streaming implementation
      if (!response.body) {
        console.log('🔄 [BREAKOUT API] Using React Native text-based streaming (same as CoachingScreen)');
        const fullResponse = await response.text();
        
        // Parse the server-sent events format manually
        const lines = fullResponse.split('\n');
        let fullContent = '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'content') {
                fullContent += data.content;
              }
            } catch (parseError) {
              console.error('❌ [BREAKOUT API] Error parsing line:', line, parseError);
            }
          }
        }
        
        console.log('🤖 [BREAKOUT API] Full response content length:', fullContent.length);
        
        // ✅ COACHING SCREEN PATTERN: Use typewriter effect for smooth streaming experience
        console.log('⌨️ [BREAKOUT API] Starting typewriter effect...');
        await simulateTypewriter(fullContent, aiMessageId);
        
        console.log('✅ [BREAKOUT API] Text-based streaming with typewriter effect completed successfully');
        return; // Exit successfully
      }

      // ✅ COACHING SCREEN PATTERN: Handle normal streaming (if response.body exists)
      console.log('🔍 [BREAKOUT API] Using normal SSE stream reading...');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let assistantContent = '';
      let chunkCount = 0;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            console.log('🔍 [BREAKOUT API] Stream completed, total chunks:', chunkCount);
            break;
          }

          chunkCount++;
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                
                if (data.type === 'content' && data.content) {
                  assistantContent += data.content;
                  
                  // Update assistant message in breakout session state
                  setMessages(prev => prev.map(msg => 
                    msg.id === aiMessageId 
                      ? { ...msg, content: assistantContent }
                      : msg
                  ));
                } else if (data.type === 'done') {
                  console.log('✅ [BREAKOUT API] Stream completed successfully');
                } else if (data.type === 'error') {
                  console.error('❌ [BREAKOUT API] Stream error:', data.error);
                  throw new Error(data.error || 'Stream error');
                }
              } catch (parseError) {
                console.warn('⚠️ [BREAKOUT API] Failed to parse SSE data:', line, parseError);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
        console.log('🔍 [BREAKOUT API] Stream reader released');
      }

    } catch (error: any) {
      console.error('❌ [BREAKOUT API] Error in breakout session sendMessage:', {
        name: error.name,
        message: error.message,
        stack: error.stack?.substring(0, 200),
        isAbortError: error.name === 'AbortError',
        isNetworkError: error.message?.includes('fetch'),
        isResponseError: error.message?.includes('response')
      });
      
      if (error.name === 'AbortError') {
        console.log('🔄 [BREAKOUT API] Request was aborted by user');
        return;
      }

      // Remove user message on error and show error message
      setMessages(prev => prev.slice(0, -1));
      
      // Provide more specific error messages
      let errorContent = 'Sorry, I encountered an error. Please try again.';
      if (error.message?.includes('No response body')) {
        errorContent = 'Connection issue detected. The message was sent but the response stream failed. Please check your connection and try again.';
      } else if (error.message?.includes('HTTP error')) {
        errorContent = 'Server error occurred. Please try again in a moment.';
      } else if (error.message?.includes('Authentication')) {
        errorContent = 'Authentication error. Please refresh the app and try again.';
      }
      
      const errorMessage: CoachingMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: errorContent,
        timestamp: new Date(),
        isError: true
      };
      
      setMessages(prev => [...prev, errorMessage]);
      setError(error.message || 'An error occurred');
    }
  }, [getToken, messages, simulateTypewriter]);

  // ✅ COACHING SCREEN PATTERN: Handle message retry
  const handleRetryMessage = useCallback(async (messageId: string) => {
    if (retryingMessageId) return; // Prevent multiple retries
    
    setRetryingMessageId(messageId);
    
    try {
      // Find the failed message and the user message before it
      const messageIndex = messages.findIndex(msg => msg.id === messageId);
      if (messageIndex <= 0) return;
      
      const userMessage = messages[messageIndex - 1];
      if (userMessage.role !== 'user') return;
      
      // Remove the failed AI message
      setMessages(prev => prev.filter(msg => msg.id !== messageId));
      
      // Retry with the same user message
      await sendMessage(userMessage.content, sessionId);
      
    } catch (error) {
      console.error('❌ [RETRY] Error retrying message:', error);
    } finally {
      setRetryingMessageId(null);
    }
  }, [messages, retryingMessageId, sendMessage, sessionId]);

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
    }
  }, []);
  
  // ✅ WEB PATTERN: Determine if this is a breakout session
  const isBreakoutSession = sessionId && sessionId !== user?.id;
  
  // ✅ COACHING SCREEN PATTERN: Already using useAICoaching hook above
  
  // ✅ WEB PATTERN: Helper function to deduplicate messages by ID
  const deduplicateMessages = useCallback((messages: CoachingMessage[]): CoachingMessage[] => {
    const seen = new Set<string>();
    return messages.filter(msg => {
      if (seen.has(msg.id)) return false;
      seen.add(msg.id);
      return true;
    });
  }, []);

  // ✅ WEB PATTERN: Generate initial messages for new sessions
  const getInitialMessages = useCallback((): CoachingMessage[] => {
    if (!sessionId) return [];
    
    // For breakout sessions, show welcome message with title and goal
    if (isBreakoutSession && (title || goal)) {
      return [{
        id: `initial-${sessionId}`,
        role: 'assistant' as const,
          content: `Welcome to your breakout session: ${title || 'Focused Coaching'}\n\n${goal ? `Goal: ${goal}\n\n` : ''}I'm here to help you dive deeper into this specific topic. What would you like to explore?`,
          timestamp: new Date()
      }];
    }
    
    // Default fallback message
    return [{
      id: `initial-${sessionId}`,
      role: 'assistant' as const,
      content: "What's on your mind?",
        timestamp: new Date()
    }];
  }, [sessionId, isBreakoutSession, title, goal]);

  // ✅ COACHING SCREEN PATTERN: Session data derived from messages state
  const sessionData = {
    objective: isBreakoutSession ? (title || "Breakout Session") : "Coach",
    messages: deduplicateMessages(messages), // From useAICoaching hook
    sessionId: sessionId || user?.id,
    title: title,
    goal: goal
  };

  // Debug logging will be added after isInitialized declaration
  
  // Test function to clear breakout session data
  clearAllCoachingData = useCallback(async () => {
    if (!sessionId) return;
    
    try {
      console.log('🧹 Clearing breakout session data...', sessionId);
      
      // Clear Firestore breakout session
      const { db } = await import('../lib/firebase');
      const { doc, deleteDoc } = await import('firebase/firestore');
      
      const sessionDocRef = doc(db, 'coachingSessions', sessionId);
      await deleteDoc(sessionDocRef);
      console.log('🗑️ Deleted Firestore breakout session:', sessionId);
      
      // Session will be reloaded from Firestore automatically via useCoachingSession hook
      
      console.log('✅ Breakout session data cleared successfully');
    } catch (error) {
      console.error('❌ Error clearing breakout session data:', error);
    }
  }, [sessionId]);

  // Manual refresh from backend
  refreshFromBackend = useCallback(async () => {
    if (!sessionId) {
      console.warn('⚠️ Cannot refresh from backend: no sessionId');
      return;
    }

    try {
      console.log('🔄 Manual refresh from backend requested for breakout session:', sessionId);
      
      // useCoachingSession hook will automatically reload from Firestore
      
      console.log('✅ Refresh requested - session will reload automatically');
    } catch (error) {
      console.error('❌ Error refreshing from backend:', error);
    }
  }, [sessionId]);

  // Expose functions globally for testing (remove in production)
  if (__DEV__) {
    (global as any).clearCoachingData = clearAllCoachingData;
    (global as any).refreshCoachingFromBackend = refreshFromBackend;
    (global as any).coachingCacheService = coachingCacheService;
  }
  
  const [chatInput, setChatInput] = useState('');
  const [isChatInputFocused, setIsChatInputFocused] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [inputHeight, setInputHeight] = useState(24); // Initial height for minimum 1 line
  const [containerHeight, setContainerHeight] = useState(90); // Dynamic container height
  const [isInputExpanded, setIsInputExpanded] = useState(false); // Expand durumu
  const [currentLineCount, setCurrentLineCount] = useState(1); // Current line count
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

  // ✅ COACHING SCREEN PATTERN: aiResponseStarted is now managed later in the component

  // Pagination state for message loading
  const [allMessages, setAllMessages] = useState<CoachingMessage[]>([]);
  const [displayedMessageCount, setDisplayedMessageCount] = useState(300);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const MESSAGES_PER_PAGE = 100;
  
  // Throttling for pagination to prevent multiple rapid calls
  const lastLoadTimeRef = useRef<number>(0);
  const LOAD_THROTTLE_MS = 1000; // 1 second between loads

  // Load more messages for pagination
  const loadMoreMessages = useCallback(async () => {
    if (isLoadingMore || !hasMoreMessages) return;
    
    setIsLoadingMore(true);
    console.log(`🔄 Starting to load ${MESSAGES_PER_PAGE} more messages...`);
    
    try {
      // Add a small delay so user can see the loading indicator
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const newCount = Math.min(displayedMessageCount + MESSAGES_PER_PAGE, allMessages.length);
      const messagesToShow = allMessages.slice(-newCount);
      
      // Note: In web pattern, messages are derived from session state
      // This pagination logic may need to be handled differently
      setDisplayedMessageCount(newCount);
      setHasMoreMessages(newCount < allMessages.length);
      
      console.log(`✅ Loaded ${MESSAGES_PER_PAGE} more messages (${newCount}/${allMessages.length} total)`);
    } catch (error) {
      console.error('Error loading more messages:', error);
    } finally {
      // Add a small delay before hiding loading indicator
      setTimeout(() => {
        setIsLoadingMore(false);
      }, 200);
    }
  }, [isLoadingMore, hasMoreMessages, displayedMessageCount, allMessages, MESSAGES_PER_PAGE]);

  // Group messages by date and insert separators
  const getMessagesWithSeparators = useCallback((messages: CoachingMessage[]) => {
    if (messages.length === 0) return [];
    
    const result: Array<CoachingMessage | { type: 'separator'; date: Date; id: string }> = [];
    let lastDate: string | null = null;
    
    messages.forEach((message, index) => {
      const messageDate = new Date(message.timestamp).toDateString();
      
      // Add separator if this is a new day
      if (messageDate !== lastDate) {
        result.push({
          type: 'separator',
          date: new Date(message.timestamp),
          id: `separator-${messageDate}-${index}`
        });
        lastDate = messageDate;
      }
      
      result.push(message);
    });
    
    return result;
  }, []);

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

  // ✅ COACHING SCREEN PATTERN: All AI response monitoring is now managed later in the component

  //POWERFUL MESSAGE POSITIONING SYSTEM

  // 1. Define constant values
  const HEADER_HEIGHT = 120;
  const INPUT_HEIGHT = 160;
  const MESSAGE_TARGET_OFFSET = 20; // How many pixels below the header
  
  // Dynamic input constants
  const LINE_HEIGHT = 24;
  const MIN_LINES = 1;
  const MAX_LINES = 10;
  const EXPANDED_MAX_LINES = 18; // Maximum lines when expanded
  const INPUT_PADDING_VERTICAL = 8;
  const CONTAINER_BASE_HEIGHT = 90; // Minimum container height
  const CONTAINER_PADDING = 40; // Total container padding (8+20+12)

  // ✅ COACHING SCREEN PATTERN: dynamicContentHeight is now provided by useCoachingScroll hook
  // ✅ COACHING SCREEN PATTERN: All scroll-related calculations are now provided by useCoachingScroll hook

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
      
      // Debug logging for commitment cards (disabled)
      // if (componentType === 'commitmentDetected') {
      //   console.log('🎯 Parsed commitmentDetected token:', { props, state: props.state });
      // }
    }
    
    return components;
  };

  // Function to render a coaching card based on type and props
  const renderCoachingCard = (type: string, props: Record<string, string>, index: number, hostMessageId?: string) => {
    const baseProps = {
      key: `coaching-card-${type}-${index}`,
            editable: true, // Enable commitment card interactions
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
      case 'commitmentDetected': {
        const normalizedState = ((props.state as 'none' | 'accepted' | 'rejected') === 'accepted' && !props.commitmentId)
          ? 'none'
          : ((props.state as 'none' | 'accepted' | 'rejected') || 'none');
        return (
          <CommitmentCard
            key={baseProps.key}
            editable={baseProps.editable}
            title={props.title || 'Commitment'}
            description={props.description || ''}
            type={(props.type as 'one-time' | 'recurring') || 'one-time'}
            deadline={props.deadline}
            cadence={props.cadence}
            state={normalizedState}
            commitmentId={props.commitmentId}
            onUpdate={async (data) => {
              console.log('🎯 CommitmentCard onUpdate called:', data);
              
              if (!firebaseUser?.uid) {
                console.error('❌ No authenticated user for commitment update');
                return;
              }

              try {
                // 1. Update the message content with new state
                const updatedMessages = messages.map((message) => {
                  if (message.role !== 'assistant') return message;
                  if (hostMessageId && message.id !== hostMessageId) return message;

                  const tokenRegex = /\[commitmentDetected:([^\]]+)\]/g;
                  let occurrence = 0;
                   const updatedContent = message.content.replace(tokenRegex, (match: string, propsString: string) => {
                    if (occurrence !== index) { occurrence++; return match; }
                    occurrence++;

                    const existingProps: Record<string, string> = {};
                    const propRegex = /(\w+)="([^"]+)"/g;
                    let propMatch;
                    while ((propMatch = propRegex.exec(propsString)) !== null) {
                      const [, k, v] = propMatch;
                      existingProps[k] = v;
                    }
                    existingProps.state = data.state;
                    if (data.commitmentId) existingProps.commitmentId = data.commitmentId;

                    const newPropsString = Object.entries(existingProps)
                      .map(([k, v]) => `${k}="${v}"`)
                      .join(',');
                    return `[commitmentDetected:${newPropsString}]`;
                  });
                  return { ...message, content: updatedContent };
                });

                // 2. Update local messages state (will be persisted by outer effect)
                // Note: In web pattern, this would update the session in Firestore directly
                
                // 3. Let outer effect persist updates to avoid duplicate saves
                
                // 4. If accepted, create commitment via API
                if (data.state === 'accepted') {
                  const token = await getToken();
                  if (!token) {
                    console.error('❌ No auth token available');
                    return;
                  }

                  console.log('🔥 Creating commitment via API...');
                  const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}api/coaching/commitments/create`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                      title: props.title,
                      description: props.description,
                      type: props.type,
                      deadline: props.deadline,
                      cadence: props.cadence,
                      coachingSessionId: firebaseUser.uid,
                      messageId: hostMessageId || `msg_${Date.now()}`
                    }),
                  });

                  if (response.ok) {
                    const result = await response.json();
                    console.log('✅ Commitment created successfully:', result);
                    
                    // Track commitment creation in PostHog
                    trackCommitmentCreated({
                      user_id: firebaseUser.uid,
                      commitment_type: props.type as 'one-time' | 'recurring',
                      deadline: props.deadline,
                      cadence: props.cadence,
                      title_length: props.title?.length || 0,
                      description_length: props.description?.length || 0,
                      coaching_session_id: firebaseUser.uid,
                      source: 'coaching_card'
                    });
                  } else {
                    const errorText = await response.text();
                    console.error('❌ Failed to create commitment:', {
                      status: response.status,
                      error: errorText
                    });
                  }
                }
                
                console.log('✅ Commitment update completed successfully');
              } catch (error) {
                console.error('❌ Failed to update commitment:', error);
              }
            }}
          />
        );
      }
      case 'sessionSuggestion': {
        return (
          <SessionSuggestionCard
            key={baseProps.key}
            sessionSuggestion={{
              type: 'sessionSuggestion',
              title: props.title || 'Session Suggestion',
              reason: props.reason || '',
              duration: props.duration || '60m',
              state: (props.state as 'none' | 'scheduled' | 'dismissed') || 'none',
              scheduledDate: props.scheduledDate,
              scheduledTime: props.scheduledTime,
              scheduledSessionId: props.scheduledSessionId
            }}
            coachingSessionId={firebaseUser?.uid || 'unknown'}
            messageId={hostMessageId || 'unknown'}
            onSchedule={(sessionTitle, duration, dateTime) => {
              console.log('✅ Session scheduled:', { sessionTitle, duration, dateTime });
            }}
            onDismiss={(sessionTitle) => {
              console.log('✅ Session dismissed:', sessionTitle);
            }}
            onStateChange={async (newState, additionalData) => {
              console.log('🎯 SessionSuggestion state change:', { newState, additionalData });
              
              // Update the message content with new state
              try {
                const updatedMessages = messages.map((message) => {
                  if (message.role !== 'assistant') return message;
                  if (hostMessageId && message.id !== hostMessageId) return message;

                  const tokenRegex = /\[sessionSuggestion:([^\]]+)\]/g;
                  let occurrence = 0;
                   const updatedContent = message.content.replace(tokenRegex, (match: string, propsString: string) => {
                    if (occurrence !== index) { occurrence++; return match; }
                    occurrence++;

                    const existingProps: Record<string, string> = {};
                    const propRegex = /(\w+)="([^"]+)"/g;
                    let propMatch;
                    while ((propMatch = propRegex.exec(propsString)) !== null) {
                      const [, k, v] = propMatch;
                      existingProps[k] = v;
                    }
                    
                    // Update state and additional data
                    existingProps.state = newState;
                    if (additionalData?.scheduledDate) existingProps.scheduledDate = additionalData.scheduledDate;
                    if (additionalData?.scheduledTime) existingProps.scheduledTime = additionalData.scheduledTime;

                    const newPropsString = Object.entries(existingProps)
                      .map(([k, v]) => `${k}="${v}"`)
                      .join(',');
                    return `[sessionSuggestion:${newPropsString}]`;
                  });
                  return { ...message, content: updatedContent };
                });

                // Update messages in state (web pattern would update Firestore directly)
                // Note: This logic needs to be adapted for web pattern
                
                // ✅ WEB PATTERN: API handles Firestore updates automatically
                console.log('✅ SessionSuggestion state updated (API will sync to Firestore)');
                
              } catch (error) {
                console.error('❌ Failed to update session suggestion state:', error);
              }
            }}
          />
        );
      }
      case 'session': {
        return (
          <ScheduledSessionCard
            key={baseProps.key}
            session={{
              type: 'session',
              title: props.title || 'Session',
              goal: props.goal || '',
              duration: props.duration || '60m',
              question: props.question || '',
              scheduledSessionId: props.scheduledSessionId
            }}
            coachingSessionId={firebaseUser?.uid || 'unknown'}
            messageId={hostMessageId || 'unknown'}
            onReplaceWithSessionCard={async (sessionCardContent) => {
              console.log('🎯 Replacing session token with sessionCard token:', sessionCardContent);
              
              // Replace session token with sessionCard token in message
              try {
                const updatedMessages = messages.map((message) => {
                  if (message.role !== 'assistant') return message;
                  if (hostMessageId && message.id !== hostMessageId) return message;

                  const tokenRegex = /\[session:([^\]]+)\]/g;
                  let occurrence = 0;
                   const updatedContent = message.content.replace(tokenRegex, (match: string, propsString: string) => {
                    if (occurrence !== index) { occurrence++; return match; }
                    occurrence++;
                    return sessionCardContent; // Replace with sessionCard token
                  });
                  return { ...message, content: updatedContent };
                });

                // Update messages in state (web pattern would update Firestore directly)
                // Note: This logic needs to be adapted for web pattern
                
                // ✅ WEB PATTERN: API handles Firestore updates automatically
                console.log('✅ Session token replaced with sessionCard token (API will sync to Firestore)');
                
              } catch (error) {
                console.error('❌ Failed to replace session token:', error);
              }
            }}
          />
        );
      }
      case 'sessionCard': {
        return (
          <SessionCard
            key={baseProps.key}
            session={{
              type: 'sessionCard',
              title: props.title || 'Session',
              sessionId: props.sessionId || '',
              duration: props.duration || '60m',
              question: props.question || '',
              goal: props.goal || ''
            }}
            onContinueSession={(sessionId) => {
              console.log('✅ Continue session clicked:', sessionId);
            }}
          />
        );
      }
      case 'insight': {
        return (
          <InsightCard
            key={baseProps.key}
            insight={{
              type: 'insight',
              title: props.title || 'Insight',
              preview: props.preview || '',
              fullContent: props.fullContent || ''
            }}
            onDiscuss={(fullInsight) => {
              console.log('✅ Insight discussion requested:', fullInsight.substring(0, 100) + '...');
              // TODO: Handle insight discussion - could navigate to a discussion screen
              // or add the insight to the current conversation
            }}
          />
        );
      }
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
    
    // Remove triple backticks from LLM responses
    cleanContent = cleanContent.replace(/```/g, '').trim();
    
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
  } = useAudioTranscription({
    onTranscriptionComplete: (transcription) => {
      const existingText = chatInput.trim();
      const newText = existingText 
        ? `${existingText} ${transcription}` 
        : transcription;
      setChatInput(newText);
      // Trigger input field expansion for long transcriptions
      handleTextChange(newText);
      // No auto-focus after transcription - let user decide when to open keyboard
    },
    onTranscriptionError: (error) => {
      console.error('Transcription error:', error);
    },
  });

  // ✅ COACHING SCREEN PATTERN: scrollViewRef is now provided by useCoachingScroll hook
  const textInputRef = useRef<TextInput>(null);

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

  // Track session completion when user leaves the screen (only once)
  const sessionCompletedRef = useRef(false);
  const messagesRef = useRef(messages);
  const sessionStartRef = useRef(sessionStartTime);
  
  // Keep refs updated
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  
  useFocusEffect(
    useCallback(() => {
      // Reset completion flag when entering screen
      sessionCompletedRef.current = false;
      
      // Cleanup function that runs when leaving the screen
      return () => {
        const currentSessionId = getSessionId();
        if (currentSessionId && currentSessionId !== 'anonymous' && !sessionCompletedRef.current) {
          sessionCompletedRef.current = true; // Prevent multiple calls
          
          const sessionMinutes = Math.max(Math.floor((Date.now() - sessionStartRef.current.getTime()) / (1000 * 60)), 1);
          const messageCount = messagesRef.current.length;
          const totalWords = messagesRef.current.reduce((total, msg) => {
            if (msg.role === 'user') {
              return total + msg.content.split(/\s+/).filter((word: string) => word.length > 0).length;
            }
            return total;
          }, 0);

          // Log coaching session completion (only once)
          console.log('✅ [COACHING] Regular coaching session completed (user left screen)', {
            sessionId: currentSessionId,
            duration: sessionMinutes,
            messageCount: messageCount,
            wordsWritten: totalWords
          });

          // Session completion tracking removed for breakout sessions
        }
      };
    }, [firebaseUser?.uid])
  );

  // Session ID is derived from firebaseUser.uid - no useEffect needed

  // Track current user to detect user switches
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  // Load conversation history from local storage or show welcome message
  // ✅ BREAKOUT SESSION PATTERN: Initialization state is now handled above
  
  // ✅ COACHING SCREEN PATTERN: Debug logging for session state
  useEffect(() => {
    if (__DEV__) {
      console.log('🐛 [DEBUG] BreakoutSession state:', {
        sessionId,
        isBreakoutSession,
        totalMessageCount: messages.length,
        isInitialized: isInitialized,
        isLoading: isLoading
      });
    }
  }, [sessionId, isBreakoutSession, messages.length, isInitialized, isLoading]);
  
  // Handle user switching - clear cache when user changes
  useEffect(() => {
    const newUserId = firebaseUser?.uid || null;
    
    if (currentUserId && newUserId && currentUserId !== newUserId) {
      // User switched - clear previous user's cache and reset initialization
      console.log('👤 User switched detected:', currentUserId, '→', newUserId);
      clearCoachingCacheForUser(currentUserId);
      setIsInitialized(false); // Force re-initialization for new user
    } else if (currentUserId && !newUserId) {
      // User logged out - clear current user's cache
      console.log('🚪 User logged out, clearing cache for:', currentUserId);
      clearCoachingCacheForUser(currentUserId);
      setIsInitialized(false);
    }
    
    // Update cache service with new user
    coachingCacheService.setCurrentUser(newUserId);
    setCurrentUserId(newUserId);
  }, [firebaseUser?.uid, currentUserId, clearCoachingCacheForUser]);
  
  // ✅ BREAKOUT SESSION PATTERN: Initialize breakout session with isolated state
  useEffect(() => {
    if (!user?.id || isInitialized || initializationInProgress.current) return;
    
    const initializeBreakoutSession = async () => {
      // Prevent concurrent initialization
      if (initializationInProgress.current) {
        console.log('⚠️ [BREAKOUT INIT] Initialization already in progress, skipping');
        return;
      }
      
      initializationInProgress.current = true;
      
      // CRITICAL SECURITY: Validate session ID before initialization
      const validatedSessionId = getSessionId();
      if (validatedSessionId === 'anonymous') {
        console.error('🚨 [SECURITY] Cannot initialize - invalid session ID');
        setIsInitialized(true); // Set as initialized to prevent loops
        return;
      }
      
      console.log('🔄 [BREAKOUT INIT] Starting isolated breakout session initialization for:', validatedSessionId);
      
      try {
        // Load existing breakout session from Firestore
        const sessionResult = await loadMessagesFromFirestore(validatedSessionId);
        const sessionMessages = sessionResult.allMessages;
        
        if (sessionMessages.length > 0) {
          // Existing breakout session found
          console.log(`✅ [BREAKOUT INIT] Found existing breakout session with ${sessionMessages.length} messages`);
          setMessages(sessionMessages);
        } else {
          // No existing session - show initial message
          console.log('📝 [BREAKOUT INIT] No existing breakout session, creating initial message');
          const initialMessages = getInitialMessages();
          setMessages(initialMessages);
        }
        
        setIsInitialized(true);
        console.log('✅ [BREAKOUT INIT] Isolated breakout session initialization completed');
        
      } catch (error) {
        console.error('❌ [BREAKOUT INIT] Breakout session initialization failed:', error);
        
        // Fallback: show initial message
        const fallbackMessages = getInitialMessages();
        setMessages(fallbackMessages);
        setIsInitialized(true);
        console.log('🔄 [BREAKOUT INIT] Fallback initialization completed');
      } finally {
        initializationInProgress.current = false;
      }
    };
    
    initializeBreakoutSession();
  }, [user?.id, sessionId, isInitialized, getInitialMessages]);

  // ✅ BREAKOUT SESSION PATTERN: Isolated real-time listener for breakout sessions only
  const realTimeListenerActive = useRef(false);
  
  useEffect(() => {
    // Only use real-time listener when not actively messaging (isLoading = false)
    // This prevents conflicts with our isolated state management
    if (!user?.id || !isInitialized || isLoading || !sessionId) return;

    // Prevent multiple listeners
    if (realTimeListenerActive.current) return;
    
    // CRITICAL SECURITY: Validate session ID before setting up listener
    const validatedSessionId = getSessionId();
    if (validatedSessionId === 'anonymous') {
      console.error('🚨 [SECURITY] Cannot setup real-time listener - invalid session ID');
      return;
    }
    
    console.log('🔄 [REALTIME] Setting up isolated real-time listener for breakout session:', validatedSessionId);
    realTimeListenerActive.current = true;

    const unsubscribe = onSnapshot(
      doc(db, 'coachingSessions', validatedSessionId),
      (docSnap) => {
        // Skip updates if currently messaging to avoid conflicts
        if (isLoading) {
          console.log('🔄 [REALTIME] Skipping update - messaging in progress');
          return;
        }
        
        if (docSnap.exists()) {
          console.log('🔄 [REALTIME] Breakout session updated, refreshing isolated messages...');
          const sessionData = docSnap.data();
          const firestoreMessages = sessionData.messages || [];
          
          // Convert to our message format
          const convertedMessages: CoachingMessage[] = firestoreMessages.map((msg: any, index: number) => ({
            id: msg.id || `msg_${index}`,
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.content || '',
            timestamp: msg.timestamp ? new Date(msg.timestamp.seconds * 1000) : new Date()
          }));
          
          // Only update if message count changed (prevent unnecessary re-renders)
          if (convertedMessages.length !== messages.length) {
            setMessages(convertedMessages);
            console.log(`✅ [REALTIME] Updated isolated breakout session with ${convertedMessages.length} messages from real-time listener`);
          }
        } else {
          console.log('🔄 [REALTIME] No breakout session document found');
        }
      },
      (error) => {
        console.error('❌ [REALTIME] Error in isolated breakout session real-time listener:', error);
        realTimeListenerActive.current = false;
      }
    );

    return () => {
      console.log('🧹 [REALTIME] Cleaning up isolated breakout session real-time listener');
      realTimeListenerActive.current = false;
      unsubscribe();
    };
  }, [user?.id, sessionId, isInitialized, isLoading, messages.length]);

  

  // ✅ COACHING SCREEN PATTERN: Enhanced loading indicator logic
  const [aiResponseStarted, setAiResponseStarted] = useState(false);
  
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

  const shouldShowLoadingIndicator = useMemo(() => {
    return isLoading || (aiResponseStarted && messages.length > 0);
  }, [isLoading, aiResponseStarted, messages.length]);
  
  // ✅ COACHING SCREEN PATTERN: Use the coaching scroll hook
  const scrollHook = useCoachingScroll({
    messages,
    isLoading,
    shouldShowLoadingIndicator,
    progress
  });

  const {
    contentHeight,
    scrollViewHeight,
    showScrollToBottom,
    scrollViewRef,
    messageRefs,
    scrollToNewMessageRef,
    targetScrollPosition,
    hasUserScrolled,
    didInitialAutoScroll,
    dynamicContentHeight,
    dynamicBottomPadding,
    scrollLimits,
    setContentHeight,
    setScrollViewHeight,
    setShowScrollToBottom,
    scrollToShowLastMessage,
    handleScrollToBottom: hookHandleScrollToBottom,
    handleScroll: hookHandleScroll,
    debugLog
  } = scrollHook;

  // ✅ COACHING SCREEN PATTERN: Trigger positioning when new user message appears
  const lastMessageRef = useRef<string | null>(null);
  
  useEffect(() => {
    if (messages.length === 0) return;
    
    const lastMessage = messages[messages.length - 1];
    const isNewUserMessage = lastMessage.role === 'user' && lastMessage.id !== lastMessageRef.current;
    
    if (isNewUserMessage && scrollToNewMessageRef.current) {
      debugLog('🎯 New user message detected, triggering positioning:', lastMessage.content.substring(0, 30));
      lastMessageRef.current = lastMessage.id;
      scrollToShowLastMessage();
    }
  }, [messages, scrollToShowLastMessage, debugLog]);

  // ✅ COACHING SCREEN PATTERN: Enhanced loading indicator logic (already defined above)

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
           return count + msg.content.trim().split(/\s+/).filter((word: string) => word.length > 0).length;
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

  // Klavye yüksekliğini izle
  useEffect(() => {
    const keyboardWillShow = (event: any) => {
      setKeyboardHeight(event.endCoordinates.height);
    };

    const keyboardWillHide = () => {
      setKeyboardHeight(0);
    };

    const keyboardWillShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      keyboardWillShow
    );
    const keyboardWillHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      keyboardWillHide
    );

    return () => {
      keyboardWillShowListener.remove();
      keyboardWillHideListener.remove();
    };
  }, []);

  // Text change handlers for dynamic input
  const handleTextChange = (text: string) => {
    setChatInput(text);
    
    // More precise calculation - word-based line wrapping
    const containerWidth = 380; // chatInputWrapper width
    const containerPadding = 16; // 8px left + 8px right padding
    const textInputPadding = 8; // 4px left + 4px right padding
    
    // First estimate the line count
    const estimatedLines = Math.max(1, text.split('\n').length);
    const isMultiLine = estimatedLines > 1 || text.length > 30; // Earlier multi-line detection
    const expandButtonSpace = isMultiLine ? 36 : 0; // Space for expand button
    const availableWidth = containerWidth - containerPadding - textInputPadding - expandButtonSpace;
    
    // Font boyutuna göre karakter genişliği (fontSize: 15, fontWeight: 400)
    // Daha conservative hesaplama - kelimeler için fazladan margin
    const baseCharsPerLine = isMultiLine ? 36 : 42; // Multi-line'da daha az karakter
    const charsPerLine = baseCharsPerLine;
    
    // Satır hesaplama - kelime kırılması dahil
    const textLines = text.split('\n');
    let totalLines = 0;
    
    textLines.forEach(line => {
      if (line.length === 0) {
        totalLines += 1; // Boş satır
      } else {
        // Kelime bazlı hesaplama - uzun kelimelerin satır atlama riski için
        const words = line.split(' ');
        let currentLineLength = 0;
        let linesForThisTextLine = 1;
        
        words.forEach((word, index) => {
          const wordLength = word.length;
          const spaceNeeded = index > 0 ? 1 : 0; // Space before word (except first)
          
          // Eğer bu kelime mevcut satıra sığmayacaksa, yeni satır
          if (currentLineLength + spaceNeeded + wordLength > charsPerLine && currentLineLength > 0) {
            linesForThisTextLine++;
            currentLineLength = wordLength;
          } else {
            currentLineLength += spaceNeeded + wordLength;
          }
        });
        
        totalLines += linesForThisTextLine;
      }
    });
    
    // Satır sayısını kaydet
    setCurrentLineCount(totalLines);
    
    // Min/Max sınırları - expand durumuna göre
    const maxLines = isInputExpanded ? EXPANDED_MAX_LINES : MAX_LINES;
    const actualLines = Math.max(MIN_LINES, Math.min(maxLines, totalLines));
    
    // Yükseklik hesaplama
    const newInputHeight = actualLines * LINE_HEIGHT;
    
    // Container yüksekliği - gerçek layout'a göre optimize
    const topPadding = 12; // TextInput üst padding artırıldı
    const bottomPadding = 8;
    const buttonHeight = 32; // Voice/Send buton yüksekliği
    const buttonTopPadding = 8; // Button container padding top
    
    const totalContainerHeight = topPadding + newInputHeight + buttonTopPadding + buttonHeight + bottomPadding;
    const newContainerHeight = Math.max(CONTAINER_BASE_HEIGHT, totalContainerHeight);
    
    setInputHeight(newInputHeight);
    setContainerHeight(newContainerHeight);
  };

  const handleContentSizeChange = (event: any) => {
    const { height } = event.nativeEvent.contentSize;
    
    // Min/Max yükseklikleri hesapla
    const minHeight = MIN_LINES * LINE_HEIGHT; // 24px
    const maxHeight = MAX_LINES * LINE_HEIGHT; // 240px
    
    // Gerçek content yüksekliğini kullan ama LINE_HEIGHT'a yuvarla
    const rawHeight = Math.max(minHeight, Math.min(maxHeight, height));
    
    // En yakın LINE_HEIGHT katına yuvarla (24px'in katları)
    const roundedLines = Math.round(rawHeight / LINE_HEIGHT);
    const newInputHeight = Math.max(MIN_LINES, Math.min(MAX_LINES, roundedLines)) * LINE_HEIGHT;
    
    // Container yüksekliği - handleTextChange ile aynı hesaplama
    const topPadding = 12; // TextInput üst padding artırıldı
    const bottomPadding = 8;
    const buttonHeight = 32; // Voice/Send buton yüksekliği
    const buttonTopPadding = 8; // Button container padding top
    
    const totalContainerHeight = topPadding + newInputHeight + buttonTopPadding + buttonHeight + bottomPadding;
    const newContainerHeight = Math.max(CONTAINER_BASE_HEIGHT, totalContainerHeight);
    
    setInputHeight(newInputHeight);
    setContainerHeight(newContainerHeight);
  };

  // Ensure last lines remain visible when input grows to a new line - DISABLED to prevent auto-scroll
  useEffect(() => {
    // Disabled: This was causing unwanted auto-scroll when typing
    // Only scroll if user explicitly wants it, not automatically on input height change
    return;
  }, [inputHeight, containerHeight]);

  // Expand toggle function
  const handleExpandToggle = () => {
    setIsInputExpanded(!isInputExpanded);
    
    // Mevcut text'e göre yeniden hesapla
    setTimeout(() => {
      handleTextChange(chatInput);
    }, 0);
  };

  // 8. Set flag correctly in handleSendMessage:
  const handleSendMessage = async () => {
    if (chatInput.trim().length === 0) return;

    // Use breakout sessionId with security validation
    const currentSessionId = getSessionId();
    
    // 🔍 DEBUG: Log all session ID related values
    console.log('🔍 [DEBUG] Session ID Analysis:', {
      routeSessionId: sessionId,
      currentSessionId: currentSessionId,
      userId: user?.id,
      firebaseUid: firebaseUser?.uid,
      getSessionIdResult: getSessionId()
    });
    
    // CRITICAL SECURITY: Prevent sending messages if session ID is invalid
    if (currentSessionId === 'anonymous') {
      console.error('🚨 [SECURITY] Cannot send message - invalid session ID');
      return;
    }
    
    // Log breakout coaching session
    console.log('🎯 [COACHING] Breakout coaching session...', {
      sessionId: currentSessionId,
      userId: firebaseUser?.uid,
      sessionType: 'breakout-session',
      trigger: 'manual'
    });
    
    // Session start tracking removed for breakout sessions

    const messageContent = chatInput.trim();
    setChatInput('');
    
    // Close keyboard and blur input
    textInputRef.current?.blur();
    Keyboard.dismiss();
    setIsChatInputFocused(false);
    
    // Input yüksekliğini ve expand durumunu sıfırla
    setInputHeight(LINE_HEIGHT);
    setContainerHeight(CONTAINER_BASE_HEIGHT);
    setIsInputExpanded(false);
    setCurrentLineCount(1);
    
    // Set positioning flag
    hasUserScrolled.current = false;
    scrollToNewMessageRef.current = true; // This flag will trigger positioning

    debugLog('📤 Sending message, positioning will be triggered');

    // ✅ WEB PATTERN: No local state - let API handle everything and Firestore sync
    try {
      // 🔍 DEBUG: Log API call details
      console.log('🔍 [DEBUG] API Call Details:', {
        messageContent: messageContent.substring(0, 50) + '...',
        sessionIdBeingUsed: currentSessionId,
        sessionType: 'default-session',
        apiUrl: `${process.env.EXPO_PUBLIC_API_URL}api/coaching/chat`
      });

    await sendMessage(messageContent, currentSessionId, {
        sessionType: 'default-session'
    });
      
      console.log('✅ Message sent successfully - Firestore will sync automatically');
    } catch (error) {
      console.error('❌ Error sending message:', error);
    }
  };

  const handleStopGeneration = () => {
    console.log('🛑 Stopping AI response generation');
    if (stopGeneration) {
      stopGeneration();
    }
    // Focus back to input after stopping
    setTimeout(() => {
      textInputRef.current?.focus();
    }, 100);
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

  const handleVoiceModePress = () => {
    // Navigate to voice mode screen
    (navigation as any).navigate('VoiceMode', { 
      sessionId: getSessionId()
    });
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

  // ✅ COACHING SCREEN PATTERN: handleScrollToBottom is now provided by useCoachingScroll hook

  // ✅ COACHING SCREEN PATTERN: Initial auto-scroll and handleScroll are now provided by useCoachingScroll hook

  const handleCompletionAction = async () => {
    console.log('User clicked End this session');
    console.log('📊 Session Stats:', completionStats);
    console.log('🎯 Parsed Coaching Data:', parsedCoachingData);
    
    if (parsedCoachingData) {
      parsedCoachingData.components.forEach((component, index) => {
        console.log(`  ${index + 1}. ${component.type.toUpperCase()}:`, component.props);
      });
    }
    
    // Create goal breakout session and link to journal entry
    const currentSessionId = getSessionId();
    if (currentSessionId && currentSessionId !== 'anonymous' && firebaseUser) {
      try {
        console.log('🎯 Creating goal breakout session for completed coaching session:', currentSessionId);
        await createGoalBreakoutSession(currentSessionId);
      } catch (error) {
        console.error('❌ Failed to create goal breakout session:', error);
      }
    }
    
    // Navigate to compass story for coaching completion immediately
    (navigation as any).navigate('CompassStory', { 
      fromCoaching: true,
      sessionId: currentSessionId,
      parsedCoachingData: parsedCoachingData || undefined
    });
    setShowCompletionForMessage(null);
    
    // Trigger insight extraction in background if we have a session ID
    if (currentSessionId && currentSessionId !== 'anonymous') {
      console.log('🧠 Starting insight extraction for session:', currentSessionId);
      triggerInsightExtraction(currentSessionId); // Don't await - run in background
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

  // Function to create goal breakout session and link to journal entry
  const createGoalBreakoutSession = async (completedSessionId: string) => {
    try {
      const token = await getToken();
      if (!token) {
        console.error('❌ No auth token available for goal breakout session creation');
        return;
      }

      // Generate new session ID for the goal breakout session
      const goalBreakoutSessionId = Crypto.randomUUID();
      
      console.log('🎯 Creating goal breakout session...', {
        completedSessionId,
        goalBreakoutSessionId,
        userId: firebaseUser?.uid
      });

      // Create the goal breakout session via API
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}api/coaching/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          sessionId: goalBreakoutSessionId,
          sessionType: 'default-session',
          parentSessionId: completedSessionId, // Link to the completed coaching session
          messages: [
            {
              id: Crypto.randomUUID(),
              role: 'assistant',
              content: 'Based on our coaching session, I\'ve created a personalized goal breakout plan for you. Let\'s dive deeper into your action steps and create a concrete plan to move forward.',
              timestamp: new Date().toISOString()
            }
          ],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create goal breakout session: ${response.status}`);
      }

      const sessionResult = await response.json();
      console.log('✅ Goal breakout session created:', sessionResult);

      // Create a new journal entry linked to this goal breakout session
      const entryId = Crypto.randomUUID();
      const newEntry = {
        uid: firebaseUser!.uid,
        content: '', // Empty content - user will fill this in
        timestamp: serverTimestamp(),
        lastUpdated: serverTimestamp(),
        linkedCoachingSessionId: goalBreakoutSessionId, // Link to the goal breakout session
        title: `Goal Breakout - ${new Date().toLocaleDateString()}`
      };

      const docRef = doc(db, 'journal_entries', entryId);
      await setDoc(docRef, newEntry);

      console.log('✅ Journal entry created and linked to goal breakout session:', {
        entryId,
        linkedSessionId: goalBreakoutSessionId
      });

      // Track goal breakout session creation
      trackEntryCreated({
        entry_id: entryId,
      });

    } catch (error) {
      console.error('❌ Error creating goal breakout session:', error);
      throw error;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* Header with back button and session info */}
        <View style={[styles.chatHeader, { backgroundColor: colors.background, paddingTop: insets.top + 25, borderColor: `${colors.tint}12` }]}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            style={styles.backButton}
          >
            <ArrowLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={[styles.chatHeaderText, { color: colors.text }]} numberOfLines={1}>
              {title || 'Breakout Session'}
            </Text>
            {goal && (
              <Text style={[styles.headerSubtitle, { color: colors.icon }]} numberOfLines={1}>
                {goal}
              </Text>
            )}
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
              // Call coaching scroll hook's handleScroll function
              hookHandleScroll(event);
              
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
            keyboardShouldPersistTaps="always"
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
            {/* Simple loading spinner */}
            {isLoadingMore && (
              <View style={{
                alignItems: 'center',
                paddingVertical: 16,
              }}>
                <ModernSpinner colorScheme={colorScheme} size={20} />
              </View>
            )}

            {getMessagesWithSeparators(messages).map((item) => {
              // Render date separator
              if ('type' in item && item.type === 'separator') {
                return (
                  <DateSeparator 
                    key={item.id} 
                    date={item.date} 
                    colorScheme={colorScheme} 
                  />
                );
              }
              
              // Render message
              const message = item as CoachingMessage;
              return (
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
                                  <View style={message.role === 'user' ? [
                                    styles.userMessageBubble,
                                    {
                                      backgroundColor: colorScheme === 'dark' 
                                        ? 'rgba(255, 255, 255, 0.12)' 
                                        : 'rgba(0, 0, 0, 0.06)',
                                      borderWidth: colorScheme === 'dark' ? 0.5 : 0,
                                      borderColor: colorScheme === 'dark' 
                                        ? 'rgba(255, 255, 255, 0.15)' 
                                        : 'transparent'
                                    }
                                  ] : undefined}>
                    {/* Collapsible message content */}
                    <TouchableOpacity
                      activeOpacity={isLongMessage(message.content, message.role) ? 0.7 : 1}
                      onPress={() => {
                        if (isLongMessage(message.content, message.role)) {
                          toggleMessageExpansion(message.id);
                        }
                      }}
                    >
                      <Text
                        style={[
                          styles.messageText,
                          message.role === 'user'
                            ? [
                                styles.userMessageText, 
                                { 
                                  color: colorScheme === 'dark' 
                                    ? 'rgba(255, 255, 255, 0.85)' 
                                    : 'rgba(0, 0, 0, 0.75)' 
                                }
                              ]
                            : { color: colors.text }
                        ]}
                      >
                        {isLongMessage(message.content, message.role) && !expandedMessages.has(message.id)
                          ? getTruncatedContent(message.content)
                          : getDisplayContent(message.content)
                        }
                      </Text>
                      
                      {/* Show expand/collapse indicator for long messages */}
                      {isLongMessage(message.content, message.role) && (
                        <Text
                          style={[
                            styles.expandIndicator,
                            {
                              color: message.role === 'user' 
                                ? (colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)')
                                : `${colors.text}80`
                            }
                          ]}
                        >
                          {expandedMessages.has(message.id) ? 'Show less' : 'Show more'}
                        </Text>
                      )}
                    </TouchableOpacity>

                   {/* Render coaching cards for AI messages */}
                   <CoachingCardRenderer 
                     message={message} 
                     rendererProps={coachingCardRendererProps} 
                   />

                   {/* Show error message for failed AI responses */}
                   {message.role === 'assistant' && message.isError && (
                     <ErrorMessage
                       onRetry={() => handleRetryMessage(message.id)}
                       colorScheme={colorScheme}
                       isRetrying={retryingMessageId === message.id}
                     />
                   )}

                   {/* Legacy coaching cards rendering - remove after CoachingCardRenderer is fully integrated */}
                   {message.role === 'assistant' && (() => {
                     const coachingCards = parseCoachingCards(message.content);
                     if (coachingCards.length > 0) {
                       return (
                         <View style={{ marginTop: 8, marginBottom: 16 }}>
                           {coachingCards.map((card, index) => renderCoachingCard(card.type, card.props, index, message.id))}
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
              );
            })}
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
                  bottom: keyboardHeight > 0 
                    ? containerHeight + 50  // When keyboard open: position above input container
                    : containerHeight + 80, // When keyboard closed: position above input with margin
                }
              ]}
              onPress={() => hookHandleScrollToBottom(true)}
            >
              <ArrowDown size={20} color={colors.text} />
            </TouchableOpacity>
          )}
        </View>

        {/* Suggestion Buttons - Temporarily hidden */}
        {/* TODO: Re-enable suggestions later if needed */}

        {/* Input */}
        <View style={[styles.chatInputContainer, { 
          bottom: keyboardHeight > 0 ? keyboardHeight - 10 : 20, // If keyboard open: slightly overlapping, otherwise 20px above navbar
          paddingBottom: Math.max(insets.bottom, 0)
        }]} pointerEvents="box-none">
          <View
            pointerEvents="auto"
            style={[
            styles.chatInputWrapper,
            {
                backgroundColor: colorScheme === 'dark' ? '#2A2A2A' : '#FFFFFF',
                borderColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : '#00000012',
                height: containerHeight, // Dinamik yükseklik
                // Enhanced shadow for both light and dark modes - all directions
                shadowColor: colorScheme === 'dark' ? '#FFFFFF' : '#000000',
                shadowOffset: {
                  width: 0,
                  height: 0, // Centered shadow for all directions
                },
                shadowOpacity: colorScheme === 'dark' ? 0.2 : 0.3,
                shadowRadius: colorScheme === 'dark' ? 12 : 15,
                elevation: colorScheme === 'dark' ? 12 : 15,
              }
            ]}
          >
            {/* Expand Button - sadece 1 satırdan fazlayken görünür */}
            {currentLineCount > 1 && (
              <TouchableOpacity
                style={[styles.expandButton, {
                  backgroundColor: colorScheme === 'dark' ? '#404040' : '#F0F0F0',
                }]}
                onPress={handleExpandToggle}
              >
                <IconSymbol
                  name={isInputExpanded ? "arrow.down.right.and.arrow.up.left" : "arrow.up.left.and.arrow.down.right"}
                  size={14}
                  color={colorScheme === 'dark' ? '#FFFFFF' : '#666666'}
                />
              </TouchableOpacity>
            )}
            
            {!isRecording && !isTranscribing ? (
              /* Main Input Container - vertical layout */
              <View style={styles.mainInputContainer}>
                {/* TextInput at the top */}
              <TextInput
                ref={textInputRef}
                style={[
                  styles.chatInput,
                    { 
                      color: colors.text,
                      height: inputHeight, // Dinamik yükseklik
                      width: currentLineCount > 1 ? '92%' : '100%', // Expand butonu için alan bırak (~28px az)
                      paddingRight: currentLineCount > 1 ? 32 : 4, // Expand butonu için sağ padding
                    }
                ]}
                value={chatInput}
                  onChangeText={handleTextChange} // Ana controller
                  onContentSizeChange={undefined} // Devre dışı - sadece handleTextChange kullan
                onFocus={() => setIsChatInputFocused(true)}
                onBlur={() => setIsChatInputFocused(false)}
                  placeholder="Write how you think..."
                  placeholderTextColor={colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.50)'}
                multiline
                maxLength={15000} // ~2000 words limit
                returnKeyType='default'
                onSubmitEditing={handleSendMessage}
                cursorColor={colors.tint}
                  scrollEnabled={inputHeight >= (isInputExpanded ? EXPANDED_MAX_LINES : MAX_LINES) * LINE_HEIGHT} // Maksimum yükseklikte scroll aktif
                  textBreakStrategy="balanced" // Kelime kırma stratejisi
                />
                
                {/* ✅ COACHING SCREEN PATTERN: Button Container at the bottom - Separate Mic and Send buttons */}
                <View style={styles.buttonContainer}>
                  {/* Microphone Button - Always visible for transcription */}
                  <TouchableOpacity
                    style={[styles.microphoneButtonRound, { 
                      backgroundColor: colorScheme === 'dark' ? '#404040' : '#E6E6E6' 
                    }]}
                    onPress={handleMicrophonePress}
                  >
                    <Mic
                      size={18}
                      color={colorScheme === 'dark' ? '#AAAAAA' : '#737373'}
                      strokeWidth={1.5}
                    />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.sendButtonRound, { 
                      backgroundColor: isLoading 
                        ? (colorScheme === 'dark' ? '#404040' : '#E6E6E6') 
                        : (colorScheme === 'dark' ? '#FFFFFF' : '#000000'),
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.2,
                      shadowRadius: 4,
                      elevation: 3,
                      opacity: chatInput.trim().length > 0 || isLoading ? 1 : 0.5,
                    }]}
                    onPress={isLoading ? handleStopGeneration : handleSendMessage}
                    disabled={chatInput.trim().length === 0 && !isLoading}
                  >
                    {isLoading ? (
                      <Square
                        size={14}
                        color={colorScheme === 'dark' ? '#000000' : '#FFFFFF'}
                        fill={colorScheme === 'dark' ? '#000000' : '#FFFFFF'}
                        strokeWidth={0}
                      />
                    ) : (
                      <ArrowUp
                        size={18}
                        color={colorScheme === 'dark' ? '#000000' : '#FFFFFF'}
                        strokeWidth={1.5}
                      />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ) : isTranscribing ? (
              <View style={styles.transcribingContainer}>
                <SpinningAnimation colorScheme={colorScheme} />
              </View>
            ) : (
              /* Recording state */
              <View style={styles.recordingStateContainer}>
                    <TouchableOpacity
                  style={[styles.recordingButton, { backgroundColor: `${colors.text}20` }]}
                  onPress={handleRecordingCancel}
                    >
                  <X size={20} color={colors.text} />
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
                    <Check size={20} color={colors.background} />
                    </TouchableOpacity>
                  </View>
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
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
    borderBottomWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    zIndex: 10,
  },
  chatHeaderText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'left',
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
  userMessageBubble: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderTopRightRadius: 4,
    maxWidth: '85%',
    alignSelf: 'flex-end',
  },
  messageText: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 22,
  },
  userMessageText: {
    textAlign: 'left',
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 4,
    minHeight: 32, // Fixed minimum height
  },
  
  // For message container in loading state
  loadingMessageContainer: {
    minHeight: 60, // Fixed space for loading indicator
    justifyContent: 'center',
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chatInputContainer: {
    paddingHorizontal: 20,
    paddingBottom: 0,
    paddingTop: 0,
    position: 'absolute',
    bottom: 0, // Navbar'dan 40px yukarıda
    left: 0,
    right: 0,
    justifyContent: 'flex-end', // İçeriği alt kısma hizala (yukarı genişleme için)
    zIndex: 1000, // Base z-index
  },
  chatInputWrapper: {
    alignSelf: 'center',
    width: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderTopWidth: 0.5,
    borderRightWidth: 0.5,
    borderBottomWidth: 0,
    borderLeftWidth: 0.5,
    borderColor: '#00000012',
    padding: 8,
    gap: 10,
    flexDirection: 'row',
    alignItems: 'flex-end', // Butonları alt kısma hizala
    justifyContent: 'flex-start',
    overflow: 'visible',
    opacity: 1,
    // Shadow properties are now set dynamically based on theme
  },
  mainInputContainer: {
    flex: 1,
    paddingHorizontal: 8,
    paddingTop: 12, // Üst padding artırıldı
    paddingBottom: 8,
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'stretch',
    width: '100%',
  },
  chatInput: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 24,
    minHeight: 24, // Minimum yükseklik
    paddingVertical: 0,
    paddingHorizontal: 4,
    backgroundColor: 'transparent',
    textAlignVertical: 'top',
  },
  buttonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    paddingTop: 8,
  },
  voiceButton: {
    height: 32,
    paddingHorizontal: 8,
    borderRadius: 100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  voiceButtonText: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 16,
  },
  microphoneButtonRound: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonRound: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  transcribingContainer: {
    alignItems: 'flex-start',
    paddingVertical: 8,
  },
  recordingStateContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 8,
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 24,
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
    right: 20,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0, // Border kaldır, sadece ok
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    zIndex: 999, // Input'tan düşük z-index
  },
  // Suggestion styles moved to components/old/PromptSuggestions.tsx
  expandButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    zIndex: 10,
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  headerContent: {
    flex: 1,
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    marginTop: 2,
  },
  errorContainer: {
    alignItems: 'flex-start',
    marginTop: 6,
  },
  retryButton: {
    borderRadius: 18,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
  },
  expandIndicator: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 6,
    textAlign: 'left',
  },
}); 