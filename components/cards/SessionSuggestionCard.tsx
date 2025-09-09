import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/hooks/useAuth';

interface SessionSuggestionToken {
  type: 'sessionSuggestion';
  title: string;
  reason: string;
  duration: string;
  state?: 'none' | 'scheduled' | 'dismissed';
  scheduledDate?: string;
  scheduledTime?: string;
  scheduledSessionId?: string;
}

interface SessionSuggestionCardProps {
  sessionSuggestion: SessionSuggestionToken;
  coachingSessionId: string;
  messageId: string;
  onSchedule?: (sessionTitle: string, duration: string, dateTime: string) => void;
  onDismiss?: (sessionTitle: string) => void;
  onStateChange?: (newState: 'scheduled' | 'dismissed', additionalData?: { scheduledDate?: string; scheduledTime?: string }) => void;
}

export default function SessionSuggestionCard({ 
  sessionSuggestion, 
  coachingSessionId, 
  messageId, 
  onSchedule, 
  onDismiss, 
  onStateChange 
}: SessionSuggestionCardProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { firebaseUser, getToken } = useAuth();

  const [selectedDuration, setSelectedDuration] = useState(sessionSuggestion.duration);
  const [selectedDate, setSelectedDate] = useState(sessionSuggestion.scheduledDate || '');
  const [selectedTime, setSelectedTime] = useState(sessionSuggestion.scheduledTime || '');
  
  const getInitialState = (): 'default' | 'scheduled' | 'dismissed' => {
    switch (sessionSuggestion.state) {
      case 'scheduled': return 'scheduled';
      case 'dismissed': return 'dismissed';
      case 'none':
      default: return 'default';
    }
  };
  
  const [cardState, setCardState] = useState<'default' | 'scheduled' | 'dismissed'>(getInitialState());
  const [isLoading, setIsLoading] = useState(false);

  // Update cardState when sessionSuggestion.state changes
  useEffect(() => {
    const newState = (() => {
      switch (sessionSuggestion.state) {
        case 'scheduled': return 'scheduled';
        case 'dismissed': return 'dismissed';
        case 'none':
        default: return 'default';
      }
    })();
    setCardState(newState);
  }, [sessionSuggestion.state]);

  const durations = ['15m', '30m', '45m', '60m', '90m'];

  // Generate next 7 days for date options
  const getDateOptions = () => {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      const value = date.toISOString().split('T')[0]; // YYYY-MM-DD format
      const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      dates.push({ value, label });
    }
    return dates;
  };

  // Generate time slots (9 AM to 5:30 PM)
  const getTimeOptions = () => {
    const times = [];
    for (let hour = 9; hour <= 17; hour++) {
      times.push({
        value: `${hour.toString().padStart(2, '0')}:00`,
        label: `${hour > 12 ? hour - 12 : hour}:00 ${hour >= 12 ? 'PM' : 'AM'}`
      });
      if (hour < 17) {
        times.push({
          value: `${hour.toString().padStart(2, '0')}:30`,
          label: `${hour > 12 ? hour - 12 : hour}:30 ${hour >= 12 ? 'PM' : 'AM'}`
        });
      }
    }
    return times;
  };

  const handleSchedule = async () => {
    if (isLoading || !selectedDate || !selectedTime || !firebaseUser?.uid) return;
    
    setIsLoading(true);
    
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      const token = await getToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

      // Convert duration string to number (e.g., "60m" -> 60)
      const durationNumber = parseInt(selectedDuration.replace('m', ''));
      
      // Create ISO datetime string
      const scheduledDateTime = new Date(`${selectedDate}T${selectedTime}:00`).toISOString();
      
      console.log('🎯 Scheduling session:', {
        title: sessionSuggestion.title,
        duration: durationNumber,
        scheduledFor: scheduledDateTime,
        coachingSessionId,
        messageId
      });

      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}api/coaching/sessions/schedule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: sessionSuggestion.title,
          reason: sessionSuggestion.reason,
          duration: durationNumber,
          scheduledFor: scheduledDateTime,
          coachingSessionId,
          messageId
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to schedule session: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ Session scheduled successfully:', result);

      // Update card state
      setCardState('scheduled');
      
      // Call callbacks
      onSchedule?.(sessionSuggestion.title, selectedDuration, scheduledDateTime);
      onStateChange?.('scheduled', { 
        scheduledDate: selectedDate, 
        scheduledTime: selectedTime 
      });

    } catch (error) {
      console.error('❌ Error scheduling session:', error);
      Alert.alert(
        'Error',
        'Failed to schedule session. Please try again.',
        [{ text: 'OK', style: 'default' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleDismiss = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      setCardState('dismissed');
      onDismiss?.(sessionSuggestion.title);
      onStateChange?.('dismissed');
      
    } catch (error) {
      console.error('❌ Error dismissing session:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Set default date and time if not selected
  useEffect(() => {
    if (!selectedDate) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setSelectedDate(tomorrow.toISOString().split('T')[0]);
    }
    if (!selectedTime) {
      setSelectedTime('10:00');
    }
  }, []);

  if (cardState === 'scheduled') {
    return (
      <View style={[styles.container, { backgroundColor: '#FFFFFF' }]}>
        <View style={styles.header}>
          <Text style={[styles.badge, { color: 'rgba(0, 0, 0, 0.40)' }]}>
            Session Suggestion
          </Text>
          <Text style={[styles.title, { color: '#262626' }]}>
            Session scheduled
          </Text>
        </View>

        <View style={[styles.scheduledInfo, { backgroundColor: '#F2F2F2' }]}>
          <Text style={[styles.scheduledText, { color: 'rgba(0, 0, 0, 0.60)' }]}>
            Scheduled: <Text style={styles.scheduledBold}>{sessionSuggestion.title}</Text>
          </Text>
          {selectedDate && selectedTime && (
            <Text style={[styles.scheduledText, { color: 'rgba(0, 0, 0, 0.60)' }]}>
              {new Date(`${selectedDate}T${selectedTime}`).toLocaleDateString('en-US', { 
                weekday: 'long', 
                month: 'short', 
                day: 'numeric' 
              })} at {new Date(`${selectedDate}T${selectedTime}`).toLocaleTimeString('en-US', { 
                hour: 'numeric', 
                minute: '2-digit' 
              })}
            </Text>
          )}
        </View>
      </View>
    );
  }

  if (cardState === 'dismissed') {
    return (
      <View style={[styles.container, { backgroundColor: '#FFFFFF' }]}>
        <View style={styles.header}>
          <Text style={[styles.badge, { color: 'rgba(0, 0, 0, 0.40)' }]}>
            Session Suggestion
          </Text>
          <Text style={[styles.title, { color: '#262626' }]}>
            Suggestion dismissed
          </Text>
        </View>

        <View style={[styles.scheduledInfo, { backgroundColor: '#F2F2F2' }]}>
          <Text style={[styles.scheduledText, { color: 'rgba(0, 0, 0, 0.60)' }]}>
            Dismissed: <Text style={styles.scheduledBold}>{sessionSuggestion.title}</Text>
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: '#FFFFFF' }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.badge, { color: 'rgba(0, 0, 0, 0.40)' }]}>
          Session Suggestion
        </Text>
        <Text style={[styles.title, { color: '#262626' }]} numberOfLines={2}>
          {sessionSuggestion.title}
        </Text>
        <Text style={[styles.reason, { color: 'rgba(0, 0, 0, 0.60)' }]} numberOfLines={3}>
          {sessionSuggestion.reason}
        </Text>
      </View>

      {/* Duration Selection */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: 'rgba(0, 0, 0, 0.60)' }]}>
          Duration: {selectedDuration}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.optionsContainer}>
          {durations.map((duration) => (
            <TouchableOpacity
              key={duration}
              style={[
                styles.optionButton,
                selectedDuration === duration 
                  ? { backgroundColor: '#000000' }
                  : { backgroundColor: '#F2F2F2' }
              ]}
              onPress={() => setSelectedDuration(duration)}
            >
              <Text style={[
                styles.optionText,
                selectedDuration === duration 
                  ? { color: 'rgba(255, 255, 255, 0.91)' }
                  : { color: 'rgba(0, 0, 0, 0.60)' }
              ]}>
                {duration}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Date Selection */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: 'rgba(0, 0, 0, 0.60)' }]}>
          Date
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.optionsContainer}>
          {getDateOptions().map((date) => (
            <TouchableOpacity
              key={date.value}
              style={[
                styles.optionButton,
                selectedDate === date.value 
                  ? { backgroundColor: '#000000' }
                  : { backgroundColor: '#F2F2F2' }
              ]}
              onPress={() => setSelectedDate(date.value)}
            >
              <Text style={[
                styles.optionText,
                selectedDate === date.value 
                  ? { color: 'rgba(255, 255, 255, 0.91)' }
                  : { color: 'rgba(0, 0, 0, 0.60)' }
              ]}>
                {date.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Time Selection */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: 'rgba(0, 0, 0, 0.60)' }]}>
          Time
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.optionsContainer}>
          {getTimeOptions().map((time) => (
            <TouchableOpacity
              key={time.value}
              style={[
                styles.optionButton,
                selectedTime === time.value 
                  ? { backgroundColor: '#000000' }
                  : { backgroundColor: '#F2F2F2' }
              ]}
              onPress={() => setSelectedTime(time.value)}
            >
              <Text style={[
                styles.optionText,
                selectedTime === time.value 
                  ? { color: 'rgba(255, 255, 255, 0.91)' }
                  : { color: 'rgba(0, 0, 0, 0.60)' }
              ]}>
                {time.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[
            styles.button,
            styles.dismissButton,
            { 
              backgroundColor: '#F2F2F2',
              opacity: isLoading ? 0.6 : 1
            }
          ]}
          onPress={handleDismiss}
          disabled={isLoading}
        >
          <Text style={[styles.buttonText, { color: 'rgba(0, 0, 0, 0.60)' }]}>
            {isLoading ? 'Processing...' : 'Dismiss'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.button,
            styles.scheduleButton,
            { 
              backgroundColor: isLoading ? '#CCCCCC' : '#000000',
              opacity: isLoading || !selectedDate || !selectedTime ? 0.6 : 1
            }
          ]}
          onPress={handleSchedule}
          disabled={isLoading || !selectedDate || !selectedTime}
        >
          <Text style={[styles.buttonText, { color: 'rgba(255, 255, 255, 0.91)' }]}>
            {isLoading ? 'Scheduling...' : 'Schedule'}
          </Text>
        </TouchableOpacity>
      </View>
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
  reason: {
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
  buttonContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  button: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dismissButton: {
    // Additional dismiss button styles if needed
  },
  scheduleButton: {
    // Additional schedule button styles if needed
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  scheduledInfo: {
    padding: 12,
    borderRadius: 12,
    marginTop: 4,
  },
  scheduledText: {
    fontSize: 11,
    fontWeight: '400',
    lineHeight: 16,
  },
  scheduledBold: {
    fontWeight: '500',
  },
});
