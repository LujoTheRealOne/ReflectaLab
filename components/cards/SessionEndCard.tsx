import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useColorScheme, Animated } from 'react-native';
import { CheckCircle, ArrowRight, Clock } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import * as Haptics from 'expo-haptics';

interface SessionEndToken {
  type: 'sessionEnd';
  title?: string;
  message?: string;
}

interface SessionEndCardProps {
  data: SessionEndToken;
  onCompleteSession?: () => void;
}

export default function SessionEndCard({ data, onCompleteSession }: SessionEndCardProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [isCompleting, setIsCompleting] = useState(false);

  // Animated pulse for the status indicator
  const pulseAnim = React.useRef(new Animated.Value(1)).current;
  
  // Spinner animation for loading state
  const spinnerAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.7,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  React.useEffect(() => {
    if (isCompleting) {
      const spinner = Animated.loop(
        Animated.timing(spinnerAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        })
      );
      spinner.start();
      return () => spinner.stop();
    } else {
      spinnerAnim.setValue(0);
    }
  }, [isCompleting, spinnerAnim]);

  const handleCompleteSession = async () => {
    console.log('🎯 SessionEndCard: Starting session completion');
    setIsCompleting(true);
    
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      // Haptics might fail on simulator, ignore
    }
    
    try {
      // Call the completion callback if provided
      if (onCompleteSession) {
        console.log('🎯 SessionEndCard: Calling onCompleteSession callback');
        await onCompleteSession();
        console.log('🎯 SessionEndCard: onCompleteSession callback completed successfully');
      } else {
        console.warn('🎯 SessionEndCard: No onCompleteSession callback provided');
      }
      // Reset loading state on successful completion
      setIsCompleting(false);
      console.log('🎯 SessionEndCard: Session completion finished');
    } catch (error) {
      console.error('🎯 SessionEndCard: Error completing session:', error);
      setIsCompleting(false);
    }
  };

  return (
    <View style={[
      styles.container, 
      { 
        backgroundColor: colors.background,
        borderColor: colors.border,
        shadowColor: colorScheme === 'dark' ? '#000000' : '#000000',
      }
    ]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.statusRow}>
          <Text style={[styles.label, { color: colors.text, opacity: 0.6 }]}>
            Session Status
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: '#10B981' + '15' }]}>
            <Animated.View 
              style={[
                styles.pulseIndicator, 
                { 
                  backgroundColor: '#10B981',
                  transform: [{ scale: pulseAnim }]
                }
              ]} 
            />
            <Text style={[styles.statusText, { color: '#10B981' }]}>
              Complete
            </Text>
          </View>
        </View>
        
        <Text style={[styles.title, { color: colors.text }]}>
          {data.title || "Ready to Complete Your Session"}
        </Text>
        
        <Text style={[styles.description, { color: colors.text, opacity: 0.7 }]}>
          {data.message || "I have gathered enough context to create your personalized life compass. Click below to complete the session and generate your insights."}
        </Text>

        {/* Session metadata */}
        <View style={styles.metadataRow}>
          <Clock size={12} color={colors.text} style={{ opacity: 0.5 }} />
          <Text style={[styles.metadata, { color: colors.text, opacity: 0.5 }]}>
            Session ready for completion
          </Text>
        </View>
      </View>

      {/* Action Button */}
      <View style={styles.actions}>
        <TouchableOpacity 
          style={[
            styles.button, 
            styles.primaryButton,
            { 
              backgroundColor: isCompleting ? (colors.text + '80') : colors.text,
            }
          ]}
          onPress={handleCompleteSession}
          disabled={isCompleting}
        >
          {isCompleting ? (
            <>
              <Animated.View 
                style={[
                  styles.spinner,
                  {
                    transform: [{
                      rotate: spinnerAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0deg', '360deg']
                      })
                    }]
                  }
                ]} 
              />
              <Text style={[styles.buttonText, { color: colors.background }]}>
                Completing...
              </Text>
            </>
          ) : (
            <>
              <CheckCircle size={16} color={colors.background} />
              <Text style={[styles.buttonText, { color: colors.background }]}>
                Complete & View Compass
              </Text>
              <ArrowRight size={16} color={colors.background} />
            </>
          )}
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
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  pulseIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
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
    marginBottom: 8,
  },
  metadataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metadata: {
    fontSize: 12,
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
  primaryButton: {
    // Primary button styling
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  spinner: {
    width: 16,
    height: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    borderTopColor: 'currentColor',
    borderRadius: 8,
  },
});