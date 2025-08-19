import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
  ActivityIndicator,
} from 'react-native';
import { ExternalLink, MessageCircle, MessagesSquare } from 'lucide-react-native';
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
      borderColor: `${colors.tint}15`,
      shadowColor: colors.text,
    }]}>
      <View style={styles.content}>
        <View style={styles.textContent}>
          <View style={styles.titleRow}>
            {loading ? (
              <ActivityIndicator size="small" color={colors.tint} style={styles.titleIcon} />
            ) : (
              <MessagesSquare size={20} color={colors.tint} style={styles.titleIcon} />
            )}
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
              {loading ? (
                <View style={[styles.skeleton, styles.titleSkeleton, { 
                  backgroundColor: `${colors.text}20` 
                }]} />
              ) : (
                title
              )}
            </Text>
          </View>
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
        
        <Button
          variant="secondary"
          style={[styles.button, { 
            backgroundColor: `${colors.text}08`,
          }]}
          size="sm"
          onPress={onOpenConversation}
          disabled={loading}
        >
          <Text style={[styles.buttonText, { color: colors.text }]}>
            Open Conversation
          </Text>
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
  },
  content: {
    flexDirection: 'column',
  },
  textContent: {
    gap: 4,
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  titleIcon: {
    marginRight: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '400',
    marginLeft: 4,
  },
  button: {
    width: '100%',
    borderWidth: 0,
    paddingVertical: 10
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '500',
    opacity: 0.7,
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
