import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { StyleSheet, Text, TextInput, View, useColorScheme, TouchableOpacity, ScrollView, SafeAreaView, KeyboardAvoidingView, Platform, Keyboard, ColorSchemeName, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Mic, X, Check, ArrowUp, ArrowDown, Square } from 'lucide-react-native';
import * as Crypto from 'expo-crypto';
import { Colors } from '@/constants/Colors';
import { AppStackParamList } from '@/navigation/AppNavigator';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Button } from '@/components/ui/Button';
import { useAICoaching, CoachingMessage } from '@/hooks/useAICoaching';
import { useAuth } from '@/hooks/useAuth';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useAudioTranscription } from '@/hooks/useAudioTranscription';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { ActionPlanCard, BlockersCard, CommitmentCard, CommitmentCheckinCard, FocusCard, InsightCard, MeditationCard, SessionSuggestionCard, ScheduledSessionCard, SessionCard } from '@/components/cards';
import { useRevenueCat } from '@/hooks/useRevenueCat';
import { Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { coachingCacheService } from '@/services/coachingCacheService';

type CoachingScreenNavigationProp = NativeStackNavigationProp<AppStackParamList, 'SwipeableScreens'>;

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
  const { 
    trackCoachingSessionStarted, 
    trackCoachingSessionCompleted,
    trackEntryCreated
  } = useAnalytics();
  const { isPro, presentPaywallIfNeeded, currentOffering, initialized } = useRevenueCat(firebaseUser?.uid);

  // Get route parameters for existing session
  const routeSessionId = (route.params as any)?.sessionId;
  const routeSessionType = (route.params as any)?.sessionType;

  // Use userId as session ID (single session per user) - no state needed
  const getSessionId = (): string => {
    const sessionId = firebaseUser?.uid || 'anonymous';
    console.log('🔑 [SESSION ID] Current session ID:', sessionId);
    return sessionId;
  };

  // Debug mode flag - set to false for production
  const DEBUG_LOGS = __DEV__ && false; // Disabled for production
  const debugLog = (message: string, ...args: any[]) => {
    if (DEBUG_LOGS) {
      console.log(message, ...args);
    }
  };

  // Cache management using secure coaching cache service
  const saveMessagesToStorage = useCallback(async (messages: CoachingMessage[], userId: string) => {
    try {
      await coachingCacheService.saveMessages(messages, userId);
      debugLog(`💾 Saved ${messages.length} messages to secure cache for user:`, userId);
    } catch (error) {
      console.error('Error saving messages to secure cache:', error);
    }
  }, []);

  const loadExistingSessionFromBackend = useCallback(async (userId: string): Promise<{ messages: CoachingMessage[]; sessionExists: boolean }> => {
    try {
      debugLog('🔍 Loading existing session from backend for user:', userId);
      
      // ALWAYS check backend first - never create session from cache
      const sessionResult = await coachingCacheService.initializeSession(userId);
      
      debugLog(`📱 Session result:`, {
        exists: sessionResult.sessionExists,
        messageCount: sessionResult.messages.length
      });
      
      return sessionResult;
    } catch (error) {
      console.error('Error loading session from backend:', error);
      return { messages: [], sessionExists: false };
    }
  }, []);

  // Debug function to clear storage (for testing)
  const clearStorageForUser = useCallback(async (userId: string) => {
    try {
      await coachingCacheService.clearUserMessages(userId);
      console.log('🗑️ Cleared secure cache for user:', userId);
    } catch (error) {
      console.error('Error clearing secure cache:', error);
    }
  }, []);

  // Test function to clear all coaching data (will be defined after setMessages)
  let clearAllCoachingData: (() => Promise<void>) | null = null;

  // Manual refresh from backend (will be defined after setMessages is available)
  let refreshFromBackend: (() => Promise<void>) | null = null;

  // Clear coaching cache for specific user with full state reset
  const clearCoachingCacheForUser = useCallback(async (userId: string) => {
    try {
      console.log('🧹 Clearing coaching cache and state for user:', userId);
      
      // Clear secure cache for this user
      await coachingCacheService.clearUserMessages(userId);
      
      // Reset all coaching-related states
      setMessages([]);
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

  // Firestore direct access for coaching sessions
  const loadMessagesFromFirestore = useCallback(async (userId: string): Promise<{ allMessages: CoachingMessage[]; totalCount: number }> => {
    try {
      console.log('🔥 Loading messages from Firestore for user:', userId);
      
      // Import Firestore dynamically to avoid SSR issues
      const { db } = await import('../lib/firebase');
      const { collection, query, where, orderBy, limit, getDocs } = await import('firebase/firestore');
      
      // Query for the user's default coaching session
      const sessionsRef = collection(db, 'coachingSessions');
      const sessionQuery = query(
        sessionsRef,
        where('userId', '==', userId),
        where('sessionType', '==', 'default-session'),
        orderBy('createdAt', 'desc'),
        limit(1)
      );
      
      const sessionSnapshot = await getDocs(sessionQuery);
      
      if (!sessionSnapshot.empty) {
        const sessionDoc = sessionSnapshot.docs[0];
        const sessionData = sessionDoc.data();
        const messages = sessionData.messages || [];
        
        console.log(`🔥 Found coaching session with ${messages.length} messages`);
        
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
        console.log('🔥 No coaching session found for user');
        return { allMessages: [], totalCount: 0 };
      }
    } catch (error) {
      console.log('🔥 Firestore loading failed:', error);
      return { allMessages: [], totalCount: 0 };
    }
  }, []);

  // Prevent concurrent Firestore saves
  const firestoreSaveInProgress = useRef(new Set<string>());
  
  const saveMessagesToFirestore = useCallback(async (messages: CoachingMessage[], userId: string) => {
    // Prevent concurrent saves for the same user
    if (firestoreSaveInProgress.current.has(userId)) {
      console.log('⚠️ [FIRESTORE] Save already in progress for user, skipping:', userId);
      return;
    }
    
    firestoreSaveInProgress.current.add(userId);
    
    try {
      console.log('🔥 [FIRESTORE] Starting Firestore save for user:', userId);
      console.log('🔥 [FIRESTORE] Messages to save:', messages.length);
      
      // Import Firestore dynamically
      const { db } = await import('../lib/firebase');
      const { collection, query, where, getDocs, doc, updateDoc, setDoc, serverTimestamp } = await import('firebase/firestore');
      
      // Find existing coaching session
      const sessionsRef = collection(db, 'coachingSessions');
      const sessionQuery = query(
        sessionsRef,
        where('userId', '==', userId),
        where('sessionType', '==', 'default-session')
      );
      
      console.log('🔍 [FIRESTORE] Searching for existing session...');
      const sessionSnapshot = await getDocs(sessionQuery);
      
      console.log('🔍 [FIRESTORE] Query result:', {
        isEmpty: sessionSnapshot.empty,
        docCount: sessionSnapshot.docs.length,
        userId: userId
      });
      
      // Convert messages to Firestore format (save all messages to backend)
      const firestoreMessages = messages.map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp
      }));
      
      if (!sessionSnapshot.empty) {
        // Update existing session - NEVER CREATE NEW
        const sessionDoc = sessionSnapshot.docs[0];
        const existingData = sessionDoc.data();
        
        console.log('🔍 [FIRESTORE] Found existing session:', {
          sessionId: sessionDoc.id,
          existingMessageCount: existingData.messages?.length || 0,
          newMessageCount: firestoreMessages.length,
          sessionType: existingData.sessionType
        });
        
        await updateDoc(sessionDoc.ref, {
          messages: firestoreMessages,
          updatedAt: serverTimestamp()
        });
        console.log('✅ [FIRESTORE] Updated existing coaching session:', sessionDoc.id);
      } else {
        // This should rarely happen - only for completely new users
        console.log('📝 [FIRESTORE] No existing session found, creating new one...');
        const newSessionRef = doc(collection(db, 'coachingSessions'));
        await setDoc(newSessionRef, {
          userId: userId,
          sessionType: 'default-session',
          messages: firestoreMessages,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        console.log('✅ [FIRESTORE] Created new coaching session:', newSessionRef.id);
      }
      
      console.log(`✅ [FIRESTORE] Successfully saved ${firestoreMessages.length} messages to Firestore`);
    } catch (error) {
      console.error('❌ [FIRESTORE] Firestore save failed:', error);
      console.error('❌ [FIRESTORE] Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        userId: userId,
        messageCount: messages.length
      });
    } finally {
      // Always remove from in-progress set
      firestoreSaveInProgress.current.delete(userId);
      console.log('🔄 [FIRESTORE] Save completed for user:', userId);
    }
  }, []);

  // Multi-device sync strategy using Firestore
  // Load existing coaching session (backend first - never create from cache)
  const initializeCoachingSession = useCallback(async (userId: string): Promise<CoachingMessage[]> => {
    console.log('🔄 Initializing coaching session for user:', userId);
    
    try {
      // 1. Load existing session from backend (never from cache)
      console.log('🔄 Step 1: Loading existing session from backend...');
      const sessionResult = await loadExistingSessionFromBackend(userId);
      
      if (sessionResult.sessionExists) {
        console.log(`✅ Found existing session with ${sessionResult.messages.length} messages`);
        
        // Set up pagination for existing session
        setAllMessages(sessionResult.messages);
        setHasMoreMessages(sessionResult.messages.length > 300);
        setDisplayedMessageCount(Math.min(300, sessionResult.messages.length));
        
        // Return last 30 messages for display
        const displayMessages = sessionResult.messages.slice(-30);
        console.log(`✅ Session loaded with ${displayMessages.length} display messages`);
        return displayMessages;
      } else {
        console.log('📝 No existing session found - ready to create new session on first message');
        
        // No session exists - reset everything
        setAllMessages([]);
        setHasMoreMessages(false);
        setDisplayedMessageCount(0);
        
        return [];
      }
    } catch (error) {
      console.error('❌ Session initialization failed:', error);
      
      // Reset on error
      setAllMessages([]);
      setHasMoreMessages(false);
      setDisplayedMessageCount(0);
      
      return [];
    }
  }, [loadExistingSessionFromBackend]);

  // Use the AI coaching hook
  const coachingHook = useAICoaching();
  const { messages, isLoading, sendMessage, setMessages, progress, stopGeneration } = coachingHook;
  
  // Test function to clear all coaching data
  clearAllCoachingData = useCallback(async () => {
    if (!firebaseUser?.uid) return;
    
    try {
      console.log('🧹 Clearing all coaching data...');
      
      // Clear secure cache
      await coachingCacheService.clearUserMessages(firebaseUser.uid);
      
      // Clear Firestore coaching session
      const { db } = await import('../lib/firebase');
      const { collection, query, where, getDocs, deleteDoc } = await import('firebase/firestore');
      
      const sessionsRef = collection(db, 'coachingSessions');
      const sessionQuery = query(
        sessionsRef,
        where('userId', '==', firebaseUser.uid),
        where('sessionType', '==', 'default-session')
      );
      
      const sessionSnapshot = await getDocs(sessionQuery);
      
      for (const doc of sessionSnapshot.docs) {
        await deleteDoc(doc.ref);
        console.log('🗑️ Deleted Firestore session:', doc.id);
      }
      
      // Reset messages to welcome message
      const initialMessage: CoachingMessage = {
        id: '1',
        content: `Hello ${user?.firstName || 'there'}!\n\nI'm here to support your growth and reflection. What's on your mind today? Feel free to share anything that's weighing on you, exciting you, or simply present in your awareness right now.`,
        role: 'assistant',
        timestamp: new Date()
      };
      setMessages([initialMessage]);
      
      console.log('✅ All coaching data cleared successfully');
    } catch (error) {
      console.error('❌ Error clearing coaching data:', error);
    }
  }, [firebaseUser, user?.firstName, setMessages]);

  // Manual refresh from backend
  refreshFromBackend = useCallback(async () => {
    if (!firebaseUser?.uid) {
      console.warn('⚠️ Cannot refresh from backend: no user');
      return;
    }

    try {
      console.log('🔄 Manual refresh from backend requested for user:', firebaseUser.uid);
      
      // Re-initialize session from backend
      const sessionMessages = await initializeCoachingSession(firebaseUser.uid);
      
      if (sessionMessages.length > 0) {
        setMessages(sessionMessages);
        console.log(`✅ Refreshed with ${sessionMessages.length} messages from backend`);
      } else {
        console.log('📝 No session found in backend');
        // Show welcome message if no session exists
        const welcomeMessage: CoachingMessage = {
          id: '1',
          content: `Hello ${user?.firstName || 'there'}!\n\nI'm here to support your growth and reflection. What's on your mind today? Feel free to share anything that's weighing on you, exciting you, or simply present in your awareness right now.`,
          role: 'assistant',
          timestamp: new Date()
        };
        setMessages([welcomeMessage]);
      }
    } catch (error) {
      console.error('❌ Error refreshing from backend:', error);
    }
  }, [firebaseUser?.uid, setMessages, initializeCoachingSession, user?.firstName]);

  // Expose functions globally for testing (remove in production)
  if (__DEV__) {
    (global as any).clearCoachingData = clearAllCoachingData;
    (global as any).refreshCoachingFromBackend = refreshFromBackend;
    (global as any).coachingCacheService = coachingCacheService;
    
    // Debug function to check session persistence
    (global as any).debugSessionPersistence = async () => {
      if (!firebaseUser?.uid) {
        console.log('❌ No user logged in');
        return;
      }
      
      console.log('🔍 [DEBUG] Session Persistence Check:');
      console.log('🔍 [DEBUG] Current user ID:', firebaseUser.uid);
      console.log('🔍 [DEBUG] Current messages count:', messages.length);
      
      // Check cache
      const cachedMessages = await coachingCacheService.loadMessages(firebaseUser.uid);
      console.log('🔍 [DEBUG] Cached messages count:', cachedMessages.length);
      
      // Check backend
      const backendMessages = await coachingCacheService.syncWithBackend(firebaseUser.uid);
      console.log('🔍 [DEBUG] Backend messages count:', backendMessages.length);
      
      // Check cache stats
      const cacheStats = await coachingCacheService.getCacheStats();
      console.log('🔍 [DEBUG] Cache stats:', cacheStats);
      
      return {
        userId: firebaseUser.uid,
        currentMessages: messages.length,
        cachedMessages: cachedMessages.length,
        backendMessages: backendMessages.length,
        cacheStats
      };
    };
    
    // Debug function to check all Firestore sessions for user
    (global as any).debugFirestoreSessions = async () => {
      if (!firebaseUser?.uid) {
        console.log('❌ No user logged in');
        return;
      }
      
      try {
        console.log('🔍 [DEBUG] Checking all Firestore sessions for user:', firebaseUser.uid);
        
        const { db } = await import('../lib/firebase');
        const { collection, query, where, orderBy, getDocs } = await import('firebase/firestore');
        
        // Get ALL sessions for this user
        const sessionsRef = collection(db, 'coachingSessions');
        const allSessionsQuery = query(
          sessionsRef,
          where('userId', '==', firebaseUser.uid),
          orderBy('updatedAt', 'desc')
        );
        
        const allSessionsSnapshot = await getDocs(allSessionsQuery);
        
        console.log('🔍 [DEBUG] Total sessions found:', allSessionsSnapshot.docs.length);
        
        const sessions = allSessionsSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            sessionType: data.sessionType,
            messageCount: data.messages?.length || 0,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            ...data
          };
        });
        
        sessions.forEach((session, index) => {
          console.log(`🔍 [DEBUG] Session ${index + 1}:`, {
            id: session.id,
            sessionType: session.sessionType,
            messageCount: session.messageCount,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt
          });
        });
        
        return sessions;
      } catch (error) {
        console.error('❌ [DEBUG] Error checking Firestore sessions:', error);
        return [];
      }
    };
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

  // Track AI response state more reliably
  const [aiResponseStarted, setAiResponseStarted] = useState(false);

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
      
      setMessages(messagesToShow);
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
  }, [isLoadingMore, hasMoreMessages, displayedMessageCount, allMessages, MESSAGES_PER_PAGE, setMessages]);

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
  
  // Dynamic input constants
  const LINE_HEIGHT = 24;
  const MIN_LINES = 1;
  const MAX_LINES = 10;
  const EXPANDED_MAX_LINES = 40; // Maximum lines when expanded
  const INPUT_PADDING_VERTICAL = 8;
  const CONTAINER_BASE_HEIGHT = 90; // Minimum container height
  const CONTAINER_PADDING = 40; // Total container padding (8+20+12)

  // Dynamic content height calculation
  const dynamicContentHeight = useMemo(() => {
    let totalHeight = 12; // paddingTop
    
    messages.forEach((message, index) => {
      const contentLength = message.content.length;
      const lines = Math.max(1, Math.ceil(contentLength / 44));
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

  // 2. Dynamic bottom padding - account for live input container height so last lines stay visible
  const dynamicBottomPadding = useMemo(() => {
    // Base padding when idle
    const basePadding = 50;

    // Add extra space if keyboard is open
    const keyboardExtraSpace = keyboardHeight > 0 ? keyboardHeight + containerHeight + 20 : 80;

    // Extra space for the growing input container to prevent overlap
    const extraForInput = Math.max(0, containerHeight - CONTAINER_BASE_HEIGHT) + 40; // small cushion

    // If the AI is responding or user just sent a message, add more for positioning
    const lastMessage = messages[messages.length - 1];
    const isUserWaitingForAI = lastMessage?.role === 'user' || isLoading;
    
    if (keyboardHeight > 0) {
      // When keyboard is open - give more space
      return keyboardExtraSpace;
    } else if (isUserWaitingForAI) {
      return basePadding + extraForInput + 120;
    }

    return basePadding + extraForInput;
  }, [messages, isLoading, containerHeight, keyboardHeight]);

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
                  const updatedContent = message.content.replace(tokenRegex, (match, propsString) => {
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

                // 2. Update messages state
                setMessages(updatedMessages);
                
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
              try {
                const updatedMessages = messages.map((message) => {
                  if (message.role !== 'assistant') return message;
                  if (hostMessageId && message.id !== hostMessageId) return message;
                  const tokenRegex = /\[sessionSuggestion:([^\]]+)\]/g;
                  let occurrence = 0;
                  const updatedContent = message.content.replace(tokenRegex, (match, propsString) => {
                    if (occurrence !== index) { occurrence++; return match; }
                    occurrence++;
                    const existingProps: Record<string, string> = {};
                    const propRegex = /(\w+)="([^"]+)"/g;
                    let propMatch;
                    while ((propMatch = propRegex.exec(propsString)) !== null) {
                      const [, k, v] = propMatch;
                      existingProps[k] = v;
                    }
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
                setMessages(updatedMessages);
                await coachingCacheService.saveMessages(updatedMessages, firebaseUser!.uid);
                console.log('✅ SessionSuggestion state updated and saved');
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
              try {
                const updatedMessages = messages.map((message) => {
                  if (message.role !== 'assistant') return message;
                  if (hostMessageId && message.id !== hostMessageId) return message;
                  const tokenRegex = /\[session:([^\]]+)\]/g;
                  let occurrence = 0;
                  const updatedContent = message.content.replace(tokenRegex, (match, propsString) => {
                    if (occurrence !== index) { occurrence++; return match; }
                    occurrence++;
                    return sessionCardContent; // Replace with sessionCard token
                  });
                  return { ...message, content: updatedContent };
                });
                setMessages(updatedMessages);
                await coachingCacheService.saveMessages(updatedMessages, firebaseUser!.uid);
                console.log('✅ Session token replaced with sessionCard token and saved');
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

  const scrollViewRef = useRef<ScrollView>(null);
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
      
      // Refresh main session when focusing back from breakout session
      const refreshMainSession = async () => {
        if (firebaseUser?.uid) {
          console.log('🔄 CoachingScreen focused - refreshing main session...');
          try {
            // Force reload main session from backend
            const sessionResult = await coachingCacheService.initializeSession(firebaseUser.uid);
            if (sessionResult.messages.length > 0) {
              setMessages(sessionResult.messages);
              console.log(`✅ Main session refreshed with ${sessionResult.messages.length} messages`);
            }
          } catch (error) {
            console.error('❌ Failed to refresh main session:', error);
          }
        }
      };
      
      refreshMainSession();
      
      // Cleanup function that runs when leaving the screen
      return () => {
        const currentSessionId = getSessionId();
        if (currentSessionId && currentSessionId !== 'anonymous' && !sessionCompletedRef.current) {
          sessionCompletedRef.current = true; // Prevent multiple calls
          
          const sessionMinutes = Math.max(Math.floor((Date.now() - sessionStartRef.current.getTime()) / (1000 * 60)), 1);
          const messageCount = messagesRef.current.length;
          const totalWords = messagesRef.current.reduce((total, msg) => {
            if (msg.role === 'user') {
              return total + msg.content.split(/\s+/).filter(word => word.length > 0).length;
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

          // Track coaching session completion
          trackCoachingSessionCompleted({
            session_id: currentSessionId,
            duration_minutes: sessionMinutes,
            message_count: messageCount,
            words_written: totalWords,
            insights_generated: 0,
            session_type: 'regular',
          });
        }
      };
    }, [firebaseUser?.uid, setMessages])
  );

  // Session ID is derived from firebaseUser.uid - no useEffect needed

  // Track current user to detect user switches
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  // Load conversation history from local storage or show welcome message
  const [isInitialized, setIsInitialized] = useState(false);
  const initializationInProgress = useRef(false);
  
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
  
  useEffect(() => {
    if (!firebaseUser || isInitialized || initializationInProgress.current) return;
    
    const initializeChat = async () => {
      // Prevent concurrent initialization
      if (initializationInProgress.current) {
        console.log('⚠️ [COACHING INIT] Initialization already in progress, skipping');
        return;
      }
      
      initializationInProgress.current = true;
      
      console.log('🔄 [COACHING INIT] Starting chat initialization for user:', firebaseUser.uid);
      console.log('🔄 [COACHING INIT] User details:', {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        firstName: user?.firstName
      });
      
      try {
        // Load existing session from backend (never create from cache)
        console.log('🔄 [COACHING INIT] Calling initializeCoachingSession...');
        const sessionMessages = await initializeCoachingSession(firebaseUser.uid);
        
        console.log('🔄 [COACHING INIT] Session initialization result:', {
          messageCount: sessionMessages.length,
          hasMessages: sessionMessages.length > 0
        });
        
        if (sessionMessages.length > 0) {
          // Existing session found - load recent messages
          console.log('✅ [COACHING INIT] Found existing session, loading messages...');
          console.log('✅ [COACHING INIT] Message preview:', {
            firstMessage: {
              id: sessionMessages[0].id,
              role: sessionMessages[0].role,
              contentPreview: sessionMessages[0].content.substring(0, 100) + '...'
            },
            lastMessage: {
              id: sessionMessages[sessionMessages.length - 1].id,
              role: sessionMessages[sessionMessages.length - 1].role,
              contentPreview: sessionMessages[sessionMessages.length - 1].content.substring(0, 100) + '...'
            }
          });
          
          setMessages(sessionMessages);
          console.log(`✅ [COACHING INIT] Successfully loaded existing session with ${sessionMessages.length} messages`);
        } else {
          // No existing session found - show welcome message (session will be created on first user message)
          console.log('📝 [COACHING INIT] No existing session found, creating welcome message');
          const initialMessage: CoachingMessage = {
            id: '1',
            content: `Hello ${user?.firstName || 'there'}!\n\nI'm here to support your growth and reflection. What's on your mind today? Feel free to share anything that's weighing on you, exciting you, or simply present in your awareness right now.`,
            role: 'assistant',
            timestamp: new Date()
          };
          setMessages([initialMessage]);
          console.log('✅ [COACHING INIT] Welcome message created - ready for new session');
        }
        
        setIsInitialized(true);
        console.log('✅ [COACHING INIT] Chat initialization completed successfully');
        
      } catch (error) {
        console.error('❌ [COACHING INIT] Chat initialization failed:', error);
        console.error('❌ [COACHING INIT] Error details:', {
          name: error instanceof Error ? error.name : 'Unknown',
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        });
        
        // Fallback: show welcome message even on error
        const fallbackMessage: CoachingMessage = {
          id: '1',
          content: `Hello ${user?.firstName || 'there'}!\n\nI'm here to support your growth and reflection. What's on your mind today? Feel free to share anything that's weighing on you, exciting you, or simply present in your awareness right now.`,
          role: 'assistant',
          timestamp: new Date()
        };
        setMessages([fallbackMessage]);
        setIsInitialized(true);
        console.log('🔄 [COACHING INIT] Fallback initialization completed');
      } finally {
        // Always reset initialization flag
        initializationInProgress.current = false;
      }
    };
    
    initializeChat();
  }, [firebaseUser, isInitialized, setMessages, user?.firstName, initializeCoachingSession]);

  // Debounced save to prevent multiple rapid saves
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSaveRef = useRef<string>('');
  
  // Save messages to both local storage and Firestore whenever messages change
  useEffect(() => {
    if (firebaseUser?.uid && messages.length > 0) {
      // Create a hash of current messages to detect actual changes
      const messageHash = `${firebaseUser.uid}-${messages.length}-${messages[messages.length - 1]?.id}`;
      
      console.log('💾 [SAVE] Message save triggered:', {
        userId: firebaseUser.uid,
        messageCount: messages.length,
        messageHash: messageHash,
        isWelcomeOnly: messages.length === 1 && messages[0].id === '1' && messages[0].role === 'assistant',
        isDuplicate: lastSaveRef.current === messageHash
      });
      
      // Skip if this is the same state we just saved
      if (lastSaveRef.current === messageHash) {
        console.log('💾 [SAVE] Skipping save - no changes detected');
        return;
      }
      
      // Don't save just the welcome message
      if (messages.length === 1 && messages[0].id === '1' && messages[0].role === 'assistant') {
        console.log('💾 [SAVE] Skipping save - welcome message only');
        return;
      }
      
      // Clear any pending save
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      
      // Debounce saves by 1 second
      saveTimeoutRef.current = setTimeout(() => {
        console.log('💾 [SAVE] Executing debounced save...');
        
        // Save to local storage (last 300 messages - rich cache)
        saveMessagesToStorage(messages, firebaseUser.uid);
        
        // Save to Firestore (all messages - full backup)
        saveMessagesToFirestore(messages, firebaseUser.uid);
        
        // Update last save hash
        lastSaveRef.current = messageHash;
        
        console.log('💾 [SAVE] Save operations initiated');
      }, 1000);
      
    } else {
      console.log('💾 [SAVE] Save skipped:', {
        hasUser: !!firebaseUser?.uid,
        messageCount: messages.length
      });
    }
  }, [messages, firebaseUser?.uid, saveMessagesToStorage, saveMessagesToFirestore]);
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  

  // Auto-scroll to position new messages below header
  const scrollToNewMessageRef = useRef(false);
  
  // Store refs for each message to measure their positions
  const messageRefs = useRef<{ [key: string]: View | null }>({});
  
  // Store the target scroll position after user message positioning
  const targetScrollPosition = useRef<number | null>(null);
  
  // Track if user has manually scrolled
  const hasUserScrolled = useRef<boolean>(false);
  // One-time initial auto-scroll flag
  const didInitialAutoScroll = useRef<boolean>(false);
  
    // 3. Completely rewrite scrollToShowLastMessage:
  const scrollToShowLastMessage = useCallback(() => {
    if (!scrollViewRef.current || messages.length === 0) return;
    
    const lastMessage = messages[messages.length - 1];
    
    // Only position user messages
    if (lastMessage.role !== 'user') return;
    
    debugLog('🎯 Positioning user message:', lastMessage.content.substring(0, 30) + '...');
    
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
            // For long messages, show the end of the message instead of the beginning
            const isLongMessage = msgHeight > 100; // Messages taller than 100px are considered long
            
            let targetScrollY;
            if (isLongMessage) {
              // For long messages: position the END of the message at target position
              // This leaves room for AI response below
              targetScrollY = Math.max(0, (msgY + msgHeight) - targetFromTop - 60); // 60px buffer for AI response
            } else {
              // For short messages: position the START of the message at target position  
              targetScrollY = Math.max(0, msgY - targetFromTop);
            }
            
            debugLog('📐 Measurement:', {
              messageY: msgY,
              messageHeight: msgHeight,
              isLongMessage,
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
            
            debugLog('✅ User message positioned at scroll:', targetScrollY);
          },
          () => {
            debugLog('❌ Measurement failed, using estimation');
            
            // Fallback: estimate message position
            let estimatedY = 12; // paddingTop
            
            // Sum up height of all previous messages
            for (let i = 0; i < messages.length - 1; i++) {
              const msg = messages[i];
              const lines = Math.max(1, Math.ceil(msg.content.length / 40));
              const msgHeight = lines * 22 + 48; // text + padding
              estimatedY += msgHeight + 16; // marginBottom
            }
            
            // Estimate last message height
            const lastMsg = messages[messages.length - 1];
            const lastMsgLines = Math.max(1, Math.ceil(lastMsg.content.length / 40));
            const lastMsgHeight = lastMsgLines * 22 + 48;
            const isLongMessage = lastMsgHeight > 100;
            
            let targetScrollY;
            if (isLongMessage) {
              // For long messages: position the END of the message
              targetScrollY = Math.max(0, (estimatedY + lastMsgHeight) - targetFromTop - 60);
            } else {
              // For short messages: position the START of the message
              targetScrollY = Math.max(0, estimatedY - targetFromTop);
            }
            
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
        debugLog('🧹 Positioning cleared after AI response');
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
    
    // Character width based on font size (fontSize: 15, fontWeight: 400)
    // More conservative calculation - extra margin for words
    const baseCharsPerLine = isMultiLine ? 36 : 42; // Fewer characters in multi-line
    const charsPerLine = baseCharsPerLine;
    
    // Line calculation - including word wrapping
    const textLines = text.split('\n');
    let totalLines = 0;
    
    textLines.forEach(line => {
      if (line.length === 0) {
        totalLines += 1; // Empty line
      } else {
        // Word-based calculation - for risk of long words wrapping
        const words = line.split(' ');
        let currentLineLength = 0;
        let linesForThisTextLine = 1;
        
        words.forEach((word, index) => {
          const wordLength = word.length;
          const spaceNeeded = index > 0 ? 1 : 0; // Space before word (except first)
          
          // If this word won't fit on current line, new line
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
    
    // Save line count
    setCurrentLineCount(totalLines);
    
    // Min/Max limits - based on expand state
    const maxLines = isInputExpanded ? EXPANDED_MAX_LINES : MAX_LINES;
    const actualLines = Math.max(MIN_LINES, Math.min(maxLines, totalLines));
    
    // Height calculation
    const newInputHeight = actualLines * LINE_HEIGHT;
    
    // Container height - optimized for real layout
    const topPadding = 12; // TextInput top padding increased
    const bottomPadding = 8;
    const buttonHeight = 32; // Voice/Send button height
    const buttonTopPadding = 8; // Button container padding top
    
    const totalContainerHeight = topPadding + newInputHeight + buttonTopPadding + buttonHeight + bottomPadding;
    const newContainerHeight = Math.max(CONTAINER_BASE_HEIGHT, totalContainerHeight);
    
    setInputHeight(newInputHeight);
    setContainerHeight(newContainerHeight);
  };

  const handleContentSizeChange = (event: any) => {
    const { height } = event.nativeEvent.contentSize;
    
    // Calculate Min/Max heights
    const minHeight = MIN_LINES * LINE_HEIGHT; // 24px
    const maxHeight = MAX_LINES * LINE_HEIGHT; // 240px
    
    // Use real content height but round to LINE_HEIGHT
    const rawHeight = Math.max(minHeight, Math.min(maxHeight, height));
    
    // Round to nearest LINE_HEIGHT multiple (multiples of 24px)
    const roundedLines = Math.round(rawHeight / LINE_HEIGHT);
    const newInputHeight = Math.max(MIN_LINES, Math.min(MAX_LINES, roundedLines)) * LINE_HEIGHT;
    
    // Container height - same calculation as handleTextChange
    const topPadding = 12; // TextInput top padding increased
    const bottomPadding = 8;
    const buttonHeight = 32; // Voice/Send button height
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
    
    // Recalculate based on current text
    setTimeout(() => {
      handleTextChange(chatInput);
    }, 0);
  };

  // 8. Set flag correctly in handleSendMessage:
  
  const handleSendMessage = async () => {
    if (chatInput.trim().length === 0) return;

    // Use userId as session ID (single session per user)
    const currentSessionId = getSessionId();
    
    // Log coaching session (session is always the user ID)
    console.log('🎯 [COACHING] User coaching session...', {
      sessionId: currentSessionId,
      userId: firebaseUser?.uid,
      sessionType: 'single-user-session',
      trigger: 'manual'
    });
    
    // Track coaching session activity
    trackCoachingSessionStarted({
      session_id: currentSessionId,
      session_type: 'regular',
      trigger: 'manual',
    });

    const messageContent = chatInput.trim();
    setChatInput('');
    
    // Close keyboard and blur input
    textInputRef.current?.blur();
    Keyboard.dismiss();
    setIsChatInputFocused(false);
    
    // Reset input height and expand state
    setInputHeight(LINE_HEIGHT);
    setContainerHeight(CONTAINER_BASE_HEIGHT);
    setIsInputExpanded(false);
    setCurrentLineCount(1);
    
    // Set positioning flag
    hasUserScrolled.current = false;
    scrollToNewMessageRef.current = true; // This flag will trigger positioning

    debugLog('📤 Sending message, positioning will be triggered');

    await sendMessage(messageContent, currentSessionId, {
        sessionType: 'default-session'
    });
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

  const handleScrollToBottom = (animated: boolean = true) => {
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
                animated
              });
            } else {
              // For short responses: scroll to show the message with minimal space below
              const targetY = Math.max(0, y - 20); // Small offset
              scrollViewRef.current?.scrollTo({
                y: targetY,
                animated
              });
            }
          },
          () => {
            // Fallback: scroll to a position that shows the last message
            const estimatedPosition = Math.max(0, (messages.length - 1) * 80 - 30);
            scrollViewRef.current?.scrollTo({
              y: estimatedPosition,
              animated
            });
          }
        );
      } else {
        // Fallback: scroll to a position that shows the last message
        const estimatedPosition = Math.max(0, (messages.length - 1) * 80 - 30);
        scrollViewRef.current?.scrollTo({
          y: estimatedPosition,
          animated
        });
      }
    } else {
    scrollViewRef.current?.scrollToEnd({ animated });
    }
  };

  // Initial auto-scroll to bottom once after messages initialize
  useEffect(() => {
    if (!isInitialized) return;
    if (didInitialAutoScroll.current) return;
    if (!scrollViewRef.current) return;
    if (messages.length === 0) return;

    // Allow layout to settle, then scroll to last message precisely (no blank overscroll)
    setTimeout(() => {
      if (!hasUserScrolled.current && scrollViewRef.current) {
        handleScrollToBottom(false);
        didInitialAutoScroll.current = true;
      }
    }, 100);
  }, [isInitialized, messages.length]);

  // 7. Simplify handleScroll with pagination:
  const handleScroll = (event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const scrollY = contentOffset.y;
    
    // User scroll detection
    if (targetScrollPosition.current !== null) {
      const savedPosition = targetScrollPosition.current;
      const scrollDifference = Math.abs(scrollY - savedPosition);
      
      if (scrollDifference > 50) { // Larger threshold
        debugLog('👆 User scrolled manually, clearing positioning');
        hasUserScrolled.current = true;
        targetScrollPosition.current = null;
      }
    }
    
    // Pagination: Load more messages when pulling to very top (like pull-to-refresh)
    const isAtVeryTop = scrollY <= 10; // Must be within 10px of absolute top
    const isPullingUp = scrollY < 0; // Negative scroll (over-scroll/bounce)
    const now = Date.now();
    const timeSinceLastLoad = now - lastLoadTimeRef.current;
    
    if ((isAtVeryTop || isPullingUp) && hasMoreMessages && !isLoadingMore && !isLoading && timeSinceLastLoad > LOAD_THROTTLE_MS) {
      console.log('📄 User pulled to top, loading more messages...');
      lastLoadTimeRef.current = now;
      loadMoreMessages();
    }
    
    // Scroll to bottom button - show when content is scrollable and not at bottom
    const hasMessages = messages.length > 0;
    const lastMessage = hasMessages ? messages[messages.length - 1] : null;
    const isAIResponseComplete = !isLoading && lastMessage?.role === 'assistant';
    
    if (isAIResponseComplete) {
      const contentHeight = contentSize.height;
      const screenHeight = layoutMeasurement.height;
      const distanceFromBottom = contentHeight - screenHeight - scrollY;
      setShowScrollToBottom(distanceFromBottom > 200);
    } else {
      setShowScrollToBottom(false);
    }
  };

  const handleConversationStarterPress = (starter: string) => {
    setChatInput(starter);
    textInputRef.current?.focus();
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
        {/* Header */}
        <View style={[styles.chatHeader, { backgroundColor: colors.background, paddingTop: insets.top + 25, borderColor: `${colors.tint}12` }]}>
          <Text style={[styles.chatHeaderText, { color: colors.text }]}>
            Coach
          </Text>
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
              // Save ScrollView height
              const { height } = event.nativeEvent.layout;
              setScrollViewHeight(height);
            }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="always"
            keyboardDismissMode="interactive"
            bounces={false}
            overScrollMode="never"
            // Add scroll limit
            onScrollEndDrag={(event) => {
              const { contentOffset } = event.nativeEvent;
              
              // If exceeded maximum scroll limit, bring back
              if (contentOffset.y > scrollLimits.maxScrollDistance) {
                scrollViewRef.current?.scrollTo({
                  y: scrollLimits.maxScrollDistance,
                  animated: true
                });
              }
            }}
            // Also check after momentum scroll
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
                       numberOfLines={message.role === 'user' ? undefined : undefined}
                       ellipsizeMode={message.role === 'user' ? 'tail' : 'tail'}
                     >
                       {getDisplayContent(message.content)}
                     </Text>

                   {/* Render coaching cards for AI messages */}
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
                    ? keyboardHeight + containerHeight - 300  // Keyboard + input height + margin
                    : 280 + containerHeight - 90, // Normal position + input growth
                }
              ]}
              onPress={() => handleScrollToBottom(true)}
            >
              <ArrowDown size={20} color={colors.text} />
            </TouchableOpacity>
          )}
        </View>

        {/* Suggestion Buttons - Temporarily hidden */}
        {/* TODO: Re-enable suggestions later if needed */}

        {/* Input */}
        <View style={[styles.chatInputContainer, { 
          bottom: keyboardHeight > 0 ? keyboardHeight - 10 : 80, // If keyboard open: slightly overlapping, otherwise 80px above navbar
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
                shadowColor: colorScheme === 'dark' ? '#FFFFFF' : '#000000',
                shadowOpacity: colorScheme === 'dark' ? 0.1 : 0.2,
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
                      height: inputHeight, // Dynamic height
                      width: currentLineCount > 1 ? '92%' : '100%', // Leave space for expand button (~28px less)
                      paddingRight: currentLineCount > 1 ? 32 : 4, // Right padding for expand button
                    }
                ]}
                value={chatInput}
                  onChangeText={handleTextChange} // Main controller
                  onContentSizeChange={undefined} // Disabled - only use handleTextChange
                onFocus={() => setIsChatInputFocused(true)}
                onBlur={() => setIsChatInputFocused(false)}
                  placeholder="Write how you think..."
                  placeholderTextColor={colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.50)'}
                multiline
                maxLength={500}
                returnKeyType='default'
                onSubmitEditing={handleSendMessage}
                cursorColor={colors.tint}
                  scrollEnabled={inputHeight >= (isInputExpanded ? EXPANDED_MAX_LINES : MAX_LINES) * LINE_HEIGHT} // Scroll active at maximum height
                  textBreakStrategy="balanced" // Word breaking strategy
                />
                
                {/* Button Container at the bottom - Voice + Send buttons side by side */}
                <View style={styles.buttonContainer}>
                  {chatInput.trim().length > 0 ? (
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
                  ) : (
                  <TouchableOpacity
                      style={[styles.voiceButton, { 
                        backgroundColor: colorScheme === 'dark' ? '#404040' : '#E6E6E6' 
                      }]}
                      onPress={handleMicrophonePress}
                      onLongPress={handleVoiceModePress}
                      delayLongPress={500}
                    >
                      <Text style={[styles.voiceButtonText, { 
                        color: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.50)' 
                      }]}>
                        Voice
                      </Text>
                      <IconSymbol
                        name="waveform"
                        size={12}
                        color={colorScheme === 'dark' ? '#AAAAAA' : '#737373'}
                    />
                  </TouchableOpacity>
            )}

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
                    }]}
                    onPress={
                      isLoading 
                        ? handleStopGeneration 
                        : (chatInput.trim().length > 0 ? handleSendMessage : handleMicrophonePress)
                    }
                  >
                    {isLoading ? (
                      <Square
                        size={14}
                        color={colorScheme === 'dark' ? '#FFFFFF' : '#666666'}
                        fill={colorScheme === 'dark' ? '#FFFFFF' : '#666666'}
                        strokeWidth={0}
                      />
                    ) : chatInput.trim().length > 0 ? (
                      <ArrowUp
                        size={18}
                        color={colorScheme === 'dark' ? '#000000' : '#FFFFFF'}
                        strokeWidth={1.5}
                      />
                    ) : (
                      <Mic
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
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    zIndex: 10,
  },
  chatHeaderText: {
    fontSize: 20,
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
    bottom: 0, // 40px above navbar
    left: 0,
    right: 0,
    justifyContent: 'flex-end', // Align content to bottom (for upward expansion)
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
    alignItems: 'flex-end', // Align buttons to bottom
    justifyContent: 'flex-start',
    overflow: 'visible',
    opacity: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
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
    borderWidth: 0, // Remove border, only arrow
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    zIndex: 999, // Lower z-index than input
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
  conversationStartersContainer: {
    paddingBottom: 12,
    width: '100%',
  },
  startersScrollView: {
    maxHeight: 50,
  },
  startersScrollContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  starterButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
  },
}); 