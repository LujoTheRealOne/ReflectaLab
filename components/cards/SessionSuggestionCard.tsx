import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useColorScheme, ScrollView, Alert } from 'react-native';
import { Calendar, Clock, CheckCircle, XCircle } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/hooks/useAuth';
import { useAnalytics } from '@/hooks/useAnalytics';
import * as Haptics from 'expo-haptics';

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
  const { trackScheduledSessionAccepted } = useAnalytics();

  // ✅ COMMITMENT CARD PATTERN: Initialize with default values immediately
  const getDefaultDate = () => {
    if (sessionSuggestion.scheduledDate) return sessionSuggestion.scheduledDate;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  };

  const getInitialState = (): 'default' | 'scheduled' | 'dismissed' => {
    switch (sessionSuggestion.state) {
      case 'scheduled': return 'scheduled';
      case 'dismissed': return 'dismissed';
      case 'none':
      default: return 'default';
    }
  };

  const [selectedDuration, setSelectedDuration] = useState(sessionSuggestion.duration || '60m');
  const [selectedDate, setSelectedDate] = useState(getDefaultDate());
  const [selectedTime, setSelectedTime] = useState(sessionSuggestion.scheduledTime || '10:00');
  const [cardState, setCardState] = useState<'default' | 'scheduled' | 'dismissed'>(getInitialState());
  const [isLoading, setIsLoading] = useState(false);

  // ✅ COMMITMENT CARD PATTERN: Use computed state (no useEffect to avoid render loops)
  const currentState = sessionSuggestion.state && sessionSuggestion.state !== 'none' ? sessionSuggestion.state : cardState;

  const durations = ['15m', '30m', '45m', '60m', '90m'];

  // Generate next 7 days for date options
  const getDateOptions = () => {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      const value = date.toISOString().split('T')[0];
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

  // ✅ COMMITMENT CARD PATTERN: Schedule handler with API call first, then state update
  const handleSchedule = async () => {
    if (!onStateChange || isLoading || !selectedDate || !selectedTime) return;
    
    setIsLoading(true);
    
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      const token = await getToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

      const durationNumber = parseInt(selectedDuration.replace('m', ''));
      const scheduledDateTime = new Date(`${selectedDate}T${selectedTime}:00`).toISOString();

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
        throw new Error(`API call failed: ${response.status}`);
      }

      const result = await response.json();
      
      // Track scheduled session acceptance in PostHog
      trackScheduledSessionAccepted({
        user_id: firebaseUser?.uid,
        session_title: sessionSuggestion.title,
        session_reason: sessionSuggestion.reason,
        duration_minutes: durationNumber,
        scheduled_date: selectedDate,
        scheduled_time: selectedTime,
        coaching_session_id: coachingSessionId,
        source: 'session_suggestion'
      });
      
      // ✅ COMMITMENT CARD PATTERN: Update local state after successful API call
      setCardState('scheduled');
      
      onSchedule?.(sessionSuggestion.title, selectedDuration, scheduledDateTime);
      onStateChange('scheduled', { 
        scheduledDate: selectedDate, 
        scheduledTime: selectedTime 
      });

    } catch (error) {
      console.error('❌ Error scheduling session:', error);
      Alert.alert('Error', 'Failed to schedule session. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ COMMITMENT CARD PATTERN: Dismiss handler with immediate state update (no API call)
  const handleDismiss = () => {
    if (!onStateChange || isLoading) return;
    
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      // Haptics might fail on simulator, ignore
    }
    
    // ✅ COMMITMENT CARD PATTERN: Immediate state update for dismissal
    setCardState('dismissed');
    onDismiss?.(sessionSuggestion.title);
    onStateChange('dismissed');
  };

  const formatScheduledDateTime = () => {
    if (!selectedDate || !selectedTime) return '';
    const dateOption = getDateOptions().find(d => d.value === selectedDate);
    const timeOption = getTimeOptions().find(t => t.value === selectedTime);
    return `${dateOption?.label} at ${timeOption?.label}`;
  };

  // ✅ COMMITMENT CARD PATTERN: Render different UI based on current state
  if (currentState === 'scheduled') {
    return (
      <View style={[
        styles.container, 
        { 
          backgroundColor: colors.background,
          borderWidth: 0.5,
          borderColor: colorScheme === 'dark' ? '#333333' : '#F0F0F0',
          shadowColor: colorScheme === 'dark' ? '#FFFFFF' : '#000000',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: colorScheme === 'dark' ? 0.1 : 0.15,
          shadowRadius: colorScheme === 'dark' ? 8 : 10,
          elevation: colorScheme === 'dark' ? 8 : 12,
        }
      ]}>
        <View style={styles.header}>
          <View style={styles.statusRow}>
            <Text style={[styles.label, { color: colors.text, opacity: 0.6 }]}>
              Session Suggestion
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: '#3B82F6' }]}>
              <CheckCircle size={12} color="#FFFFFF" />
              <Text style={[styles.statusText, { color: '#FFFFFF' }]}>Scheduled</Text>
            </View>
          </View>
          <Text style={[styles.title, { color: colors.text }]}>{sessionSuggestion.title}</Text>
          <Text style={[styles.metadata, { color: colors.text, opacity: 0.5 }]}>
            {formatScheduledDateTime()} • {selectedDuration}
          </Text>
        </View>
      </View>
    );
  }

  if (currentState === 'dismissed') {
    return (
      <View style={[
        styles.container, 
        { 
          backgroundColor: colors.background,
          borderWidth: 0.5,
          borderColor: colorScheme === 'dark' ? '#333333' : '#F0F0F0',
          shadowColor: colorScheme === 'dark' ? '#FFFFFF' : '#000000',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: colorScheme === 'dark' ? 0.1 : 0.15,
          shadowRadius: colorScheme === 'dark' ? 8 : 10,
          elevation: colorScheme === 'dark' ? 8 : 12,
          opacity: 0.75,
        }
      ]}>
        <View style={styles.header}>
          <View style={styles.statusRow}>
            <Text style={[styles.label, { color: colors.text, opacity: 0.6 }]}>
              Session Suggestion
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: '#EF4444' }]}>
              <XCircle size={12} color="#FFFFFF" />
              <Text style={[styles.statusText, { color: '#FFFFFF' }]}>Dismissed</Text>
            </View>
          </View>
          <Text style={[styles.title, { color: colors.text, opacity: 0.6 }]}>{sessionSuggestion.title}</Text>
        </View>
      </View>
    );
  }

  // ✅ COMMITMENT CARD PATTERN: Default state - show interactive card
  return (
    <View style={[
      styles.container, 
      { 
        backgroundColor: colors.background,
        borderWidth: 0.5,
        borderColor: colorScheme === 'dark' ? '#333333' : '#F0F0F0',
        shadowColor: colorScheme === 'dark' ? '#FFFFFF' : '#000000',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: colorScheme === 'dark' ? 0.1 : 0.15,
        shadowRadius: colorScheme === 'dark' ? 8 : 10,
        elevation: colorScheme === 'dark' ? 8 : 12,
      }
    ]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.statusRow}>
          <Text style={[styles.label, { color: colors.text, opacity: 0.6 }]}>
            Session Suggestion
          </Text>
          <View style={[styles.typeBadge, { backgroundColor: '#8B5CF6' }]}>
            <Text style={[styles.typeText, { color: '#FFFFFF' }]}>
              📅 {selectedDuration}
            </Text>
          </View>
        </View>
        <Text style={[styles.title, { color: colors.text }]}>{sessionSuggestion.title}</Text>
        <Text style={[styles.description, { color: colors.text, opacity: 0.7 }]}>{sessionSuggestion.reason}</Text>
      </View>

      {/* Duration Selection */}
      <View style={styles.configSection}>
        <Text style={[styles.configLabel, { color: colors.text, opacity: 0.7 }]}>
          Duration: {selectedDuration}
        </Text>
        <View style={styles.optionsRow}>
          {durations.map((duration) => (
            <TouchableOpacity
              key={duration}
              style={[
                styles.optionButton,
                {
                  backgroundColor: selectedDuration === duration 
                    ? colors.text 
                    : (colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : '#F2F2F2')
                }
              ]}
              onPress={() => setSelectedDuration(duration)}
            >
              <Text style={[
                styles.optionText,
                { 
                  color: selectedDuration === duration 
                    ? colors.background 
                    : colors.text 
                }
              ]}>
                {duration}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Date Selection */}
      <View style={styles.configSection}>
        <Text style={[styles.configLabel, { color: colors.text, opacity: 0.7 }]}>
          Date: {getDateOptions().find(d => d.value === selectedDate)?.label}
        </Text>
        <View style={styles.optionsRow}>
          {getDateOptions().slice(0, 4).map((date) => (
            <TouchableOpacity
              key={date.value}
              style={[
                styles.optionButton,
                {
                  backgroundColor: selectedDate === date.value 
                    ? colors.text 
                    : (colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : '#F2F2F2'),
                }
              ]}
              onPress={() => setSelectedDate(date.value)}
            >
              <Text style={[
                styles.optionText,
                { 
                  color: selectedDate === date.value 
                    ? colors.background 
                    : colors.text 
                }
              ]}>
                {date.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Time Selection */}
      <View style={styles.configSection}>
        <Text style={[styles.configLabel, { color: colors.text, opacity: 0.7 }]}>
          Time: {getTimeOptions().find(t => t.value === selectedTime)?.label}
        </Text>
        <View style={styles.optionsRow}>
          {getTimeOptions().slice(0, 6).map((time) => (
            <TouchableOpacity
              key={time.value}
              style={[
                styles.optionButton,
                {
                  backgroundColor: selectedTime === time.value 
                    ? colors.text 
                    : (colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : '#F2F2F2'),
                }
              ]}
              onPress={() => setSelectedTime(time.value)}
            >
              <Text style={[
                styles.optionText,
                { 
                  color: selectedTime === time.value 
                    ? colors.background 
                    : colors.text 
                }
              ]}>
                {time.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actions}>
        <TouchableOpacity 
          style={[styles.button, styles.acceptButton, { backgroundColor: colors.text }]}
          onPress={handleSchedule}
          disabled={isLoading || !selectedDate || !selectedTime}
        >
          <Text style={[styles.buttonText, { color: colors.background }]}>
            {isLoading ? 'Scheduling...' : 'Schedule'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.button, styles.rejectButton, { borderColor: colors.border }]}
          onPress={handleDismiss}
          disabled={isLoading}
        >
          <Text style={[styles.buttonText, { color: colors.text, opacity: 0.6 }]}>
            Not Now
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ✅ COMMITMENT CARD PATTERN: Exact same styles structure
const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
    padding: 16,
    borderRadius: 12,
  },
  header: {
    marginBottom: 16,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  typeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 20,
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    lineHeight: 18,
  },
  metadata: {
    fontSize: 12,
    marginTop: 4,
  },
  configSection: {
    marginBottom: 16,
  },
  configLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 8,
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  optionText: {
    fontSize: 12,
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  acceptButton: {
    // backgroundColor set dynamically
  },
  rejectButton: {
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});