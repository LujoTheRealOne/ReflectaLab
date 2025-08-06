import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { StyleSheet, Text, TextInput, View, useColorScheme, TouchableOpacity, ScrollView, SafeAreaView, KeyboardAvoidingView, Platform, Keyboard, ColorSchemeName, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, Mic, X, Check, ArrowUp } from 'lucide-react-native';
import * as Crypto from 'expo-crypto';
import { Colors } from '@/constants/Colors';
import { AppStackParamList } from '@/navigation/AppNavigator';
import { Button } from '@/components/ui/Button';
import { useAICoaching, CoachingMessage } from '@/hooks/useAICoaching';
import { useAuth } from '@/hooks/useAuth';
import { useAudioTranscriptionAv } from '@/hooks/useAudioTranscriptionAv';

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

export default function CoachingScreen() {
  const navigation = useNavigation<CoachingScreenNavigationProp>();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const { user, firebaseUser } = useAuth();

  // Session ID state - will be generated when first message is sent
  const [sessionId, setSessionId] = useState<string | null>(null);
  
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
    const finishStartIndex = content.indexOf('[finish-start]');
    
    // If no finish tokens, return original content
    if (finishStartIndex === -1) {
      return content;
    }
    
    // Return only the content before the finish tokens
    return content.slice(0, finishStartIndex).trim();
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

  // Initialize chat with first message when component mounts
  useEffect(() => {
    if (messages.length === 0) {
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
  }, [user?.firstName, messages.length, setMessages]);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottomRef = useRef(false);
  const previousMessageCountRef = useRef(0);
  
  useEffect(() => {
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

    // Send message using the AI coaching hook with session ID and default session type
    await sendMessage(messageContent, currentSessionId, {
      sessionType: 'default-session'
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

  const handleCompletionAction = async () => {
    console.log('User clicked End this session');
    console.log('📊 Session Stats:', completionStats);
    console.log('🎯 Parsed Coaching Data:', parsedCoachingData);
    
    if (parsedCoachingData) {
      parsedCoachingData.components.forEach((component, index) => {
        console.log(`  ${index + 1}. ${component.type.toUpperCase()}:`, component.props);
      });
    }
    
    // Navigate to compass story for coaching completion
    navigation.navigate('CompassStory', { 
      fromCoaching: true,
      parsedCoachingData: parsedCoachingData || undefined
    });
    setShowCompletionForMessage(null);
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
                placeholder="Share what's on your mind..."
                placeholderTextColor={`${colors.text}66`}
                multiline
                maxLength={500}
                returnKeyType='default'
                onSubmitEditing={handleSendMessage}
                cursorColor={colors.tint}
                editable={!isRecording}
              />
            )}

            {/* Empty input - show microphone only */}
            {chatInput.trim().length === 0 && !isRecording && !isTranscribing && (
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

            {/* Text entered - show both microphone and send buttons */}
            {(chatInput.trim().length > 0 || isTranscribing) && !isRecording && (
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
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 12,
    boxShadow: '0px -2px 20.9px 0px #00000005, 0px -4px 18.6px 0px #00000005, 0px 0.5px 0.5px 0px #0000001A inset',
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    maxHeight: 160,
  },
  chatInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 22,
    maxHeight: 100,
    paddingVertical: 8,
    paddingHorizontal: 0,
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
}); 