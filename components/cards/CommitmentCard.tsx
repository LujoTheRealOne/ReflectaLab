import React, { useState, useEffect } from 'react';
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
  const [isProcessing, setIsProcessing] = useState(false);

  // Update local state when props change (important for persistence across app restarts)
  useEffect(() => {
    if (state !== currentState) {
      console.log('🔄 [CARD] CommitmentCard state prop changed:', { 
        title: title.substring(0, 30) + '...', 
        from: currentState, 
        to: state,
        commitmentId 
      });
      setCurrentState(state);
    }
  }, [state, currentState, title, commitmentId]);

  // Debug log when component renders (disabled to reduce noise)
  // console.log('🎯 [CARD] CommitmentCard rendered:', { 
  //   title: title.substring(0, 30) + '...', 
  //   propState: state, 
  //   currentState, 
  //   commitmentId,
  //   editable 
  // });

  // Debug logging (disabled)
  // console.log('🎯 CommitmentCard props:', { state, currentState, editable, title });
  // console.log('🎯 Should show buttons:', currentState === 'none', 'currentState:', currentState);

  const handleAccept = () => {
    console.log('🟢 Accept button pressed', { editable, currentState, isProcessing });
    if (!editable || currentState !== 'none' || isProcessing) {
      console.log('🟢 Accept blocked:', { editable, currentState, isProcessing });
      return;
    }
    
    // Immediately set processing state to prevent double-clicks
    setIsProcessing(true);
    setCurrentState('accepted');
    
    const newCommitmentId = `commitment_${Date.now()}`;
    console.log('🟢 Accepting commitment:', { newCommitmentId });
    
    onUpdate?.({ state: 'accepted', commitmentId: newCommitmentId });
    
    // Reset processing state after a delay (in case API call fails)
    setTimeout(() => {
      setIsProcessing(false);
    }, 5000);
  };

  const handleReject = () => {
    console.log('🔴 Reject button pressed', { editable, currentState, isProcessing });
    if (!editable || currentState !== 'none' || isProcessing) {
      console.log('🔴 Reject blocked:', { editable, currentState, isProcessing });
      return;
    }
    
    // Immediately set processing state to prevent double-clicks
    setIsProcessing(true);
    setCurrentState('rejected');
    
    console.log('🔴 Rejecting commitment');
    onUpdate?.({ state: 'rejected' });
    
    // Reset processing state after a delay (in case API call fails)
    setTimeout(() => {
      setIsProcessing(false);
    }, 5000);
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
        backgroundColor: colors.background,
        shadowColor: colorScheme === 'dark' ? '#FFFFFF' : '#000000',
        shadowOpacity: colorScheme === 'dark' ? 0.08 : 0.12,
        opacity: currentState === 'rejected' ? 0.6 : 1,
      }
    ]}>
      {/* Header with state */}
      <View style={styles.header}>
        <Text style={[styles.typeText, { color: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.40)' }]}>
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
          <Text style={[styles.description, { color: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.60)' }]}>
            {description}
          </Text>
        )}

        {/* Timeline - Simple and clean */}
        {(currentState === 'none' || currentState === 'accepted') && (
          <View style={styles.timeline}>
            <Text style={[styles.timelineText, { 
              color: currentState === 'accepted' ? '#10B981' : (colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.60)')
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
              opacity: isProcessing ? 0.5 : 1,
            }]}
            onPress={handleReject}
            disabled={!editable || isProcessing}
          >
            <Text style={[styles.buttonText, { 
              color: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.60)'
            }]}>
              Decline
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, {
              backgroundColor: colorScheme === 'dark' ? '#FFFFFF' : '#000000',
              opacity: isProcessing ? 0.5 : 1,
            }]}
            onPress={handleAccept}
            disabled={!editable || isProcessing}
          >
            <Text style={[styles.buttonText, { 
              color: colorScheme === 'dark' ? 'rgba(0, 0, 0, 0.91)' : 'rgba(255, 255, 255, 0.91)'
            }]}>
              {isProcessing ? 'Processing...' : 'Accept'}
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
