import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
  ActivityIndicator,
} from 'react-native';
import { ExternalLink, MessageCircle } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Button } from './ui/Button';

interface CoachingSessionCardProps {
  title?: string;
  messageCount?: number;
  sessionType?: string;
  onOpenConversation?: () => void;
  loading?: boolean;
}

export default function CoachingSessionCard({
  title = "Goal breakout session",
  messageCount = 0,
  sessionType = "Coach chat",
  onOpenConversation,
  loading = false
}: CoachingSessionCardProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <View style={[styles.container, { 
      backgroundColor: colors.background,
      borderColor: `${colors.tint}20`,
      shadowColor: colors.text,
    }]}>
      <View style={styles.content}>
        <View style={styles.leftSection}>
          {/* Chat bubble icon */}
          <View style={[styles.iconContainer, { 
            backgroundColor: `${colors.tint}15`,
          }]}>
            {loading ? (
              <ActivityIndicator size="small" color={colors.tint} />
            ) : (
              <MessageCircle size={20} color={colors.tint} />
            )}
          </View>
          
          {/* Content */}
          <View style={styles.textContent}>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
              {loading ? (
                <View style={[styles.skeleton, styles.titleSkeleton, { 
                  backgroundColor: `${colors.text}20` 
                }]} />
              ) : (
                title
              )}
            </Text>
            <Text style={[styles.subtitle, { color: `${colors.text}60` }]} numberOfLines={1}>
              {loading ? (
                <View style={[styles.skeleton, styles.subtitleSkeleton, { 
                  backgroundColor: `${colors.text}15` 
                }]} />
              ) : (
                `${sessionType} • ${messageCount} messages`
              )}
            </Text>
          </View>
        </View>
        
        {/* Button */}
        <Button
          variant="secondary"
          style={[styles.button, { 
            backgroundColor: `${colors.text}08`,
          }]}
          onPress={onOpenConversation}
          disabled={loading}
        >
          <ExternalLink size={20} color={colors.text} />
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContent: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '400',
  },
  button: {
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 12,
    minWidth: 40,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  skeleton: {
    borderRadius: 4,
  },
  titleSkeleton: {
    height: 16,
    width: 120,
    marginBottom: 4,
  },
  subtitleSkeleton: {
    height: 14,
    width: 80,
  },
});
