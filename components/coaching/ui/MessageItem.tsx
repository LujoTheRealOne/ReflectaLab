import React, { memo } from 'react';
import { View, Text, ColorSchemeName, StyleSheet } from 'react-native';
import { CoachingMessage } from '@/hooks/useAICoaching';
import { CoachingCardRenderer, CoachingCardRendererProps, getDisplayContent } from '@/components/coaching/CoachingCardRenderer';
import { Button } from '@/components/ui/Button';

interface MessageItemProps {
  message: CoachingMessage;
  colorScheme: ColorSchemeName;
  coachingCardRendererProps: CoachingCardRendererProps;
  showCompletionForMessage: string | null;
  messageRefs: React.MutableRefObject<{ [key: string]: any }>;
  completionStats: {
    minutes: number;
    words: number;
    keyInsights: number;
  };
  colors: any;
  styles: any;
  onCompletionAction: () => void;
}

export const MessageItem = memo(({ 
  message, 
  colorScheme, 
  coachingCardRendererProps, 
  showCompletionForMessage,
  messageRefs,
  completionStats,
  colors,
  styles,
  onCompletionAction
}: MessageItemProps) => {
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
        <CoachingCardRenderer 
          message={message} 
          rendererProps={coachingCardRendererProps} 
        />
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
                onPress={onCompletionAction}
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
});
