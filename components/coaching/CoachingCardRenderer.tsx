import React from 'react';
import { View, Text, useColorScheme } from 'react-native';
import { ActionPlanCard, BlockersCard, CommitmentCard, FocusCard, InsightCard, MeditationCard, SessionSuggestionCard, ScheduledSessionCard, SessionCard } from '@/components/cards';
import { CoachingMessage } from '@/hooks/useAICoaching';

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

// Function to parse coaching cards from any content
export const parseCoachingCards = (content: string): CoachingCardComponent[] => {
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

// Function to render a coaching card based on type and props
export const renderCoachingCard = (
  type: string, 
  props: Record<string, string>, 
  index: number, 
  hostMessageId: string | undefined,
  rendererProps: CoachingCardRendererProps
) => {
  const { messages, setMessages, firebaseUser, getToken, saveMessagesToFirestore } = rendererProps;
  const colorScheme = useColorScheme();
  
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
      // IMPORTANT: Always start commitments in 'none' state to require user confirmation
      // LLM sometimes sends state='accepted' directly, but we need user interaction
      // Only keep 'accepted'/'rejected' if there's a valid commitmentId (meaning user already confirmed)
      const isValidCommitmentId = (id: string | undefined): boolean => {
        if (!id) return false;
        // Valid commitmentId should be from our API, not LLM-generated
        // LLM often generates fake IDs like "commitment_1757635966483"
        // Real IDs from API are different format
        return id.startsWith('commitment_') && 
               id.length > 20 && // Real IDs are longer
               !id.includes('1757635966483') && // Filter specific fake ID
               !id.match(/commitment_\d{13}$/); // Filter timestamp-based fake IDs
      };
      
      const hasValidCommitmentId = isValidCommitmentId(props.commitmentId);
      const normalizedState = hasValidCommitmentId 
        ? ((props.state as 'none' | 'accepted' | 'rejected') || 'none')
        : 'none'; // Always start fresh commitments in 'none' state
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
          commitmentId={hasValidCommitmentId ? props.commitmentId : undefined}
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
              
              // 3. If accepted, create commitment via API first, then save with commitmentId
              let finalMessages = updatedMessages;
              if (data.state === 'accepted') {
                const token = await getToken();
                if (!token) {
                  console.error('❌ No auth token available');
                  return;
                }

                // Check if commitment already exists in backend to prevent duplicates
                console.log('🔍 Checking for existing commitment in backend...');
                try {
                  const checkResponse = await fetch(`${process.env.EXPO_PUBLIC_API_URL}api/coaching/commitments/checkin`, {
                    method: 'GET',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${token}`,
                    },
                  });

                  if (checkResponse.ok) {
                    const checkData = await checkResponse.json();
                    const existingCommitments = checkData.commitments || [];
                    
                    // Check if commitment with same title, description, and type already exists
                    const existingCommitment = existingCommitments.find((c: any) => 
                      c.title === props.title && 
                      c.description === props.description && 
                      c.type === props.type
                    );
                    
                    if (existingCommitment) {
                      console.log('✅ Commitment already exists in backend, using existing ID:', existingCommitment.id);
                      
                      // Update message with existing commitmentId
                      finalMessages = updatedMessages.map((message) => {
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
                          existingProps.commitmentId = existingCommitment.id;

                          const newPropsString = Object.entries(existingProps)
                            .map(([k, v]) => `${k}="${v}"`)
                            .join(',');
                          return `[commitmentDetected:${newPropsString}]`;
                        });
                        return { ...message, content: updatedContent };
                      });
                      
                      setMessages(finalMessages);
                      console.log('✅ Updated message with existing commitmentId');
                      
                      // Skip API creation since commitment already exists
                      await saveMessagesToFirestore(finalMessages, firebaseUser.uid);
                      console.log('✅ Commitment update completed successfully (existing commitment)');
                      return;
                    }
                  }
                } catch (checkError) {
                  console.warn('⚠️ Error checking existing commitments:', checkError);
                  // Continue with creation if check fails
                }

                console.log('🔥 Creating new commitment via API...');
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
                  
                  // Update the message content with the returned commitmentId
                  if (result.commitmentId) {
                    console.log('🔄 Updating message with commitmentId:', result.commitmentId);
                    
                    // Update the already updated messages with commitmentId
                    finalMessages = updatedMessages.map((message) => {
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
                        existingProps.commitmentId = result.commitmentId;

                        const newPropsString = Object.entries(existingProps)
                          .map(([k, v]) => `${k}="${v}"`)
                          .join(',');
                        return `[commitmentDetected:${newPropsString}]`;
                      });
                      return { ...message, content: updatedContent };
                    });
                    
                    // Update messages state with final version (state + commitmentId)
                    setMessages(finalMessages);
                    
                    console.log('✅ Message updated with commitmentId');
                  }
                } else {
                  const errorText = await response.text();
                  console.error('❌ Failed to create commitment:', {
                    status: response.status,
                    error: errorText
                  });
                }
              }
              
              // 4. Save final messages to Firestore (with or without commitmentId)
              await saveMessagesToFirestore(finalMessages, firebaseUser.uid);
              
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
              
              // Update messages state
              setMessages(updatedMessages);
              
              // Save to Firestore
              await saveMessagesToFirestore(updatedMessages, firebaseUser!.uid);
              
              console.log('✅ SessionSuggestion state updated and saved to Firestore');
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

// Main CoachingCardRenderer component
export const CoachingCardRenderer: React.FC<{
  message: CoachingMessage;
  rendererProps: CoachingCardRendererProps;
}> = ({ message, rendererProps }) => {
  if (message.role !== 'assistant') return null;
  
  const coachingCards = parseCoachingCards(message.content);
  
  if (coachingCards.length === 0) return null;
  
  return (
    <View style={{ marginTop: 8, marginBottom: 16 }}>
      {coachingCards.map((card, index) => 
        renderCoachingCard(card.type, card.props, index, message.id, rendererProps)
      )}
    </View>
  );
};
