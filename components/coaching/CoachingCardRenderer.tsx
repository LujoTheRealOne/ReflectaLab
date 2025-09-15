import React, { Suspense, useMemo } from 'react';
import { View, Text, useColorScheme } from 'react-native';
import { ActionPlanCard, BlockersCard, CommitmentCard, FocusCard, InsightCard, JournalingPromptCard, LifeCompassUpdatedCard, MeditationCard, SessionSuggestionCard, ScheduledSessionCard, SessionCard, SessionEndCard } from '@/components/cards';
import { CoachingMessage } from '@/hooks/useAICoaching';
import { useAuth } from '@/hooks/useAuth';

// Types for coaching card components
export interface CoachingCardComponent {
  type: string;
  props: Record<string, string>;
}

export interface CoachingCardRendererProps {
  messages: CoachingMessage[];
  setMessages: (messages: CoachingMessage[]) => void;
  firebaseUser: any;
  getToken: () => Promise<string | null>;
  saveMessagesToFirestore: (messages: CoachingMessage[], userId: string) => Promise<void>;
}

// Function to parse coaching completion data between finish tokens
export const parseCoachingCompletion = (content: string) => {
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

// Function to parse coaching cards from any content - SAFE PARSING
export const parseCoachingCards = (content: string): CoachingCardComponent[] => {
  try {
    // Validate input
    if (!content || typeof content !== 'string') {
      return [];
    }

    // Parse component markers like [focus:focus="...",context="..."]
    const componentRegex = /\[(\w+):([^\]]+)\]/g;
    const components: Array<{ type: string; props: Record<string, string> }> = [];
    
    let match;
    let matchCount = 0;
    const maxMatches = 50; // Prevent infinite loops
    
    while ((match = componentRegex.exec(content)) !== null && matchCount < maxMatches) {
      matchCount++;
      
      try {
        const componentType = match[1];
        const propsString = match[2];
        
        // Validate component type
        if (!componentType || componentType.length === 0) {
          console.warn('🚨 [COACHING CARD] Invalid component type:', componentType);
          continue;
        }
        
        // Parse props from key="value" format
        const props: Record<string, string> = {};
        const propRegex = /(\w+)="([^"]+)"/g;
        let propMatch;
        let propCount = 0;
        const maxProps = 20; // Prevent infinite loops
        
        while ((propMatch = propRegex.exec(propsString)) !== null && propCount < maxProps) {
          propCount++;
          const [, key, value] = propMatch;
          if (key && value !== undefined) {
            props[key] = value;
          }
        }
        
        components.push({ type: componentType, props });
      } catch (innerError) {
        console.error('🚨 [COACHING CARD] Error parsing individual component:', innerError);
        continue; // Skip this component but continue with others
      }
    }
    
    if (matchCount >= maxMatches) {
      console.warn('🚨 [COACHING CARD] Reached maximum match limit, some components may be skipped');
    }
    
    return components;
  } catch (error) {
    console.error('🚨 [COACHING CARD] Error parsing coaching cards:', error);
    return []; // Return empty array instead of crashing
  }
};

// Function to clean message content by removing finish tokens and coaching cards
export const getDisplayContent = (content: string): string => {
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

// ✅ WEB PATTERN: Token update utility function
function updateTokenInContent(content: string, tokenType: string, tokenIndex: number, newState: string, additionalAttributes?: Record<string, string>): string {
  const tokenRegex = new RegExp(`\\[${tokenType}:([^\\]]+)\\]`, 'g');
  let occurrence = 0;
  
  return content.replace(tokenRegex, (match, attributesStr) => {
    if (occurrence !== tokenIndex) { 
      occurrence++; 
      return match; 
    }
    occurrence++;

    try {
      // Parse existing attributes
      const existingProps: Record<string, string> = {};
      const propRegex = /(\w+)="([^"]+)"/g;
      let propMatch;
      while ((propMatch = propRegex.exec(attributesStr)) !== null) {
        const [, k, v] = propMatch;
        existingProps[k] = v;
      }
      
      // Update state
      existingProps.state = newState;
      
      // Add additional attributes if provided
      if (additionalAttributes) {
        Object.assign(existingProps, additionalAttributes);
      }

      // Reconstruct token
      const newPropsString = Object.entries(existingProps)
        .map(([k, v]) => `${k}="${v}"`)
        .join(',');
      return `[${tokenType}:${newPropsString}]`;
    } catch (error) {
      console.warn('Failed to update token:', match, error);
      return match;
    }
  });
}

// Function to render a coaching card based on type and props
export const renderCoachingCard = (
  type: string, 
  props: Record<string, string>, 
  index: number, 
  hostMessageId: string | undefined,
  rendererProps: CoachingCardRendererProps,
  user: any, // ✅ HOOKS FIX: Pass user from parent to avoid hooks in function
  colorScheme: any // ✅ HOOKS FIX: Pass colorScheme from parent
) => {
  const { messages, setMessages, firebaseUser, getToken, saveMessagesToFirestore } = rendererProps;
  
  const baseProps = {
    key: `coaching-card-${type}-${index}`,
    editable: true, // Enable commitment card interactions
  };

  switch (type) {
    case 'meditation':
      return (
        <MeditationCard
          key={baseProps.key}
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
          key={baseProps.key}
          focus={focusText}
          context={contextText}
        />
      );
    case 'blockers':
      const blockers = props.items ? props.items.split('|').map((item: string) => item.trim()).filter(Boolean) : [];
      return (
        <BlockersCard
          key={baseProps.key}
          blockers={blockers}
          title={props.title}
        />
      );
    case 'actions':
      const actions = props.items ? props.items.split('|').map((item: string) => item.trim()).filter(Boolean) : [];
      return (
        <ActionPlanCard
          key={baseProps.key}
          actions={actions}
          title={props.title}
        />
      );
    case 'commitmentDetected': {
      // Web uses 'commitmentType' but mobile/backend uses 'type' - handle both for compatibility
      const commitmentType = props.commitmentType || props.type || 'one-time';
      
      return (
        <CommitmentCard
          key={baseProps.key}
          title={props.title || 'Commitment'}
          description={props.description || ''}
          type={(commitmentType as 'one-time' | 'recurring')}
          deadline={props.deadline}
          cadence={props.cadence}
          state={(props.state as 'none' | 'accepted' | 'rejected') || 'none'}
          commitmentId={props.commitmentId}
          editable={baseProps.editable}
          onUpdate={async (data) => {
            console.log('🎯 CommitmentCard onUpdate called:', data);
            
            const userId = user?.id || firebaseUser?.uid;
            if (!userId) {
              console.error('❌ No authenticated user for commitment update');
              throw new Error('User not authenticated');
            }

            try {
              // ✅ WEB PATTERN: Handle accept vs reject differently
              
              if (data.state === 'accepted') {
                console.log('🟢 Processing acceptance...');
                
                // Get auth token
                const token = await getToken();
                if (!token) {
                  console.error('❌ No auth token available');
                  throw new Error('No auth token available');
                }

                // Call API to create commitment
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
                    type: commitmentType,
                    deadline: props.deadline,
                    cadence: props.cadence,
                    coachingSessionId: userId,
                    messageId: hostMessageId || `msg_${Date.now()}`
                  }),
                });

                if (!response.ok) {
                  const errorText = await response.text();
                  console.error('❌ API call failed:', {
                    status: response.status,
                    error: errorText
                  });
                  throw new Error(`API call failed: ${response.status}`);
                }

                const result = await response.json();
                console.log('✅ Commitment created successfully:', result);
                
                // ✅ WEB PATTERN: Update message with accepted state and commitmentId
                const updatedMessages = messages.map((message) => {
                  if (message.role !== 'assistant') return message;
                  if (hostMessageId && message.id !== hostMessageId) return message;

                  const updatedContent = updateTokenInContent(
                    message.content, 
                    'commitmentDetected', 
                    index, 
                    'accepted',
                    result.commitment?.id ? { commitmentId: result.commitment.id } : undefined
                  );
                  
                  return { ...message, content: updatedContent };
                });

                // Update local state and save to Firestore
                setMessages(updatedMessages);
                await saveMessagesToFirestore(updatedMessages, userId);
                console.log('✅ Message updated with accepted state');
                
              } else if (data.state === 'rejected') {
                console.log('🔴 Processing rejection...');
                
                // ✅ WEB PATTERN: Rejection just updates message content (no API call)
                const updatedMessages = messages.map((message) => {
                  if (message.role !== 'assistant') return message;
                  if (hostMessageId && message.id !== hostMessageId) return message;

                  const updatedContent = updateTokenInContent(
                    message.content, 
                    'commitmentDetected', 
                    index, 
                    'rejected'
                  );
                  
                  return { ...message, content: updatedContent };
                });

                // Update local state and save to Firestore
                setMessages(updatedMessages);
                await saveMessagesToFirestore(updatedMessages, userId);
                console.log('✅ Message updated with rejected state');
              }
              
              console.log('✅ Commitment update completed successfully');
            } catch (error) {
              console.error('❌ Failed to update commitment:', error);
              throw error; // Re-throw so CommitmentCard can handle the error
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
            console.log('✅ Session scheduled callback:', { sessionTitle, duration, dateTime });
          }}
          onDismiss={(sessionTitle) => {
            console.log('✅ Session dismissed callback:', sessionTitle);
          }}
          onStateChange={async (newState, additionalData) => {
            console.log('🎯 SessionSuggestion onStateChange:', { newState, additionalData });
            
            const userId = user?.id || firebaseUser?.uid;
            if (!userId) {
              console.error('❌ No authenticated user for session suggestion update');
              throw new Error('User not authenticated');
            }

            try {
              // ✅ WEB PATTERN: Handle schedule vs dismiss differently
              
              if (newState === 'scheduled') {
                console.log('📅 Processing session scheduling...');
                
                // For scheduled state, the API call was already made by SessionSuggestionCard
                // Just update the message content with the new state and additional data
                const updatedMessages = messages.map((message) => {
                  if (message.role !== 'assistant') return message;
                  if (hostMessageId && message.id !== hostMessageId) return message;

                  const updatedContent = updateTokenInContent(
                    message.content, 
                    'sessionSuggestion', 
                    index, 
                    'scheduled',
                    additionalData ? Object.fromEntries(
                      Object.entries({
                        scheduledDate: additionalData.scheduledDate,
                        scheduledTime: additionalData.scheduledTime
                      }).filter(([, value]) => value !== undefined)
                    ) as Record<string, string> : undefined
                  );
                  
                  return { ...message, content: updatedContent };
                });

                // Update local state and save to Firestore
                setMessages(updatedMessages);
                await saveMessagesToFirestore(updatedMessages, userId);
                console.log('✅ Message updated with scheduled state');
                
              } else if (newState === 'dismissed') {
                console.log('🔴 Processing session dismissal...');
                
                // ✅ WEB PATTERN: Dismissal just updates message content (no API call)
                const updatedMessages = messages.map((message) => {
                  if (message.role !== 'assistant') return message;
                  if (hostMessageId && message.id !== hostMessageId) return message;

                  const updatedContent = updateTokenInContent(
                    message.content, 
                    'sessionSuggestion', 
                    index, 
                    'dismissed'
                  );
                  
                  return { ...message, content: updatedContent };
                });

                // Update local state and save to Firestore
                setMessages(updatedMessages);
                await saveMessagesToFirestore(updatedMessages, userId);
                console.log('✅ Message updated with dismissed state');
              }
              
              console.log('✅ SessionSuggestion update completed successfully');
            } catch (error) {
              console.error('❌ Failed to update session suggestion:', error);
              throw error; // Re-throw so SessionSuggestionCard can handle the error
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
              await saveMessagesToFirestore(updatedMessages, firebaseUser!.uid);
              console.log('✅ Session token replaced with sessionCard token and saved to Firestore');
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
    case 'journalingPrompt': {
      return (
        <JournalingPromptCard
          key={baseProps.key}
          journalingPrompt={{
            type: 'journalingPrompt',
            prompt: props.prompt || 'Reflect on your day',
            context: props.context
          }}
          onStartJournaling={(prompt) => {
            console.log('✅ Journaling started:', prompt.substring(0, 50) + '...');
          }}
          onDismiss={(prompt) => {
            console.log('✅ Journaling prompt dismissed:', prompt.substring(0, 50) + '...');
          }}
          onStateChange={async (newState) => {
            console.log('🎯 JournalingPrompt state change:', { newState });
            
            const userId = user?.id || firebaseUser?.uid;
            if (!userId) {
              console.error('❌ No authenticated user for journaling prompt update');
              return;
            }

            try {
              // ✅ WEB PATTERN: Update message content with new state
              const updatedMessages = messages.map((message) => {
                if (message.role !== 'assistant') return message;
                if (hostMessageId && message.id !== hostMessageId) return message;

                const updatedContent = updateTokenInContent(
                  message.content, 
                  'journalingPrompt', 
                  index, 
                  newState
                );
                
                return { ...message, content: updatedContent };
              });

              // Update local state and save to Firestore
              setMessages(updatedMessages);
              await saveMessagesToFirestore(updatedMessages, userId);
              console.log('✅ JournalingPrompt state updated in Firestore');
              
            } catch (error) {
              console.error('❌ Failed to update journaling prompt state:', error);
            }
          }}
        />
      );
    }
    case 'lifeCompassUpdated': {
      return (
        <LifeCompassUpdatedCard
          key={baseProps.key}
          data={{
            type: 'lifeCompassUpdated'
          }}
        />
      );
    }
    case 'sessionEnd': {
      return (
        <SessionEndCard
          key={baseProps.key}
          data={{
            type: 'sessionEnd',
            title: props.title,
            message: props.message
          }}
          onCompleteSession={async () => {
            console.log('🎯 SessionEnd completion requested');
            
            // This callback should be provided by the parent component
            // For now, we'll just log it - the actual completion logic
            // should be handled by the parent (e.g., OnboardingChatScreen)
            
            // In a real implementation, this might:
            // 1. Complete the current session
            // 2. Navigate to compass results
            // 3. Trigger insight extraction
            // 4. Update user onboarding status
            
            console.log('🎯 SessionEnd completion logic should be implemented by parent component');
          }}
        />
      );
    }
    case 'checkin':
      // Check-in cards are handled by the scheduling popup system
      return null;
    default:
      return (
        <View key={baseProps.key} style={{
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

// Main CoachingCardRenderer component
export const CoachingCardRenderer: React.FC<{
  message: CoachingMessage;
  rendererProps: CoachingCardRendererProps;
}> = ({ message, rendererProps }) => {
  // ✅ HOOKS FIX: Move all hooks to the top level of the component
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  
  if (message.role !== 'assistant') return null;
  
  // ✅ PERFORMANCE FIX: Memoize parsing to prevent render loops
  const coachingCards = useMemo(() => {
    return parseCoachingCards(message.content);
  }, [message.content]);
  
  if (coachingCards.length === 0) return null;
  
  return (
    <View style={{ marginTop: 8, marginBottom: 16 }}>
      {coachingCards.map((card, index) => {
        try {
          return renderCoachingCard(card.type, card.props, index, message.id, rendererProps, user, colorScheme);
        } catch (error) {
          console.error('🚨 [COACHING CARD] Error rendering card:', card.type, error);
          return (
            <View key={`error-${index}`} style={{ padding: 8, backgroundColor: '#fee', borderRadius: 4 }}>
              <Text style={{ color: '#666', fontSize: 12 }}>
                Card rendering error: {card.type}
              </Text>
            </View>
          );
        }
      })}
    </View>
  );
};