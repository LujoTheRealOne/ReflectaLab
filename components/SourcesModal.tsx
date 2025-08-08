import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Animated,
  Dimensions,
  ScrollView,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useColorScheme } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Button } from '@/components/ui/Button';
import { SafeAreaView } from 'react-native-safe-area-context';
import { insightSource } from '@/types/insights';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Animated Spinner Component
const AnimatedSpinner = ({ size = 12, colors }: { size?: number, colors: any }) => {
  const spinValue = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const spinAnimation = Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      })
    );

    spinAnimation.start();

    return () => {
      spinAnimation.stop();
    };
  }, [spinValue]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: Math.max(1.5, size / 8),
        borderColor: `${colors.text}20`,
        borderTopColor: `${colors.text}80`,
        transform: [{ rotate: spin }],
      }}
    />
  );
};

// Use the exact same type as defined in types/insights.ts
export type InsightSource = insightSource;

interface SourcesModalProps {
  isVisible: boolean;
  onClose: () => void;
  title: string;
  sources: InsightSource[];
  overlayOpacity?: Animated.Value;
  isProcessing?: boolean;
}

export default function SourcesModal({
  isVisible,
  onClose,
  title,
  sources,
  overlayOpacity,
  isProcessing = false
}: SourcesModalProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  // Debug: Log received sources
  console.log('🔍 SourcesModal received:', {
    isVisible,
    title,
    sourcesCount: sources?.length,
    sources: sources?.slice(0, 2) // Show first 2 sources for debugging
  });

  if (!isVisible) return null;

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <View style={styles.overlay}>
      {/* Background Blur */}
      <Animated.View
        style={[
          styles.blurContainer,
          overlayOpacity && { opacity: overlayOpacity }
        ]}
      >
        <BlurView
          intensity={40}
          tint={colorScheme === 'dark' ? 'dark' : 'light'}
          style={styles.blurView}
        />
      </Animated.View>

      {/* Content directly on blur */}
      <Animated.View
        style={[
          styles.animatedContentContainer,
          overlayOpacity && { opacity: overlayOpacity }
        ]}
      >
        <SafeAreaView style={styles.contentContainer}>
        {/* Title */}
        <Text style={[styles.title, { color: colors.text }]}>
          Sources
        </Text>

        {/* Sources List */}
        <ScrollView 
          style={styles.sourcesList}
          contentContainerStyle={styles.sourcesContent}
          showsVerticalScrollIndicator={false}
        >
          {sources.length === 0 ? (
            <View style={styles.emptyState}>
              {isProcessing ? (
                <>
                  <AnimatedSpinner size={20} colors={colors} />
                  <Text style={[styles.emptyText, { color: `${colors.text}60`, marginTop: 12 }]}>
                    Extracting sources from your conversation...
                  </Text>
                  <Text style={[styles.emptySubtext, { color: `${colors.text}40` }]}>
                    This usually takes 30-60 seconds
                  </Text>
                </>
              ) : (
                <>
                  <Text style={[styles.emptyText, { color: `${colors.text}60` }]}>
                    No sources available yet.
                  </Text>
                  <Text style={[styles.emptySubtext, { color: `${colors.text}40` }]}>
                    Complete a coaching session to generate insights with sources from your conversation.
                  </Text>
                </>
              )}
            </View>
          ) : (
            sources.map((source, index) => (
              <View
                key={index}
                style={[
                  styles.sourceItem,
                  {
                    backgroundColor: `${colors.background}99`,
                    borderColor: `${colors.text}10`,
                    borderWidth: 1,
                  }
                ]}
              >
                <Text style={[styles.quote, { color: colors.text }]}>
                  "{source.quote}"
                </Text>
                <Text style={[styles.date, { color: `${colors.text}60` }]}>
                  Extracted on {formatDate(source.extractedAt)}
                </Text>
              </View>
            ))
          )}
        </ScrollView>

        {/* Close Button at Bottom */}
        <View style={styles.buttonContainer}>
          <Button
            variant="secondary"
            size="lg"
            onPress={onClose}
            style={styles.closeButton}
          >
            Close
          </Button>
        </View>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  blurContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  blurView: {
    flex: 1,
  },
  animatedContentContainer: {
    flex: 1,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    gap: 24,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 24,
    textAlign: 'center',
  },
  sourcesList: {
    flex: 1,
  },
  sourcesContent: {
    flexGrow: 1,
    paddingBottom: 20,
    gap: 18,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  sourceItem: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  quote: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 8,
    fontStyle: 'italic',
  },
  date: {
    fontSize: 12,
    fontWeight: '500',
  },
  footer: {
    paddingTop: 20,
    paddingBottom: 10,
  },
  footerText: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
  buttonContainer: {
    paddingTop: 20,
  },
  closeButton: {
    width: '100%',
    borderRadius: 24,
  },
});