import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { StyleSheet, Text, TextInput, View, useColorScheme, TouchableOpacity, ScrollView, SafeAreaView, KeyboardAvoidingView, Platform, Keyboard, ColorSchemeName, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Mic, X, Check, ArrowUp } from 'lucide-react-native';
import * as Crypto from 'expo-crypto';
import { Colors } from '@/constants/Colors';
import { AuthStackParamList } from '@/navigation/AuthNavigator';
import * as Progress from 'react-native-progress';
import { Button } from '@/components/ui/Button';
import { useAICoaching, CoachingMessage } from '@/hooks/useAICoaching';
import { useNotificationPermissions } from '@/hooks/useNotificationPermissions';
import { useAuth } from '@/hooks/useAuth';
import { useAudioTranscriptionAv } from '@/hooks/useAudioTranscriptionAv';
import { FirestoreService } from '@/lib/firestore';
import { UserAccount } from '@/types/journal';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { ActionPlanCard, BlockersCard, FocusCard, MeditationCard } from '@/components/cards';

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
  
  // Calculate which dots should be filled based on audio level
  const isDotActive = (index: number) => {
    // Each dot represents a segment of the audio level range (0-1)
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
                  ? (colorScheme === 'dark' ? '#666666' : '#333333')
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

  // Session ID state - will be generated when first message is sent
  const [sessionId, setSessionId] = useState<string | null>(null);
  
  // Generate unique session ID using proper UUID
  const generateSessionId = (): string => {
    return Crypto.randomUUID();
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

  // Use the audio transcription hook with expo-av
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
    // Parse component markers like [checkin:frequency="once a day",what="morning routine progress",notes="..."]
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

  // Function to parse coaching completion data between finish tokens
  const parseCoachingCompletion = (content: string) => {
    const finishStartIndex = content.indexOf('[finish-start]');
    const finishEndIndex = content.indexOf('[finish-end]');
    
    if (finishStartIndex === -1 || finishEndIndex === -1) {
      return { components: [], rawData: '' };
    }
    
    // Extract content between finish tokens
    const finishContent = content.slice(finishStartIndex + '[finish-start]'.length, finishEndIndex).trim();
    
    // Use the general parsing function
    const components = parseCoachingCards(finishContent);
    
    console.log('🎯 Parsed coaching completion:', { 
      componentsCount: components.length, 
      components,
      rawFinishContent: finishContent
    });
    
    return { components, rawData: finishContent };
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

      // Ensure we have a sessionId - generate one if needed
      let currentSessionId = sessionId;
      if (!currentSessionId) {
        currentSessionId = generateSessionId();
        setSessionId(currentSessionId);
        console.log(`🆔 Generated new session ID for API call: ${currentSessionId}`);
      }

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

  const scrollViewRef = useRef<ScrollView>(null);
  const textInputRef = useRef<TextInput>(null);

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

  // Controlled scrolling - only when explicitly needed
  const scrollToBottomRef = useRef(false);
  const previousMessageCountRef = useRef(0);
  
  useEffect(() => {
    // Only scroll if we explicitly requested it OR if new AI message arrives
    const shouldScroll = scrollToBottomRef.current || 
      (messages.length > previousMessageCountRef.current && 
       messages.length > 0 && 
       messages[messages.length - 1]?.role === 'assistant');
    
    if (shouldScroll && scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
        scrollToBottomRef.current = false;
      }, 200);
    }
    
    previousMessageCountRef.current = messages.length;
  }, [messages.length]);

  // Auto-scroll during streaming when AI message content updates
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      // If last message is from assistant and we're not loading (streaming in progress)
      if (lastMessage?.role === 'assistant' && !isLoading && scrollViewRef.current) {
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100); // Shorter delay for streaming updates
      }
    }
  }, [messages, isLoading]); // Trigger on messages array changes (content updates)



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

  // Check for completion when progress reaches 100%
  useEffect(() => {
    if (progress === 100 && !showCompletionForMessage) {
      console.log('🎯 Progress reached 100%! Showing completion popup...');
      
      // Find the final AI message that contains finish tokens
      const lastAIMessage = [...messages].reverse().find(msg => 
        msg.role === 'assistant' && 
        (msg.content.includes('[finish-start]') || msg.content.includes('[finish-end]'))
      );
      
      if (lastAIMessage) {
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
        const parsedData = parseCoachingCompletion(lastAIMessage.content);
        const keyInsights = Math.max(parsedData.components.length, 3); // Use actual parsed components count
        
        setCompletionStats({
          minutes: Math.max(sessionMinutes, 1), // At least 1 minute
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





  const handleSendMessage = async () => {
    if (chatInput.trim().length === 0) return;

    // Generate session ID for first user message if not already set
    let currentSessionId = sessionId;
    if (!currentSessionId) {
      currentSessionId = generateSessionId();
      setSessionId(currentSessionId);
      console.log(`🆔 Generated new session ID for onboarding: ${currentSessionId}`);
    }

    const messageContent = chatInput.trim();
    setChatInput('');
    
    // Trigger scroll after sending message
    scrollToBottomRef.current = true;

    // Send message using the AI coaching hook with session ID, type, and duration
    await sendMessage(messageContent, currentSessionId, {
      sessionType: 'initial-life-deep-dive',
      sessionDuration: timeDuration
    });
  };

  const handleMicrophonePress = () => {
    startRecording();
  };

  const handleRecordingCancel = () => {
    cancelRecording();
    setChatInput('');
  };

  const handleRecordingConfirm = () => {
    stopRecordingAndTranscribe();
  };

  const handlePopupAction = async (action: string, messageId: string) => {
    console.log(`Action: ${action} for message: ${messageId}`);
    setShowPopupForMessage(null);
    
    // Handle specific actions here
    switch (action) {
      case 'decline':
        console.log('User declined notification permissions');
        break;
      case 'accept':
        try {
          const granted = await requestPermissions();
          if (granted) {
            console.log('✅ Notification permissions granted and push token saved');
            
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
    console.log('User clicked End this session');
    console.log('📊 Session Stats:', completionStats);
    console.log('🎯 Parsed Coaching Data:', parsedCoachingData);
    
    if (parsedCoachingData) {
      parsedCoachingData.components.forEach((component, index) => {
        console.log(`  ${index + 1}. ${component.type.toUpperCase()}:`, component.props);
      });
    }
    
    // Navigate to compass story instead of completing onboarding directly - immediate navigation
    navigation.navigate('CompassStory', { 
      fromOnboarding: true,
      sessionId: sessionId || undefined, // Pass sessionId for insight tracking
      parsedCoachingData: parsedCoachingData || undefined
    });
    setShowCompletionForMessage(null);

    // Trigger insight extraction in background if we have a session ID
    if (sessionId) {
      console.log('🧠 Starting insight extraction for onboarding session:', sessionId);
      triggerInsightExtraction(sessionId); // Don't await - run in background
    }
  };

  const handleEnterApp = async () => {
    console.log('User clicked Enter App');
    console.log('📊 Session Stats:', completionStats);
    console.log('🎯 Parsed Coaching Data:', parsedCoachingData);
    
    try {
      console.log('🚀 Starting onboarding completion...');
      const result = await completeOnboarding();
      console.log('✅ Onboarding completion finished successfully', result);

      // After marking onboarding complete, forcefully go to the main app route at the root navigator
      // This avoids relying solely on state propagation timing
      // @ts-ignore - allow parent navigator access
      navigation.getParent()?.reset({
        index: 0,
        routes: [{ name: 'App' as never }],
      });
    } catch (error) {
      console.error('❌ Error completing onboarding:', error);
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
              progress={progress / 100}
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
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            scrollEventThrottle={16}
          >
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
                        >
                          View Compass Results
                        </Button>
                      </View>
                    </View>
                  </View>
                )}
              </View>
            ))}
            {isLoading && (
              <View style={[styles.messageContainer, styles.aiMessageContainer]}>
                <View style={styles.messageBubble}>
                  <View style={styles.typingIndicator}>
                    <View style={[styles.typingDot, { backgroundColor: `${colors.text}40` }]} />
                    <View style={[styles.typingDot, { backgroundColor: `${colors.text}40` }]} />
                    <View style={[styles.typingDot, { backgroundColor: `${colors.text}40` }]} />
                  </View>
                </View>
              </View>
            )}
          </ScrollView>
        </View>

        {/* Input or Enter App Button - based on progress */}
        {progress === 100 && (
          /* Enter App Button when progress is complete */
          <View style={[styles.enterAppContainer, { paddingBottom: 15 }]}>
            <Button
              variant="primary"
              size="default"
              onPress={handleEnterApp}
              style={styles.enterAppButton}
            >
              Enter App
            </Button>
          </View>
        )}

          /* Input - extends to screen bottom */
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
              ) : (
                <TextInput
                  ref={textInputRef}
                  style={[
                    styles.chatInput,
                    { color: colors.text },
                    isRecording && { flex: 0, width: '100%', textAlign: 'left' }
                  ]}
                  value={chatInput}
                  onChangeText={setChatInput}
                  onFocus={() => setIsChatInputFocused(true)}
                  onBlur={() => setIsChatInputFocused(false)}
                  placeholder="Share whats on your mind..."
                  placeholderTextColor={`${colors.text}66`}
                  multiline
                  maxLength={500}
                  returnKeyType='default'
                  onSubmitEditing={handleSendMessage}
                  cursorColor={colors.tint}
                  editable={!isRecording}
                />
              )}

              {/* Recording state */}
              {isRecording && !isTranscribing && (
                <View style={styles.recordingContainer}>
                  {/* Left side - Cancel button */}
                  <TouchableOpacity
                    style={[styles.recordingButton, { backgroundColor: `${colors.text}20` }]}
                    onPress={handleRecordingCancel}
                  >
                    <X
                      size={20}
                      color={colors.text}
                    />
                  </TouchableOpacity>
                  
                  {/* Left-center - Audio level visualization */}
                  <View style={styles.recordingCenterSection}>
                    <AudioLevelIndicator audioLevel={audioLevel} colorScheme={colorScheme} />
                  </View>
                  
                  {/* Right side - Timer and confirm button */}
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
    maxHeight: 180, // Prevent input from taking too much space
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
    maxHeight: 100, // Reduced to leave room for padding
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
  enterAppContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    backgroundColor: 'transparent',
  },
  enterAppButton: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  }
}); 