import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';

interface SessionCardToken {
  type: 'sessionCard';
  title: string;
  sessionId: string;
  duration: string;
  question: string;
  goal: string;
}

interface SessionCardProps {
  session: SessionCardToken;
  onContinueSession?: (sessionId: string) => void;
}

export default function SessionCard({ session, onContinueSession }: SessionCardProps) {
  const navigation = useNavigation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [isProcessing, setIsProcessing] = useState(false);

  const handleContinueSession = async () => {
    if (isProcessing) return;

    setIsProcessing(true);
    
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      console.log('🎯 Continue session clicked:', session.sessionId);
      
      // Navigate to breakout session
      // @ts-ignore - Navigation will be properly typed
      navigation.navigate('BreakoutSession', { 
        sessionId: session.sessionId,
        title: session.title,
        goal: session.goal 
      });
      
      onContinueSession?.(session.sessionId);
    } catch (error) {
      console.error('Error continuing session:', error);
      Alert.alert(
        'Error',
        'Failed to continue session. Please try again.',
        [{ text: 'OK', style: 'default' }]
      );
    } finally {
      setIsProcessing(false);
    }
  };

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
          Session
        </Text>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
          {session.title}
        </Text>
        <Text style={[styles.description, { color: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.60)' }]} numberOfLines={2}>
          {session.goal}
        </Text>
      </View>

      {/* Session Info */}
      <View style={[styles.infoContainer, { backgroundColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : '#F2F2F2' }]}>
        <Text style={[styles.infoText, { color: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.60)' }]}>
          Duration: <Text style={styles.infoBold}>{session.duration}</Text>
        </Text>
      </View>

      {/* Action Button */}
      <TouchableOpacity
        style={[
          styles.button,
          { 
            backgroundColor: isProcessing 
              ? (colorScheme === 'dark' ? '#666666' : '#CCCCCC')
              : (colorScheme === 'dark' ? '#FFFFFF' : '#000000'),
            opacity: isProcessing ? 0.6 : 1
          }
        ]}
        onPress={handleContinueSession}
        disabled={isProcessing}
      >
        <Text style={[styles.buttonText, { color: colorScheme === 'dark' ? 'rgba(0, 0, 0, 0.91)' : 'rgba(255, 255, 255, 0.91)' }]}>
          {isProcessing ? 'Loading...' : 'Continue Session'}
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
  infoContainer: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  infoText: {
    fontSize: 11,
    fontWeight: '400',
    lineHeight: 16,
  },
  infoBold: {
    fontWeight: '500',
  },
  button: {
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
});
