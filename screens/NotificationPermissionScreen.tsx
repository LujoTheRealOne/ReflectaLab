import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  useColorScheme,
  Animated,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/Colors';
import { useNotificationPermissions } from '@/hooks/useNotificationPermissions';
import { useNotificationPermissionModal } from '@/hooks/useNotificationPermissionModal';

interface NotificationFeatureProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

function NotificationFeature({ icon, title, description }: NotificationFeatureProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <View style={styles.featureItem}>
      <View style={[styles.featureIcon, { backgroundColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }]}>
        {icon}
      </View>
      <View style={styles.featureText}>
        <Text style={[styles.featureTitle, { color: colors.text }]}>
          {title}
        </Text>
        <Text style={[styles.featureDescription, { color: colors.icon }]}>
          {description}
        </Text>
      </View>
    </View>
  );
}

function AnimatedBell() {
  const bellAnimation = React.useRef(new Animated.Value(0)).current;
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  React.useEffect(() => {
    const animate = () => {
      Animated.sequence([
        Animated.timing(bellAnimation, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(bellAnimation, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setTimeout(animate, 2000);
      });
    };

    animate();
  }, [bellAnimation]);

  const rotation = bellAnimation.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: ['0deg', '-15deg', '0deg', '15deg', '0deg'],
  });

  return (
    <View style={styles.bellContainer}>
      <Animated.View
        style={[
          styles.bell,
          {
            transform: [{ rotate: rotation }],
          },
        ]}
      >
        <Ionicons
          name="notifications"
          size={64}
          color={colors.tint}
        />
      </Animated.View>
      
      {/* Vibration lines */}
      <View style={[styles.vibrationLine, styles.vibrationLineLeft, { backgroundColor: colors.tint }]} />
      <View style={[styles.vibrationLine, styles.vibrationLineRight, { backgroundColor: colors.tint }]} />
      <View style={[styles.vibrationLine, styles.vibrationLineLeftOuter, { backgroundColor: colors.tint }]} />
      <View style={[styles.vibrationLine, styles.vibrationLineRightOuter, { backgroundColor: colors.tint }]} />
    </View>
  );
}

export default function NotificationPermissionScreen() {
  const navigation = useNavigation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { requestPermissions, savePushTokenToFirestore } = useNotificationPermissions();
  const { dismissModal } = useNotificationPermissionModal();

  const handleTurnOnNotifications = async () => {
    try {
      // First request system permissions
      const granted = await requestPermissions();
      if (granted) {
        // Save push token to Firestore (this also sets enabled: true)
        const tokenSaved = await savePushTokenToFirestore();
        if (tokenSaved) {
          await dismissModal();
          navigation.goBack();
        }
      }
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
    }
  };

  const handleMaybeLater = async () => {
    await dismissModal();
    navigation.goBack();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header with bell icon */}
      <View style={styles.header}>
        <AnimatedBell />
        
        <Text style={[styles.title, { color: colors.text }]}>
          Don't Miss a Moment{'\n'}of Growth
        </Text>
        
        <Text style={[styles.subtitle, { color: colors.icon }]}>
          For the best results and consistent growth, we highly recommend enabling notifications.
        </Text>
      </View>

      {/* Features list */}
      <View style={styles.featuresContainer}>
        <NotificationFeature
          icon={
            <Ionicons
              name="flame"
              size={24}
              color={colors.tint}
            />
          }
          title="Daily Streaks"
          description="Start your day strong with timely prompts to hit your goals."
        />
        
        <NotificationFeature
          icon={
            <MaterialIcons
              name="schedule"
              size={24}
              color={colors.tint}
            />
          }
          title="Commitment Reminders"
          description="Stay on track with gentle nudges about your commitments."
        />
        
        <NotificationFeature
          icon={
            <Ionicons
              name="chatbubble-ellipses"
              size={24}
              color={colors.tint}
            />
          }
          title="Coach Messages and Check Ins"
          description="Receive personalized coaching and check-in reminders."
        />
      </View>

      {/* Bottom actions */}
      <View style={styles.actionsContainer}>
        <Button
          style={{ width: '100%' }}
          variant="primary"
          size="lg"
          onPress={handleTurnOnNotifications}
        >
          Turn On Notifications
        </Button>
        
        <TouchableOpacity
          onPress={handleMaybeLater}
          style={styles.maybeLaterButton}
        >
          <Text style={[styles.maybeLaterText, { color: colors.tint }]}>
            Maybe Later
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    flexDirection: 'column',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 50,
  },
  header: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 50,
  },
  bellContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    height: 120,
    width: 120,
  },
  bell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  vibrationLine: {
    position: 'absolute',
    height: 2,
    opacity: 0.6,
  },
  vibrationLineLeft: {
    width: 20,
    top: 30,
    left: -15,
    transform: [{ rotate: '-45deg' }],
  },
  vibrationLineRight: {
    width: 20,
    top: 30,
    right: -15,
    transform: [{ rotate: '45deg' }],
  },
  vibrationLineLeftOuter: {
    width: 16,
    top: 25,
    left: -25,
    transform: [{ rotate: '-45deg' }],
    opacity: 0.4,
  },
  vibrationLineRightOuter: {
    width: 16,
    top: 25,
    right: -25,
    transform: [{ rotate: '45deg' }],
    opacity: 0.4,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 36,
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 12,
  },
  featuresContainer: {
    gap: 24,
    marginBottom: 40,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    flex: 1,
    paddingTop: 2,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  actionsContainer: {
    gap: 16,
    alignItems: 'center',
  },
  maybeLaterButton: {
    paddingVertical: 12,
  },
  maybeLaterText: {
    fontSize: 16,
    fontWeight: '500',
  },
});
