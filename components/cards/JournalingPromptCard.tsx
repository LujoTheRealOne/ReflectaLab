import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useColorScheme } from 'react-native';
import { PenTool, CheckCircle, XCircle } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

interface JournalingPromptToken {
  type: 'journalingPrompt';
  prompt: string;
  context?: string;
}

interface JournalingPromptCardProps {
  journalingPrompt: JournalingPromptToken;
  onStartJournaling?: (prompt: string) => void;
  onDismiss?: (prompt: string) => void;
  onStateChange?: (newState: 'completed' | 'dismissed') => void;
}

export default function JournalingPromptCard({
  journalingPrompt,
  onStartJournaling,
  onDismiss,
  onStateChange
}: JournalingPromptCardProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();

  // ✅ COMMITMENT CARD PATTERN: Local state for UI management
  const [cardState, setCardState] = useState<'default' | 'completed' | 'dismissed'>('default');
  const [isLoading, setIsLoading] = useState(false);

  // ✅ COMMITMENT CARD PATTERN: Start journaling handler
  const handleStartJournaling = async () => {
    if (isLoading || cardState !== 'default') return;
    
    setIsLoading(true);
    
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      // ✅ COMMITMENT CARD PATTERN: Update local state
      setCardState('completed');
      
      // Navigate to Notes screen with prompt
      const encodedPrompt = encodeURIComponent(journalingPrompt.prompt);
      router.push(`/(tabs)/notes?prompt=${encodedPrompt}`);
      
      // Call callbacks
      onStartJournaling?.(journalingPrompt.prompt);
      onStateChange?.('completed');
      
    } catch (error) {
      console.error('❌ Error starting journaling:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ COMMITMENT CARD PATTERN: Dismiss handler with immediate state update
  const handleDismiss = () => {
    if (isLoading || cardState !== 'default') return;
    
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      // Haptics might fail on simulator, ignore
    }
    
    // ✅ COMMITMENT CARD PATTERN: Immediate state update for dismissal
    setCardState('dismissed');
    onDismiss?.(journalingPrompt.prompt);
    onStateChange?.('dismissed');
  };

  // ✅ COMMITMENT CARD PATTERN: Render different UI based on current state
  if (cardState === 'completed') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <View style={styles.header}>
          <View style={styles.statusRow}>
            <Text style={[styles.label, { color: colors.text, opacity: 0.6 }]}>
              Journaling Prompt
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: '#10B981' }]}>
              <CheckCircle size={12} color="#FFFFFF" />
              <Text style={[styles.statusText, { color: '#FFFFFF' }]}>Started</Text>
            </View>
          </View>
          <Text style={[styles.title, { color: colors.text }]}>Prompt started</Text>
          <Text style={[styles.metadata, { color: colors.text, opacity: 0.5 }]}>
            Recorded: Started journaling
          </Text>
        </View>
      </View>
    );
  }

  if (cardState === 'dismissed') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, borderColor: colors.border, opacity: 0.75 }]}>
        <View style={styles.header}>
          <View style={styles.statusRow}>
            <Text style={[styles.label, { color: colors.text, opacity: 0.6 }]}>
              Journaling Prompt
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: '#EF4444' }]}>
              <XCircle size={12} color="#FFFFFF" />
              <Text style={[styles.statusText, { color: '#FFFFFF' }]}>Dismissed</Text>
            </View>
          </View>
          <Text style={[styles.title, { color: colors.text, opacity: 0.6 }]}>Prompt dismissed</Text>
        </View>
      </View>
    );
  }

  // ✅ COMMITMENT CARD PATTERN: Default state - show interactive card
  return (
    <View style={[styles.container, { backgroundColor: colors.background, borderColor: colors.border }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.statusRow}>
          <Text style={[styles.label, { color: colors.text, opacity: 0.6 }]}>
            Journaling Prompt
          </Text>
          <View style={[styles.typeBadge, { backgroundColor: '#8B5CF6' }]}>
            <Text style={[styles.typeText, { color: '#FFFFFF' }]}>
              ✍️ Reflect
            </Text>
          </View>
        </View>
        <Text style={[styles.title, { color: colors.text }]}>{journalingPrompt.prompt}</Text>
        {journalingPrompt.context && (
          <Text style={[styles.description, { color: colors.text, opacity: 0.7 }]}>
            {journalingPrompt.context}
          </Text>
        )}
      </View>

      {/* Action Buttons */}
      <View style={styles.actions}>
        <TouchableOpacity 
          style={[styles.button, styles.acceptButton, { backgroundColor: colors.text }]}
          onPress={handleStartJournaling}
          disabled={isLoading}
        >
          <Text style={[styles.buttonText, { color: colors.background }]}>
            {isLoading ? 'Starting...' : 'Start Journaling'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.button, styles.rejectButton, { borderColor: colors.border }]}
          onPress={handleDismiss}
          disabled={isLoading}
        >
          <Text style={[styles.buttonText, { color: colors.text, opacity: 0.6 }]}>
            Dismiss
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
