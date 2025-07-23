import React, { useState, useRef, useEffect } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, useColorScheme, Alert } from 'react-native';
import { ChatMessage, AIMode, CoachingInteractionRequest } from '@/types/coaching';
import aiCoachingService from '@/services/aiCoachingService';

interface AIChatInterfaceProps {
  isVisible: boolean;
  mode: AIMode;
  context: string;
  entryId: string;
  onClose: () => void;
  onInsertCoachingBlock?: (content: string, variant: 'text' | 'buttons' | 'multi-select', options?: string[], thinking?: string) => void;
}

const modeLabels = {
  'dive-deeper': 'Dive Deeper',
  'reflect-back': 'Reflect Back',
  'scrutinize-thinking': 'Scrutinize Thinking'
};

const modeDescriptions = {
  'dive-deeper': "I'm here to help you explore your thoughts more deeply. What aspect of your journal entry resonates most with you?",
  'reflect-back': "Let me offer some reflections on what you've written. I'm curious about the patterns and insights I notice in your thoughts.",
  'scrutinize-thinking': "I'm here to help you examine your thinking more critically. Let's dig into the assumptions and reasoning behind your ideas."
};

export default function AIChatInterface({ isVisible, mode, context, entryId, onClose, onInsertCoachingBlock }: AIChatInterfaceProps) {
  const colorScheme = useColorScheme();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const isDark = colorScheme === 'dark';
  const styles = createStyles(isDark);

  // Initialize chat with welcome message
  useEffect(() => {
    if (isVisible && mode && messages.length === 0) {
      const welcomeMessage: ChatMessage = {
        id: 'welcome',
        role: 'assistant',
        content: modeDescriptions[mode],
        timestamp: new Date()
      };
      setMessages([welcomeMessage]);
    }
  }, [isVisible, mode, messages.length]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Generate AI response
      const request: CoachingInteractionRequest = {
        entryId,
        entryContent: context
      };

      const response = await aiCoachingService.generateCoachingResponse(request);

      if (response.success && response.coachingBlock) {
        const aiMessage: ChatMessage = {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: response.coachingBlock.content,
          timestamp: new Date()
        };

        setMessages(prev => [...prev, aiMessage]);

        // If there's a callback to insert coaching block, offer it as an option
        if (onInsertCoachingBlock && (response.coachingBlock.variant === 'buttons' || response.coachingBlock.variant === 'multi-select')) {
          setTimeout(() => {
            Alert.alert(
              'Insert Coaching Block',
              'Would you like to insert this as an interactive coaching block in your journal?',
              [
                { text: 'No', style: 'cancel' },
                { 
                  text: 'Yes', 
                  onPress: () => onInsertCoachingBlock(
                    response.coachingBlock!.content,
                    response.coachingBlock!.variant as 'text' | 'buttons' | 'multi-select',
                    response.coachingBlock!.options,
                    response.coachingBlock!.thinking
                  )
                }
              ]
            );
          }, 1000);
        }
      } else {
        throw new Error(response.error || 'Failed to generate AI response');
      }

    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: "I'm sorry, I'm having trouble responding right now. Please try again.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isVisible) return null;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{modeLabels[mode]}</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>×</Text>
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <ScrollView 
        ref={scrollViewRef}
        style={styles.messagesContainer}
        showsVerticalScrollIndicator={false}
      >
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            isDark={isDark}
          />
        ))}
        {isLoading && (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Thinking...</Text>
          </View>
        )}
      </ScrollView>

      {/* Input */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          value={input}
          onChangeText={setInput}
          placeholder="Type your message..."
          placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
          multiline
          maxLength={500}
          onSubmitEditing={sendMessage}
          blurOnSubmit={false}
        />
        <TouchableOpacity 
          onPress={sendMessage}
          style={[styles.sendButton, (!input.trim() || isLoading) && styles.sendButtonDisabled]}
          disabled={!input.trim() || isLoading}
        >
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

interface MessageBubbleProps {
  message: ChatMessage;
  isDark: boolean;
}

function MessageBubble({ message, isDark }: MessageBubbleProps) {
  const styles = createStyles(isDark);
  const isUser = message.role === 'user';

  return (
    <View style={[styles.messageContainer, isUser ? styles.userMessageContainer : styles.aiMessageContainer]}>
      <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.aiBubble]}>
        <Text style={[styles.messageText, isUser ? styles.userText : styles.aiText]}>
          {message.content}
        </Text>
      </View>
    </View>
  );
}

const createStyles = (isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
    borderRadius: 12,
    margin: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: isDark ? '#374151' : '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: isDark ? '#4B5563' : '#E5E7EB',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: isDark ? '#F3F4F6' : '#1F2937',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: isDark ? '#4B5563' : '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: isDark ? '#F3F4F6' : '#6B7280',
    fontWeight: '600',
  },
  messagesContainer: {
    flex: 1,
    padding: 16,
  },
  messageContainer: {
    marginBottom: 12,
  },
  userMessageContainer: {
    alignItems: 'flex-end',
  },
  aiMessageContainer: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 12,
  },
  userBubble: {
    backgroundColor: '#3B82F6',
  },
  aiBubble: {
    backgroundColor: isDark ? '#374151' : '#F3F4F6',
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  userText: {
    color: '#FFFFFF',
  },
  aiText: {
    color: isDark ? '#F3F4F6' : '#1F2937',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  loadingText: {
    fontSize: 14,
    color: isDark ? '#9CA3AF' : '#6B7280',
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: isDark ? '#374151' : '#F9FAFB',
    borderTopWidth: 1,
    borderTopColor: isDark ? '#4B5563' : '#E5E7EB',
    alignItems: 'flex-end',
  },
  textInput: {
    flex: 1,
    backgroundColor: isDark ? '#4B5563' : '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: isDark ? '#F3F4F6' : '#1F2937',
    maxHeight: 100,
    marginRight: 8,
    borderWidth: 1,
    borderColor: isDark ? '#6B7280' : '#D1D5DB',
  },
  sendButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: isDark ? '#4B5563' : '#D1D5DB',
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
}); 