import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/hooks/useAuth';

interface SessionToken {
  type: 'session';
  title: string;
  goal: string;
  duration: string;
  question: string;
  scheduledSessionId?: string;
}

interface ScheduledSessionCardProps {
  session: SessionToken;
  coachingSessionId?: string;
  messageId?: string;
  onDurationChange?: (newDuration: string) => void;
  onStartSession?: (sessionTitle: string, duration: string, question: string, scheduledSessionId?: string) => void;
  onReplaceWithSessionCard?: (sessionCardContent: string) => void;
}

const DURATION_OPTIONS = ['15m', '30m', '45m', '60m', '90m'];

export default function ScheduledSessionCard({ 
  session, 
  coachingSessionId, 
  messageId, 
  onDurationChange, 
  onStartSession, 
  onReplaceWithSessionCard 
}: ScheduledSessionCardProps) {
  const navigation = useNavigation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { firebaseUser, getToken } = useAuth();

  const [selectedDuration, setSelectedDuration] = useState(session.duration);
  const [cardState, setCardState] = useState<'default' | 'started'>('default');
  const [isLoading, setIsLoading] = useState(false);

  const handleDurationChange = (newDuration: string) => {
    setSelectedDuration(newDuration);
    onDurationChange?.(newDuration);
  };

  const handleStartSession = async () => {
    if (isLoading || !firebaseUser?.uid) return;
    
    setIsLoading(true);
    
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      const token = await getToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

      // Generate unique session ID
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      
      console.log('🎯 Starting breakout session:', {
        sessionId,
        title: session.title,
        goal: session.goal,
        duration: selectedDuration,
        question: session.question,
        parentSessionId: coachingSessionId,
        scheduledSessionId: session.scheduledSessionId
      });

      // Create new breakout session in Firestore with initial message
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}api/coaching/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          sessionId: sessionId,
          sessionType: 'default-session',
          parentSessionId: coachingSessionId || 'main', // Link to main chat
          title: session.title,
          goal: session.goal,
          duration: selectedDuration,
          initialQuestion: session.question,
          scheduledSessionId: session.scheduledSessionId // Pass the scheduled session ID to mark as completed
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create breakout session: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ Breakout session created successfully:', result);

      // Generate session card content to replace this scheduled session card
      const sessionCardContent = `[sessionCard:title="${session.title}",sessionId="${sessionId}",duration="${selectedDuration}",question="${session.question}",goal="${session.goal}"]`;
      
      // Replace the scheduled session card with session card in the message
      if (onReplaceWithSessionCard) {
        onReplaceWithSessionCard(sessionCardContent);
      }

      // Navigate to breakout session
      Alert.alert(
        'Session Started',
        `${session.title} has been created!`,
        [
          {
            text: 'Continue',
            onPress: () => {
              // @ts-ignore - Navigation will be properly typed
              navigation.navigate('BreakoutSession', { 
                sessionId, 
                title: session.title, 
                goal: session.goal 
              });
              console.log('🎯 Navigating to breakout session:', sessionId);
            }
          }
        ]
      );
      
      // Update card state and trigger callback
      setCardState('started');
      onStartSession?.(session.title, selectedDuration, session.question, session.scheduledSessionId);

    } catch (error) {
      console.error('❌ Error starting breakout session:', error);
      Alert.alert(
        'Error',
        'Failed to start session. Please try again.',
        [{ text: 'OK', style: 'default' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (cardState === 'started') {
    return (
      <View style={[
        styles.container, 
        { 
          backgroundColor: colors.background,
          shadowColor: colorScheme === 'dark' ? '#FFFFFF' : '#000000',
          shadowOpacity: colorScheme === 'dark' ? 0.08 : 0.12,
        }
      ]}>
        <View style={styles.header}>
          <Text style={[styles.badge, { color: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.40)' }]}>
            Scheduled Session
          </Text>
          <Text style={[styles.title, { color: colors.text }]}>
            Session started
          </Text>
        </View>

        <View style={[styles.infoContainer, { backgroundColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : '#F2F2F2' }]}>
          <Text style={[styles.infoText, { color: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.60)' }]}>
            Started: <Text style={styles.infoBold}>{session.title} ({selectedDuration})</Text>
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[
      styles.container, 
      { 
        backgroundColor: colors.background,
        shadowColor: colorScheme === 'dark' ? '#FFFFFF' : '#000000',
        shadowOpacity: colorScheme === 'dark' ? 0.08 : 0.12,
      }
    ]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.badge, { color: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.40)' }]}>
          Scheduled Session
        </Text>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
          {session.title}
        </Text>
        <Text style={[styles.description, { color: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.60)' }]} numberOfLines={3}>
          {session.goal}
        </Text>
      </View>

      {/* Duration Selection */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.60)' }]}>
          Suggested duration: {selectedDuration}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.optionsContainer}>
          {DURATION_OPTIONS.map((duration) => (
            <TouchableOpacity
              key={duration}
              style={[
                styles.optionButton,
                selectedDuration === duration 
                  ? { backgroundColor: colorScheme === 'dark' ? '#FFFFFF' : '#000000' }
                  : { backgroundColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : '#F2F2F2' }
              ]}
              onPress={() => handleDurationChange(duration)}
            >
              <Text style={[
                styles.optionText,
                selectedDuration === duration 
                  ? { color: colorScheme === 'dark' ? 'rgba(0, 0, 0, 0.91)' : 'rgba(255, 255, 255, 0.91)' }
                  : { color: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.60)' }
              ]}>
                {duration}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Action Button */}
      <TouchableOpacity
        style={[
          styles.button,
          { 
            backgroundColor: isLoading 
              ? (colorScheme === 'dark' ? '#666666' : '#CCCCCC')
              : (colorScheme === 'dark' ? '#FFFFFF' : '#000000'),
            opacity: isLoading ? 0.6 : 1
          }
        ]}
        onPress={handleStartSession}
        disabled={isLoading}
      >
        <Text style={[styles.buttonText, { color: colorScheme === 'dark' ? 'rgba(0, 0, 0, 0.91)' : 'rgba(255, 255, 255, 0.91)' }]}>
          {isLoading ? 'Creating session...' : `Start Session (${selectedDuration})`}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
    padding: 20,
    borderRadius: 16,
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 2,
  },
  header: {
    marginBottom: 12,
  },
  badge: {
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 16,
    marginBottom: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
    marginBottom: 6,
  },
  description: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
  },
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 16,
    marginBottom: 8,
  },
  optionsContainer: {
    flexDirection: 'row',
  },
  optionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 8,
  },
  optionText: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  button: {
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  infoContainer: {
    padding: 12,
    borderRadius: 12,
    marginTop: 4,
  },
  infoText: {
    fontSize: 11,
    fontWeight: '400',
    lineHeight: 16,
  },
  infoBold: {
    fontWeight: '500',
  },
});
