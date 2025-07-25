import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, TextInput, View, useColorScheme, TouchableOpacity, ScrollView, SafeAreaView, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { AuthStackParamList } from '@/navigation/AuthNavigator';
import { Button } from '@/components/ui/Button';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

type OnboardingChatScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'OnboardingChat'>;
type OnboardingChatScreenRouteProp = RouteProp<AuthStackParamList, 'OnboardingChat'>;

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

  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatInputFocused, setIsChatInputFocused] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showPopupForMessage, setShowPopupForMessage] = useState<string | null>(null);

  const scrollViewRef = useRef<ScrollView>(null);
  const textInputRef = useRef<TextInput>(null);

  // Initialize chat with first message when component mounts
  useEffect(() => {
    if (chatMessages.length === 0) {
      setTimeout(() => {
        const initialMessage: Message = {
          id: '1',
          text: `Good afternoon, ${name}.`,
          isUser: false,
          timestamp: new Date()
        };
        setChatMessages([initialMessage]);
      }, 1000);
    }
  }, [name]);



  // Helper function to generate personalized AI responses based on user configuration
  const generatePersonalizedResponse = (userMessage: string): string => {
    // Convert coaching style position to descriptive terms
    const getCoachingStyle = () => {
      const { x, y } = coachingStylePosition;
      let style = "";

      // Vertical axis: Friendliness (positive y) vs Challenging (negative y)
      if (y > 0.3) style += "friendly and supportive";
      else if (y < -0.3) style += "direct and challenging";
      else style += "balanced";

      // Horizontal axis: Active (negative x) vs Passive (positive x)
      if (x < -0.3) style += ", proactive";
      else if (x > 0.3) style += ", reflective";
      else style += ", adaptive";

      return style;
    };

    // Get clarity and stress descriptors
    const getClarityLevel = () => {
      if (clarityLevel < 0.3) return "seeking direction";
      if (clarityLevel > 0.7) return "quite clear on your goals";
      return "developing clarity";
    };

    const getStressLevel = () => {
      if (stressLevel < 0.3) return "relatively calm";
      if (stressLevel > 0.7) return "under significant pressure";
      return "managing moderate stress";
    };

    // Generate contextual response based on user's profile
    const responses = [
      `I understand you're ${getClarityLevel()} and ${getStressLevel()}. As someone who works in ${selectedRoles.join(', ')}, getting what you want from life often starts with aligning your professional identity with your deeper values. 

Since you've tried ${selectedSelfReflection.join(', ')}, you already know the power of self-reflection. The key is to be ${getCoachingStyle()} in your approach - what specific aspect of your life feels most out of alignment right now?`,

      `Hey I suggest you setup this notification schedule based on your suggestions.`
    ];

    // Return a random personalized response
    return responses[Math.floor(Math.random() * responses.length)];
  };

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    if (scrollViewRef.current && chatMessages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [chatMessages]);

  const handleSendMessage = () => {
    if (chatInput.trim().length === 0) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: chatInput.trim(),
      isUser: true,
      timestamp: new Date()
    };

    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setIsTyping(true);

    // Simulate AI response after a delay with personalized content
    setTimeout(() => {
      const responseText = generatePersonalizedResponse(userMessage.text);
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: responseText,
        isUser: false,
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, aiResponse]);
      setIsTyping(false);

      // Auto-show popup for notification schedule suggestion
      if (responseText.includes('Hey I suggest you setup this notification schedule')) {
        setTimeout(() => {
          setShowPopupForMessage(aiResponse.id);
        }, 300); // Small delay to let the message appear first
      }
    }, 2000);
  };

  const handleMicrophonePress = () => {
    setIsRecording(true);
    setChatInput('This text is dictated');
    // Here you would typically start voice recording
    // For now, we'll simulate with placeholder text
  };

  const handleRecordingCancel = () => {
    setIsRecording(false);
    setChatInput('');
  };

  const handleRecordingConfirm = () => {
    setIsRecording(false);
    // Keep the dictated text and allow further editing
    setTimeout(() => {
      textInputRef.current?.focus();
    }, 100);
  };

  const handlePopupAction = (action: string, messageId: string) => {
    console.log(`Action: ${action} for message: ${messageId}`);
    setShowPopupForMessage(null);
    // Handle specific actions here
    switch (action) {
      case 'decline':
        // Handle decline
        break;
      case 'accept':
        // Handle accept
        break;
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
        <View style={[styles.chatHeader, { backgroundColor: colors.background, paddingTop: insets.top + 25, borderBottomColor: `${colors.tint}12` }]}>
          <Text style={[styles.chatHeaderText, { color: colors.text }]}>
            Life Deep Dive
          </Text>
          <Text style={[styles.chatProgressText, { color: `${colors.text}66` }]}>
            14% done
          </Text>
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
            {chatMessages.map((message) => (
              <View
                key={message.id}
                style={[
                  styles.messageContainer,
                  message.isUser ? styles.userMessageContainer : styles.aiMessageContainer
                ]}
              >
                <View
                >
                  <Text
                    style={[
                      styles.messageText,
                      message.isUser
                        ? { color: `${colors.text}99` }
                        : { color: colors.text }
                    ]}
                  >
                    {message.text}
                  </Text>
                </View>

                {/* AI Chat Popup */}
                {!message.isUser && showPopupForMessage === message.id && (
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
              </View>
            ))}
            {isTyping && (
              <View style={[styles.messageContainer, styles.aiMessageContainer]}>
                <View style={[styles.messageBubble, { backgroundColor: `${colors.text}08` }]}>
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

        {/* Input - extends to screen bottom */}
        <View style={styles.chatInputContainer}>
          <View style={[
            styles.chatInputWrapper,
            {
              backgroundColor: colors.background,
              borderWidth: colorScheme === 'dark' ? 0 : 1,
              borderColor: colorScheme === 'dark' ? 'transparent' : '#E5E5E5',
              paddingBottom: Math.max(insets.bottom, 20) + 14, // Ensure minimum padding + safe area
              flexDirection: isRecording ? 'column' : 'row',
            }
          ]}>
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
              placeholder="Write how you think..."
              placeholderTextColor={`${colors.text}66`}
              multiline
              maxLength={500}
              returnKeyType="send"
              onSubmitEditing={handleSendMessage}
              cursorColor={colors.tint}
              editable={!isRecording}
            />

            {/* State 1: Empty input - show microphone */}
            {chatInput.trim().length === 0 && !isRecording && (
              // <TouchableOpacity
              //   style={[styles.microphoneButton, { backgroundColor: colors.text }]}
              //   onPress={handleMicrophonePress}
              // >
              //   <Ionicons
              //     name="mic"
              //     size={20}
              //     color={colors.background}
              //   />
              // </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sendButton, { backgroundColor: `${colors.tint}1A` }]}
                disabled={true}
              >
                <Ionicons
                  name="arrow-up"
                  size={20}
                  color={`${colors.tint}66`}
                />
              </TouchableOpacity>
            )}

            {/* State 2: Recording - show cancel (X) and confirm (checkmark) */}
            {/* {isRecording && (
              <View style={styles.recordingButtons}>
                <TouchableOpacity
                  style={[styles.recordingButton, { backgroundColor: `${colors.text}20` }]}
                  onPress={handleRecordingCancel}
                >
                  <Ionicons
                    name="close"
                    size={20}
                    color={colors.text}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.recordingButton, { backgroundColor: colors.text }]}
                  onPress={handleRecordingConfirm}
                >
                  <Ionicons
                    name="checkmark"
                    size={20}
                    color={colors.background}
                  />
                </TouchableOpacity>
              </View>
            )} */}

            {/* State 3: Text entered - show send button */}
            {chatInput.trim().length > 0 && !isRecording && (
              <TouchableOpacity
                style={[styles.sendButton, { backgroundColor: colors.text }]}
                onPress={handleSendMessage}
              >
                <Ionicons
                  name="arrow-up"
                  size={20}
                  color={colors.background}
                />
              </TouchableOpacity>
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
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    alignItems: 'center',
    gap: 4,
    borderBottomWidth: 1,
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
  },
  messagesList: {
    flex: 1,
    paddingTop: 20,
    zIndex: 0,
    overflow: 'visible'
  },
  messagesContent: {
    paddingBottom: 20,
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
    paddingHorizontal: 16,
    paddingVertical: 12,
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
  },
  chatInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 22,
    maxHeight: 120,
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
  recordingButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingTop: 8,
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
    opacity: 0.5,
  },
  aiPopupButtons: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 8,
  }
}); 