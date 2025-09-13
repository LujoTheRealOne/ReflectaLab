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
  
  // ✅ WEB PATTERN: Local state for UI management
  const [cardState, setCardState] = useState<'default' | 'accepted' | 'rejected'>('default');
  const [selectedDeadline, setSelectedDeadline] = useState(deadline || '1w');
  const [selectedCadence, setSelectedCadence] = useState(cadence || 'daily');
  const [isLoading, setIsLoading] = useState(false);

  // ✅ WEB PATTERN: Use commitment state if available, otherwise use local state  
  // This matches web app exactly: commitment.state && commitment.state !== 'none' ? commitment.state : cardState
  const currentState = state && state !== 'none' ? state : cardState;

  // Debug log (only for state changes or interactions)
  // console.log('🎯 [CARD] CommitmentCard render:', { 
  //   title: title.substring(0, 20) + '...', 
  //   propState: state, 
  //   cardState,
  //   currentState, 
  //   commitmentId: commitmentId?.substring(0, 8) || 'none',
  //   editable 
  // });

  // ✅ WEB PATTERN: Accept handler with API call first, then state update
  const handleAccept = async () => {
    console.log('🟢 Accept button pressed', { editable, isLoading });
    if (!editable || isLoading) {
      console.log('🟢 Accept blocked:', { editable, isLoading });
      return;
    }
    
    if (!onUpdate) {
      console.error('🟢 No onUpdate callback provided');
      return;
    }
    
    setIsLoading(true);
    try {
      console.log('🟢 Calling onUpdate for acceptance...');
      
      // ✅ WEB PATTERN: Call onUpdate (which handles API call)
      // Only update local state after API success
      await onUpdate({ 
        state: 'accepted',
        // Don't generate commitmentId here - let backend handle it
      });
      
      // ✅ WEB PATTERN: Update local state after successful API call
      setCardState('accepted');
      console.log('✅ Commitment accepted successfully');
      
    } catch (error) {
      console.error('❌ Error accepting commitment:', error);
      // Don't update state on error - stay in 'none' state
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ WEB PATTERN: Reject handler with immediate state update (no API call)
  const handleReject = () => {
    console.log('🔴 Reject button pressed', { editable, isLoading });
    if (!editable || isLoading) {
      console.log('🔴 Reject blocked:', { editable, isLoading });
      return;
    }
    
    if (!onUpdate) {
      console.error('🔴 No onUpdate callback provided');
      return;
    }
    
    console.log('🔴 Rejecting commitment');
    
    // ✅ WEB PATTERN: Immediate state update for rejection
    setCardState('rejected');
    onUpdate({ state: 'rejected' });
  };

  const deadlineOptions = [
    { value: 'tomorrow', label: 'Tomorrow' },
    { value: '1w', label: '1 Week' },
    { value: '2w', label: '2 Weeks' },
    { value: '1m', label: '1 Month' }
  ];

  const cadenceOptions = [
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' }
  ];

  const formatDeadlineDisplay = (deadlineValue: string) => {
    const option = deadlineOptions.find(opt => opt.value === deadlineValue);
    return option ? option.label : deadlineValue;
  };

  const formatCadenceDisplay = (cadenceValue: string) => {
    const option = cadenceOptions.find(opt => opt.value === cadenceValue);
    return option ? option.label : cadenceValue;
  };

  const isOneTime = type === 'one-time';

  // ✅ WEB PATTERN: Render different UI based on current state
  if (currentState === 'accepted') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <View style={styles.header}>
          <View style={styles.statusRow}>
            <Text style={[styles.label, { color: colors.text, opacity: 0.6 }]}>
              Commitment Detected
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: '#10B981' }]}>
              <CheckCircle size={12} color="#FFFFFF" />
              <Text style={[styles.statusText, { color: '#FFFFFF' }]}>Accepted</Text>
            </View>
          </View>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.metadata, { color: colors.text, opacity: 0.5 }]}>
            {isOneTime ? `Due: ${formatDeadlineDisplay(selectedDeadline)}` : `Frequency: ${formatCadenceDisplay(selectedCadence)}`}
          </Text>
        </View>
      </View>
    );
  }

  if (currentState === 'rejected') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, borderColor: colors.border, opacity: 0.75 }]}>
        <View style={styles.header}>
          <View style={styles.statusRow}>
            <Text style={[styles.label, { color: colors.text, opacity: 0.6 }]}>
              Commitment Detected
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: '#EF4444' }]}>
              <XCircle size={12} color="#FFFFFF" />
              <Text style={[styles.statusText, { color: '#FFFFFF' }]}>Rejected</Text>
            </View>
          </View>
          <Text style={[styles.title, { color: colors.text, opacity: 0.6 }]}>{title}</Text>
        </View>
      </View>
    );
  }

  // ✅ WEB PATTERN: Default state - show interactive card
  return (
    <View style={[styles.container, { backgroundColor: colors.background, borderColor: colors.border }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.statusRow}>
          <Text style={[styles.label, { color: colors.text, opacity: 0.6 }]}>
            Commitment Detected
          </Text>
          <View style={[styles.typeBadge, { backgroundColor: '#F97316' }]}>
            <Text style={[styles.typeText, { color: '#FFFFFF' }]}>
              {isOneTime ? '📅 One-time' : '🔄 Recurring'}
            </Text>
          </View>
        </View>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.description, { color: colors.text, opacity: 0.7 }]}>{description}</Text>
      </View>

      {/* Deadline/Cadence Selection */}
      <View style={styles.configSection}>
        {isOneTime ? (
          <>
            <Text style={[styles.configLabel, { color: colors.text, opacity: 0.7 }]}>
              Suggested deadline: {formatDeadlineDisplay(selectedDeadline)}
            </Text>
            {/* Could add picker here if needed */}
          </>
        ) : (
          <>
            <Text style={[styles.configLabel, { color: colors.text, opacity: 0.7 }]}>
              Suggested frequency: {formatCadenceDisplay(selectedCadence)}
            </Text>
            {/* Could add picker here if needed */}
          </>
        )}
      </View>

      {/* Action Buttons */}
      <View style={styles.actions}>
        <TouchableOpacity 
          style={[styles.button, styles.acceptButton, { backgroundColor: colors.text }]}
          onPress={handleAccept}
          disabled={isLoading}
        >
          <Text style={[styles.buttonText, { color: colors.background }]}>
            {isLoading ? 'Creating...' : 'Accept'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.button, styles.rejectButton, { borderColor: colors.border }]}
          onPress={handleReject}
          disabled={isLoading}
        >
          <Text style={[styles.buttonText, { color: colors.text, opacity: 0.6 }]}>
            Reject
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
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