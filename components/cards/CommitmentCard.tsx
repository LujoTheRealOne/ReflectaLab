import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useColorScheme } from 'react-native';
import { Calendar, Clock, CheckCircle, XCircle } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';

interface CommitmentCardProps {
  title: string;
  description: string;
  type: 'one-time' | 'recurring';
  deadline?: string;
  cadence?: string;
  state?: 'none' | 'accepted' | 'rejected';
  commitmentId?: string;
  onUpdate?: (data: { state: string; commitmentId?: string }) => void;
  editable?: boolean;
}

export default function CommitmentCard({ 
  title,
  description,
  type,
  deadline,
  cadence,
  state = 'none',
  commitmentId,
  onUpdate,
  editable = true
}: CommitmentCardProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  
  const [currentState, setCurrentState] = useState(state);
  const [selectedDeadline, setSelectedDeadline] = useState(deadline || '1w');
  const [selectedCadence, setSelectedCadence] = useState(cadence || 'daily');

  // Debug logging (disabled)
  // console.log('🎯 CommitmentCard props:', { state, currentState, editable, title });
  // console.log('🎯 Should show buttons:', currentState === 'none', 'currentState:', currentState);

  const handleAccept = () => {
    console.log('🟢 Accept button pressed', { editable, currentState });
    if (!editable || currentState !== 'none') {
      console.log('🟢 Accept blocked:', { editable, currentState });
      return;
    }
    
    const newCommitmentId = `commitment_${Date.now()}`;
    console.log('🟢 Accepting commitment:', { newCommitmentId });
    setCurrentState('accepted');
    onUpdate?.({ state: 'accepted', commitmentId: newCommitmentId });
  };

  const handleReject = () => {
    console.log('🔴 Reject button pressed', { editable, currentState });
    if (!editable || currentState !== 'none') {
      console.log('🔴 Reject blocked:', { editable, currentState });
      return;
    }
    
    console.log('🔴 Rejecting commitment');
    setCurrentState('rejected');
    onUpdate?.({ state: 'rejected' });
  };

  const formatDeadline = (deadline: string) => {
    const map: Record<string, string> = {
      'tomorrow': 'Tomorrow',
      '2d': '2 days',
      '1w': '1 week',
      '2w': '2 weeks',
      '1m': '1 month'
    };
    return map[deadline] || deadline;
  };

  const formatCadence = (cadence: string) => {
    const map: Record<string, string> = {
      'daily': 'Daily',
      'weekly': 'Weekly',
      'monthly': 'Monthly'
    };
    return map[cadence] || cadence;
  };

  const getStateColor = () => {
    switch (currentState) {
      case 'accepted': return '#10B981';
      case 'rejected': return '#EF4444';
      default: return colors.text;
    }
  };

  const getStateBadge = () => {
    switch (currentState) {
      case 'accepted':
        return (
          <Text style={[styles.statusText, { color: '#10B981' }]}>
            Accepted
          </Text>
        );
      case 'rejected':
        return (
          <Text style={[styles.statusText, { color: '#EF4444' }]}>
            Declined
          </Text>
        );
      default:
        return null;
    }
  };

  return (
    <View style={[
      styles.card,
      {
        backgroundColor: colorScheme === 'dark' ? '#1C1C1E' : '#FFFFFF',
        opacity: currentState === 'rejected' ? 0.6 : 1,
      }
    ]}>
      {/* Header with state */}
      <View style={styles.header}>
        <Text style={[styles.typeText, { color: colorScheme === 'dark' ? '#8E8E93' : '#8E8E93' }]}>
          {type === 'one-time' ? 'One-time commitment' : 'Recurring commitment'}
        </Text>
        {getStateBadge()}
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>
          {title}
        </Text>
        
        {description && (
          <Text style={[styles.description, { color: colorScheme === 'dark' ? '#8E8E93' : '#6B7280' }]}>
            {description}
          </Text>
        )}

        {/* Timeline - Simple and clean */}
        {(currentState === 'none' || currentState === 'accepted') && (
          <View style={styles.timeline}>
            <Text style={[styles.timelineText, { 
              color: currentState === 'accepted' ? '#10B981' : (colorScheme === 'dark' ? '#8E8E93' : '#6B7280')
            }]}>
              {type === 'one-time' 
                ? `Due in ${formatDeadline(selectedDeadline)}`
                : formatCadence(selectedCadence)
              }
            </Text>
          </View>
        )}
      </View>

      {/* Action Buttons - Clean and minimal */}
      {currentState === 'none' && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.button, {
              backgroundColor: 'transparent',
            }]}
            onPress={handleReject}
            disabled={!editable}
          >
            <Text style={[styles.buttonText, { 
              color: colorScheme === 'dark' ? '#8E8E93' : '#6B7280'
            }]}>
              Decline
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, {
              backgroundColor: colorScheme === 'dark' ? '#FFFFFF' : '#000000'
            }]}
            onPress={handleAccept}
            disabled={!editable}
          >
            <Text style={[styles.buttonText, { 
              color: colorScheme === 'dark' ? '#000000' : '#FFFFFF'
            }]}>
              Accept
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 20,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  typeText: {
    fontSize: 13,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    marginTop: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 24,
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
  timeline: {
    marginBottom: 8,
  },
  timelineText: {
    fontSize: 14,
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
});
