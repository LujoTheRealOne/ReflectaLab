import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useColorScheme, Animated } from 'react-native';
import { CheckCircle, ArrowRight } from 'lucide-react-native';
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
    <View style={[styles.container, { 
      backgroundColor: colors.background, 
      borderColor: '#10B981',
      // Gradient effect simulation with shadow
      shadowColor: '#10B981',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
    }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.statusRow}>
          <View style={styles.statusIndicator}>
            <Animated.View 
              style={[
                styles.pulseIndicator, 
                { 
                  backgroundColor: '#10B981',
                  transform: [{ scale: pulseAnim }]
                }
              ]} 
            />
            <Text style={[styles.statusLabel, { color: '#10B981' }]}>
              Session Complete
            </Text>
          </View>
        </View>
        
        <Text style={[styles.title, { color: colors.text }]}>
          {data.title || "Ready to Complete Your Session"}
        </Text>
        
        <Text style={[styles.description, { color: colors.text, opacity: 0.7 }]}>
          {data.message || "I have gathered enough context to create your personalized life compass. Click below to complete the session and generate your insights."}
        </Text>
      </View>

      {/* Action Button */}
      <View style={styles.actions}>
        <TouchableOpacity 
          style={[
            styles.button, 
            { 
              backgroundColor: isCompleting ? '#9CA3AF' : '#10B981',
              opacity: isCompleting ? 0.7 : 1
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
              <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>
                Completing Session...
              </Text>
            </>
          ) : (
            <>
              <CheckCircle size={16} color="#FFFFFF" />
              <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>
                Complete Session & Generate Life Compass
              </Text>
              <ArrowRight size={16} color="#FFFFFF" />
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
    borderWidth: 2,
  },
  header: {
    marginBottom: 16,
  },
  statusRow: {
    marginBottom: 8,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pulseIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusLabel: {
    fontSize: 12,
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
    minHeight: 48,
    flexDirection: 'row',
    gap: 8,
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
    borderColor: '#FFFFFF',
    borderTopColor: 'transparent',
    borderRadius: 8,
  },
});
