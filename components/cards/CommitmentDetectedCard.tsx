import React from 'react';
import { View, Text, StyleSheet, useColorScheme } from 'react-native';
import { Target } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';

interface CommitmentDetectedCardProps {
  title: string;
  description?: string;
  type?: 'one-time' | 'recurring';
}

export default function CommitmentDetectedCard({
  title,
  description,
  type = 'one-time'
}: CommitmentDetectedCardProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

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
            Commitment Detected
          </Text>
          <View style={[styles.typeBadge, { backgroundColor: '#F97316' }]}>
            <Target size={10} color="#FFFFFF" />
            <Text style={[styles.typeText, { color: '#FFFFFF' }]}>
              {type === 'one-time' ? 'One-time' : 'Recurring'}
            </Text>
          </View>
        </View>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        {description && (
          <Text style={[styles.description, { color: colors.text, opacity: 0.7 }]}>
            {description}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
    padding: 16,
    borderRadius: 12,
  },
  header: {
    marginBottom: 0,
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
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
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
});
