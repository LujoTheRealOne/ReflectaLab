import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, useColorScheme } from 'react-native';
import { MessageCircle, ChevronDown, ChevronUp } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/Colors';

interface CoachingMessageCardProps {
  pushText?: string;
  fullMessage?: string;
  messageType?: string;
  loading?: boolean;
}

export default function CoachingMessageCard({ 
  pushText = "Here's your daily coaching reflection...",
  fullMessage = "Today is a perfect opportunity to reflect on your goals and take meaningful action towards what matters most to you.",
  messageType = "daily_reflection",
  loading = false
}: CoachingMessageCardProps) {
  const [expanded, setExpanded] = useState(false);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  
  // Animations for expansion
  const [fadeAnim] = useState(new Animated.Value(0));
  const [heightAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(1));
  const [rotateAnim] = useState(new Animated.Value(0));
  
  const formatMessageType = (type: string) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const toggleExpanded = () => {
    const newExpanded = !expanded;
    setExpanded(newExpanded);
    
    // Add haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Small scale feedback on tap and rotate chevron
    Animated.parallel([
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 0.98,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(rotateAnim, {
        toValue: newExpanded ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
    
    // Main expand/collapse animation with spring physics
    if (newExpanded) {
      // Expanding - fade in first, then height
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: false,
        }),
        Animated.spring(heightAnim, {
          toValue: 1,
          useNativeDriver: false,
          tension: 100,
          friction: 8,
        }),
      ]).start();
    } else {
      // Collapsing - height first, then fade out
      Animated.sequence([
        Animated.timing(heightAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: false,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 100,
          useNativeDriver: false,
        }),
      ]).start();
    }
  };

  return (
    <TouchableOpacity
      onPress={toggleExpanded}
      activeOpacity={0.8}
      disabled={loading}
    >
      <Animated.View style={[
        styles.container,
        {
          backgroundColor: `${colors.tint}05`,
          borderColor: `${colors.tint}22`,
          transform: [{ scale: scaleAnim }],
        }
      ]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {/* Icon */}
          <View style={[
            styles.iconContainer,
            {
              backgroundColor: `${colors.tint}22`,
            }
          ]}>
            {loading ? (
              <View style={styles.loadingIcon}>
                <View style={[styles.loadingDot, { backgroundColor: colors.tint }]} />
              </View>
            ) : (
              <MessageCircle 
                size={16} 
                color={colors.tint} 
              />
            )}
          </View>
          
          {/* Title */}
          <View style={styles.titleContainer}>
            {loading ? (
              <View style={[
                styles.loadingTitle,
                { backgroundColor: `${colors.tint}22` }
              ]} />
            ) : (
              <Text style={[
                styles.title,
                { color: colors.tint }
              ]}>
                💭 {formatMessageType(messageType)}
              </Text>
            )}
          </View>
        </View>
        
        {/* Expand button indicator */}
        {!loading && (
          <View
            style={[
              styles.expandButton,
              {
                backgroundColor: `${colors.tint}11`,
              }
            ]}
          >
            <Animated.View
              style={{
                transform: [{
                  rotate: rotateAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '180deg'],
                  }),
                }],
              }}
            >
              <ChevronDown size={16} color={colors.tint} />
            </Animated.View>
          </View>
        )}
      </View>

      {/* Push text (always visible) */}
      <View style={styles.pushTextContainer}>
        {loading ? (
          <View>
            <View style={[
              styles.loadingLine,
              { backgroundColor: `${colors.tint}22` }
            ]} />
            <View style={[
              styles.loadingLine,
              styles.loadingLineShort,
              { backgroundColor: `${colors.tint}22` }
            ]} />
          </View>
        ) : (
          <Text style={[
            styles.pushText,
            { color: colors.tint }
          ]}>
            {pushText}
          </Text>
        )}
      </View>

      {/* Full message (expandable) */}
      {!loading && (
        <Animated.View 
          style={[
            styles.fullMessageContainer,
            {
              opacity: fadeAnim,
              maxHeight: heightAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 500], // Increased for longer messages
              }),
              transform: [{
                translateY: heightAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-10, 0], // Slide up effect
                }),
              }],
              marginTop: heightAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 12],
              }),
              overflow: 'hidden',
              borderTopColor: `${colors.tint}22`,
            }
          ]}
        >
          <Text style={[
            styles.fullMessage,
            { color: colors.tint }
          ]}>
            {fullMessage}
          </Text>
          <Text style={[
            styles.timestamp,
            { color: colors.tint }
          ]}>
            {new Date().toLocaleDateString()}
          </Text>
        </Animated.View>
      )}
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  loadingIcon: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    opacity: 0.5,
  },
  titleContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
  },
  loadingTitle: {
    height: 16,
    borderRadius: 4,
    width: 140,
  },
  expandButton: {
    padding: 4,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pushTextContainer: {
    marginBottom: 0,
  },
  pushText: {
    fontSize: 14,
    lineHeight: 20,
  },
  loadingLine: {
    height: 16,
    borderRadius: 4,
    marginBottom: 8,
  },
  loadingLineShort: {
    width: '75%',
    marginBottom: 0,
  },
  fullMessageContainer: {
    borderTopWidth: 1,
  },
  fullMessage: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
    paddingTop: 12,
  },
  timestamp: {
    fontSize: 12,
    opacity: 0.8,
  },
});
