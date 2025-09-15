import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useColorScheme } from 'react-native';
import { Compass, ArrowRight } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

interface LifeCompassUpdatedToken {
  type: 'lifeCompassUpdated';
}

interface LifeCompassUpdatedCardProps {
  data: LifeCompassUpdatedToken;
}

export default function LifeCompassUpdatedCard({ data }: LifeCompassUpdatedCardProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();

  const handleViewLifeCompass = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      // Haptics might fail on simulator, ignore
    }
    
    // Navigate to Settings screen where Life Compass is displayed
    router.push('/(tabs)/settings');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, borderColor: colors.border }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.statusRow}>
          <Text style={[styles.label, { color: colors.text, opacity: 0.6 }]}>
            Life Compass Updated
          </Text>
          <View style={[styles.compassBadge, { backgroundColor: '#10B981' }]}>
            <Compass size={12} color="#FFFFFF" />
          </View>
        </View>
        <Text style={[styles.title, { color: colors.text }]}>
          Your Life Compass Has Been Generated
        </Text>
        <Text style={[styles.description, { color: colors.text, opacity: 0.7 }]}>
          Based on our deep dive session, I've created your personalized life compass with your current focus, key blockers, and action plan.
        </Text>
      </View>

      {/* Action Button */}
      <View style={styles.actions}>
        <TouchableOpacity 
          style={[styles.button, { backgroundColor: colors.text }]}
          onPress={handleViewLifeCompass}
        >
          <Text style={[styles.buttonText, { color: colors.background }]}>
            View Your Life Compass
          </Text>
          <ArrowRight size={16} color={colors.background} />
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
  compassBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
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
  actions: {
    flexDirection: 'row',
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    flexDirection: 'row',
    gap: 8,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
