import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  useColorScheme,
  View
} from 'react-native';

import { Button } from '@/components/ui/Button';
import Skeleton from '@/components/skeleton/Skeleton';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/hooks/useAuth';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useInsights } from '@/hooks/useInsights';
import { useNotificationPermissions } from '@/hooks/useNotificationPermissions';
import { useRevenueCat } from '@/hooks/useRevenueCat';
import { useOnboardingProgress } from '@/hooks/useOnboardingProgress';
import { useSettingsCache } from '@/hooks/useSettingsCache';
import { useActiveCommitments } from '@/hooks/useActiveCommitments';
import { useBiometricAuth } from '@/hooks/useBiometricAuth';
import { useNavigation } from '@react-navigation/native';
import * as Application from 'expo-application';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { ChevronDown, ChevronLeft, Crown, ExternalLink, FileText, Info, LogOut, Star, RotateCcw, Compass } from 'lucide-react-native';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { FirestoreService } from '@/lib/firestore';

export default function SettingsScreen() {
  const navigation = useNavigation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { user, signOut, firebaseUser } = useAuth();
  
  // Use settings cache for instant loading
  const { cachedData, refreshSettings } = useSettingsCache();
  const { trackNotificationPermissionRequested, trackNotificationPermissionGranted, trackNotificationPermissionDenied, trackCoachingMessagesOptIn } = useAnalytics();
  const { insights, loading: insightsLoading, hasInsights } = useInsights();
  const {
    requestPermissions,
    expoPushToken,
    savePushTokenToFirestore,
    permissionStatus,
    checkPermissions
  } = useNotificationPermissions();
  
  const { 
    initialized: rcInitializedLive, 
    isPro: isProLive, 
    customerInfo, 
    presentPaywall, 
    restorePurchases,
    activeEntitlementIds 
  } = useRevenueCat(firebaseUser?.uid);
  
  // Onboarding progress hook
  const { clearProgress: clearOnboardingProgress } = useOnboardingProgress();

  // Active commitments hook
  const { commitments, loading: commitmentsLoading, checkInCommitment } = useActiveCommitments();
  
  const {
    isSupported: biometricSupported,
    isEnrolled: biometricEnrolled,
    isEnabled: biometricEnabled,
    isLoading: biometricLoading,
    setBiometricEnabled,
    getAuthTypeLabel,
  } = useBiometricAuth();

  // State for toggles
  const [pushNotificationsEnabled, setPushNotificationsEnabled] = useState(false);
  const [coachingMessages, setCoachingMessages] = useState(true);
  const [whatsappStatus, setWhatsappStatus] = useState<{
    verified: boolean;
    phoneNumber?: string;
    verificationStatus?: 'NONE' | 'PENDING' | 'VERIFIED' | 'FAILED';
  }>({ verified: false });

  // Get user info with priority: live data > cache > fallback
  const getUserName = () => {
    // Priority 1: Live Clerk user data
    if (user?.firstName) {
      return `${user.firstName} ${user.lastName || ''}`.trim();
    }
    
    // Priority 2: Live Firebase user data
    if (firebaseUser?.displayName) {
      return firebaseUser.displayName;
    }
    
    // Priority 3: Cached data
    if (cachedData?.userData?.user?.firstName) {
      return `${cachedData.userData.user.firstName} ${cachedData.userData.user.lastName || ''}`.trim();
    }
    
    // Priority 4: Cached Firebase data
    if (cachedData?.userData?.firebaseUser?.displayName) {
      return cachedData.userData.firebaseUser.displayName;
    }
    
    // Fallback
    return 'User';
  };

  const userInfo = {
    name: getUserName(),
    email: user?.primaryEmailAddress?.emailAddress || 
           firebaseUser?.email || 
           cachedData?.userData?.user?.emailAddresses?.[0]?.emailAddress || 
           cachedData?.userData?.firebaseUser?.email || 
           'No email',
  };

  // Only show skeleton on true first load (no cache yet) AND when it's actually loading
  const shouldShowSkeleton = cachedData === null && !user;

  // Get subscription info from cache
  const isPro = cachedData?.subscriptionData?.isPro || false;
  const rcInitialized = cachedData?.subscriptionData?.initialized || false;

  // Get notification permissions from cache
  const cachedPermissionStatus = cachedData?.permissionsData?.notificationStatus || 'undetermined';
  const cachedExpoPushToken = cachedData?.permissionsData?.expoPushToken;

  const [isLoading, setIsLoading] = useState(false);

  // Subscription handlers
  const handleUpgradeToPro = async () => {
    try {
      setIsLoading(true);
      const success = await presentPaywall();
      if (success) {
        Alert.alert('Success', 'Welcome to Reflecta Pro! 🎉');
      }
    } catch (error) {
      console.error('Error upgrading to Pro:', error);
      Alert.alert('Error', 'Failed to process upgrade. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleManageSubscription = () => {
    Alert.alert(
      'Manage Subscription',
      'To manage your subscription, you can use the App Store or restore purchases.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'App Store', 
          onPress: () => Linking.openURL('https://apps.apple.com/account/subscriptions') 
        },
        { 
          text: 'Restore Purchases', 
          onPress: async () => {
            try {
              setIsLoading(true);
              const success = await restorePurchases();
              Alert.alert(
                success ? 'Success' : 'No Purchases Found',
                success 
                  ? 'Your purchases have been restored.' 
                  : 'No previous purchases were found for this account.'
              );
            } catch (error) {
              Alert.alert('Error', 'Failed to restore purchases. Please try again.');
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  // Load push notification preference from Firestore (background loading)
  const loadPushNotificationPreference = useCallback(async () => {
    if (!firebaseUser?.uid) return;

    // Use cached permission status first for instant display
    if (cachedPermissionStatus === 'granted') {
      setPushNotificationsEnabled(true);
    }

    try {
      // Load from Firestore in background for accuracy
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        const enabled = userData?.mobilePushNotifications?.enabled ?? false;
        setPushNotificationsEnabled(enabled);
        console.log('📱 Loaded push notification preference:', enabled);
      }
    } catch (error) {
      console.error('Error loading push notification preference:', error);
    }
  }, [firebaseUser, cachedPermissionStatus]);

  // Load coaching messages preference from Firestore
  const loadCoachingMessagesPreference = useCallback(async () => {
    if (!firebaseUser?.uid) return;

    try {
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        const enabled = userData?.coachingConfig?.enableCoachingMessages ?? true;
        setCoachingMessages(enabled);
        console.log('🤖 Loaded coaching messages preference:', enabled);
      }
    } catch (error) {
      console.error('Error loading coaching messages preference:', error);
    }
  }, [firebaseUser]);

  // Save push notification preference to Firestore
  const savePushNotificationPreference = useCallback(async (enabled: boolean) => {
    if (!firebaseUser?.uid) return;

    try {
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      await updateDoc(userDocRef, {
        'mobilePushNotifications.enabled': enabled,
        updatedAt: new Date()
      });
      console.log('📱 Saved push notification preference:', enabled);
    } catch (error) {
      console.error('Error saving push notification preference:', error);
      throw error;
    }
  }, [firebaseUser]);

  // Save coaching messages preference to Firestore
  const saveCoachingMessagesPreference = useCallback(async (enabled: boolean) => {
    if (!firebaseUser?.uid) return;

    try {
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      await updateDoc(userDocRef, {
        'coachingConfig.enableCoachingMessages': enabled,
        updatedAt: new Date()
      });
      console.log('🤖 Saved coaching messages preference:', enabled);
    } catch (error) {
      console.error('Error saving coaching messages preference:', error);
      throw error;
    }
  }, [firebaseUser]);

  // Load preferences in background (non-blocking)
  useEffect(() => {
    // Use cached data first for instant display
    if (cachedPermissionStatus === 'granted') {
      setPushNotificationsEnabled(true);
    }

    // Load fresh data in background without blocking UI
    setTimeout(() => {
      loadPushNotificationPreference();
      loadCoachingMessagesPreference();
      checkPermissions();
    }, 100); // Small delay to ensure UI renders first
  }, [loadPushNotificationPreference, loadCoachingMessagesPreference, checkPermissions]);

  // Handle push notification toggle
  const handlePushNotificationToggle = useCallback(async (newValue: boolean) => {
    if (isLoading) return;

    // Optimistic update - toggle immediately for better UX
    const previousValue = pushNotificationsEnabled;
    setPushNotificationsEnabled(newValue);
    setIsLoading(true);

    try {
      if (newValue) {
        // Enabling notifications - request permissions first
        trackNotificationPermissionRequested();
        const granted = await requestPermissions();

        if (granted) {
          // Permissions granted, save preference and token
          trackNotificationPermissionGranted({ granted_via: 'settings' });
          await savePushNotificationPreference(true);
        } else {
          // Permissions denied - revert the switch
          trackNotificationPermissionDenied({ denied_via: 'settings' });
          setPushNotificationsEnabled(false);
          Alert.alert(
            'Permissions Required',
            'To receive notifications, please enable them in your device settings.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', style: 'default', onPress: () => Linking.openSettings() }
            ]
          );
        }
      } else {
        // Disabling notifications
        await savePushNotificationPreference(false);
      }
    } catch (error) {
      console.error('Error toggling push notifications:', error);
      // Revert to previous state on error
      setPushNotificationsEnabled(previousValue);
      Alert.alert(
        'Error',
        'Failed to update notification settings. Please try again.',
        [{ text: 'OK', style: 'default' }]
      );
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, pushNotificationsEnabled, requestPermissions, savePushNotificationPreference]);

  // Handle coaching messages toggle
  const handleCoachingMessagesToggle = useCallback(async (newValue: boolean) => {
    if (isLoading) return;

    // Optimistic update - toggle immediately for better UX
    const previousValue = coachingMessages;
    setCoachingMessages(newValue);
    setIsLoading(true);

    try {
      // Track coaching messages opt-in
      trackCoachingMessagesOptIn({
        opted_in: newValue,
        context: 'settings',
      });
      await saveCoachingMessagesPreference(newValue);
    } catch (error) {
      console.error('Error toggling coaching messages:', error);
      // Revert to previous state on error
      setCoachingMessages(previousValue);
      Alert.alert(
        'Error',
        'Failed to update coaching messages setting. Please try again.',
        [{ text: 'OK', style: 'default' }]
      );
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, coachingMessages, saveCoachingMessagesPreference]);

  // Handle commitment check-in
  const handleCommitmentCheckIn = useCallback(async (commitmentId: string, completed: boolean) => {
    if (isLoading) return;

    setIsLoading(true);
    try {
      await checkInCommitment(commitmentId, completed);
      
      // Show success feedback
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Alert.alert(
        'Success',
        completed ? 'Great job! Your commitment has been marked as done.' : 'Thanks for the update. Keep going!',
        [{ text: 'OK', style: 'default' }]
      );
    } catch (error) {
      console.error('Error checking in commitment:', error);
      Alert.alert(
        'Error',
        'Failed to update commitment. Please try again.',
        [{ text: 'OK', style: 'default' }]
      );
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, checkInCommitment]);

  // Handle biometric authentication toggle
  const handleBiometricToggle = useCallback(async (newValue: boolean) => {
    if (biometricLoading || isLoading) return;

    setIsLoading(true);

    try {
      const success = await setBiometricEnabled(newValue);
      
      if (!success && newValue) {
        Alert.alert(
          'Authentication Failed',
          'Face ID authentication was cancelled or failed. Please try again.',
          [{ text: 'OK', style: 'default' }]
        );
      }
    } catch (error) {
      console.error('Error toggling biometric authentication:', error);
      
      let errorMessage = 'Failed to update Face ID settings. Please try again.';
      
      if (error instanceof Error) {
        if (error.message.includes('not supported')) {
          errorMessage = 'Face ID is not supported on this device.';
        } else if (error.message.includes('not enrolled')) {
          errorMessage = 'Please set up Face ID in your device settings first.';
        }
      }
      
      Alert.alert(
        'Error',
        errorMessage,
        (error instanceof Error && error.message.includes('not enrolled')) ? [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', style: 'default', onPress: () => Linking.openSettings() }
        ] : [{ text: 'OK', style: 'default' }]
      );
    } finally {
      setIsLoading(false);
    }
  }, [biometricLoading, isLoading, setBiometricEnabled]);

  const handleBack = () => {
    navigation.goBack();
  };

  const handleManageAccount = () => {
    try {
      if (!user) {
        Alert.alert('Error', 'Please sign in to manage your account.');
        return;
      }

      // Use Clerk's account portal URL
      // This provides the UserProfile component in a web interface
      const accountPortalUrl = 'https://accounts.reflecta.so/user';

      Alert.alert("Manage Account", "For security reasons, you will have to re-authenticate to manage your account. You will be redirected to the account portal.",
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Continue', style: 'default', onPress: async () => {
              // Open in WebBrowser with popup presentation
              await WebBrowser.openBrowserAsync(accountPortalUrl, {
                controlsColor: colors.tint,
                toolbarColor: colors.background,
                showTitle: true,
              });
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error opening account management:', error);
      Alert.alert('Error', 'Failed to open account management. Please try again.');
    }
  };

  const handleDisconnectWhatsApp = () => {
    Alert.alert(
      'Disconnect WhatsApp',
      'Are you sure you want to disconnect your WhatsApp account?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Disconnect', style: 'destructive', onPress: () => { } }
      ]
    );
  };

  const handleResetOnboarding = () => {
    Alert.alert(
      'Reset Onboarding',
      'Are you sure you want to reset your onboarding? This will clear all your onboarding progress and you will need to complete the onboarding process again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('🔄 Settings - Resetting onboarding progress...');
              
              // Clear AsyncStorage onboarding progress
              await clearOnboardingProgress();
              console.log('✅ Settings - AsyncStorage onboarding progress cleared');
              
              // Clear Firebase onboarding completion status
              if (firebaseUser?.uid) {
                console.log('🔄 Settings - Resetting Firebase onboarding status...');
                await FirestoreService.updateUserAccount(firebaseUser.uid, {
                  onboardingData: {
                    onboardingCompleted: false,
                    onboardingCompletedAt: 0,
                    whatDoYouDoInLife: [],
                    selfReflectionPracticesTried: [],
                    clarityInLife: 0,
                    stressInLife: 0,
                  },
                  updatedAt: new Date(),
                });
                console.log('✅ Settings - Firebase onboarding status reset');
              }
              
              Alert.alert(
                'Onboarding Reset',
                'Your onboarding has been reset successfully. Please restart the app to go through the onboarding process again.',
                [{ text: 'OK', style: 'default' }]
              );
            } catch (error) {
              console.error('❌ Settings - Error resetting onboarding:', error);
              Alert.alert('Error', 'Failed to reset onboarding. Please try again.');
            }
          }
        }
      ]
    );
  };

  const handleResetCompass = () => {
    Alert.alert(
      'Reset Life Compass',
      'Are you sure you want to reset your Life Compass? This will permanently delete all your compass insights including Main Focus, Key Blockers, and Your Plan. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('🧭 Settings - Resetting compass insights...');
              
              if (firebaseUser?.uid) {
                await FirestoreService.deleteUserInsights(firebaseUser.uid);
                console.log('✅ Settings - Compass insights deleted successfully');
                
                Alert.alert(
                  'Compass Reset',
                  'Your Life Compass has been reset successfully. New insights will be generated as you continue journaling and coaching.',
                  [{ text: 'OK', style: 'default' }]
                );
              } else {
                throw new Error('User not authenticated');
              }
            } catch (error) {
              console.error('❌ Settings - Error resetting compass:', error);
              Alert.alert('Error', 'Failed to reset compass. Please try again.');
            }
          }
        }
      ]
    );
  };

  const handleSignOut = () => {
    console.log('🚪 Settings - Sign out button pressed');
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            console.log('🚪 Settings - User confirmed sign out, calling signOut()...');
            try {
              await signOut();
              console.log('🚪 Settings - signOut() completed successfully');
            } catch (error) {
              console.error('❌ Settings - Sign out error:', error);
              Alert.alert('Error', `Failed to sign out: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`);
            }
          }
        }
      ]
    );
  };

  const handleViewInsights = async () => {
    console.log('🧭 Settings - handleViewInsights called');
    console.log('🧭 Settings - rcInitialized:', rcInitialized);
    console.log('🧭 Settings - isPro:', isPro);
    
    // Add haptic feedback to confirm button press
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // BYPASS: Skip RevenueCat checks for compass navigation
    console.log('🧭 Settings - Bypassing RevenueCat checks, navigating directly to CompassStory');
    (navigation as any).navigate('CompassStory');
    
    /* ORIGINAL CODE - TEMPORARILY BYPASSED
    if (!rcInitialized) {
      console.log('🧭 Settings - RevenueCat not initialized, returning');
      return; // Wait for RevenueCat init
    }
    
    if (!isPro) {
      console.log('🧭 Settings - User is not Pro, showing paywall');
      const unlocked = await presentPaywall();
      console.log('🧭 Compass insights access Pro check:', unlocked ? 'unlocked' : 'cancelled');
      if (!unlocked) {
        console.log('🧭 Settings - Paywall cancelled, not navigating');
        return; // Don't navigate if paywall was cancelled
      }
    }
    
    console.log('🧭 Settings - Navigating to CompassStory');
    (navigation as any).navigate('CompassStory');
    */
  };

  // Helper function to format the last updated time
  const formatLastUpdated = (timestamp?: number) => {
    if (!timestamp) return 'No insights yet';

    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} min ago`;
    if (diffInHours < 24) return `${diffInHours}h ago`;

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays}d ago`;
    return `${Math.floor(diffInDays / 7)}w ago`;
  };

  // Calculate today's stats (placeholder - can be connected to real data later)
  const getTodayStats = () => {
    // This could be connected to real user activity data
    // For now, showing placeholder data
    const minutes = Math.floor(Math.random() * 400) + 50; // Random between 50-450
    return {
      minutes,
      activities: ['journaling', 'coaching', 'meditation'] // Could track actual activities
    };
  };

  const todayStats = getTodayStats();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        {shouldShowSkeleton ? (
          <View style={{ width: 120, height: 24, backgroundColor: '#E5E5E7', borderRadius: 6 }} />
        ) : (
          <Text style={[styles.userName, { color: colors.text }]}>
            {userInfo.name}
          </Text>
        )}
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 80 }}>
        {/** Skeleton header when loading fresh */}
        {shouldShowSkeleton && (
          <View style={{ paddingHorizontal: 10, marginTop: 10 }}>
            <Skeleton style={{ width: 200, height: 24, borderRadius: 6, marginBottom: 16 }} />
            <Skeleton style={{ width: '100%', height: 180, borderRadius: 16, marginBottom: 20 }} />
            <Skeleton style={{ width: '60%', height: 16, borderRadius: 6, marginBottom: 8 }} />
            <Skeleton style={{ width: '40%', height: 16, borderRadius: 6 }} />
          </View>
        )}
        {/* Settings Title */}
        {/* <Text style={[styles.title, { color: colors.text }]}>Settings</Text> */}

        {/* Your Compass Section */}
        {!shouldShowSkeleton && (
          <>
            {/* Active Commitments Section */}
            <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 10, marginBottom: 10 }]}>Active Commitments</Text>
            
            {commitmentsLoading ? (
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.commitmentsScrollContent}
                style={styles.commitmentsScrollView}
              >
                {[1, 2].map((_, index) => (
                  <View key={index} style={[styles.commitmentCard, { backgroundColor: colorScheme === 'light' ? '#FFFFFF' : '#222' }]}>
                    <Skeleton style={{ width: '60%', height: 16, borderRadius: 4, marginBottom: 8 }} />
                    <Skeleton style={{ width: '80%', height: 14, borderRadius: 4, marginBottom: 20 }} />
                    <View style={styles.commitmentActions}>
                      <Skeleton style={{ flex: 1, height: 32, borderRadius: 10, marginRight: 4 }} />
                      <Skeleton style={{ flex: 1, height: 32, borderRadius: 10, marginLeft: 4 }} />
                    </View>
                  </View>
                ))}
              </ScrollView>
            ) : commitments.length > 0 ? (
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.commitmentsScrollContent}
                style={styles.commitmentsScrollView}
              >
                {commitments.map((commitment, index) => (
                  <View 
                    key={commitment.id}
                    style={[styles.commitmentCard, { 
                      backgroundColor: colorScheme === 'light' ? '#FFFFFF' : '#222',
                      marginRight: index === commitments.length - 1 ? 20 : 12
                    }]}
                  >
                    {/* Header with title and stats */}
                    <View style={styles.commitmentHeader}>
                      <View style={styles.commitmentTitleContainer}>
                        <Text style={[styles.commitmentTitle, { color: '#262626' }]} numberOfLines={1}>
                          {commitment.title}
                        </Text>
                        <Text style={[styles.commitmentDescription, { color: colors.text, opacity: .5 }]} numberOfLines={2}>
                          {commitment.description}
                        </Text>
                      </View>
                      <View style={styles.commitmentStats}>
                        <Text style={[styles.commitmentStatsText, { color: colors.text, opacity: .6 }]}>
                          {commitment.currentStreakCount} day streak
                        </Text>
                        <Text style={[styles.commitmentTypeText, { color: colors.text, opacity: .5 }]}>
                          {commitment.type === 'one-time' ? 'One-time' : 'Recurring'}
                        </Text>
                      </View>
                    </View>

                    {/* Action buttons */}
                    <View style={styles.commitmentActions}>
                      <TouchableOpacity 
                        style={[styles.actionButton, styles.notDoneButton, { backgroundColor: '#F2F2F2' }]}
                        onPress={() => handleCommitmentCheckIn(commitment.id, false)}
                        disabled={isLoading}
                      >
                        <Text style={[styles.actionButtonText, { color: colors.text, opacity: .6 }]} numberOfLines={1}>
                          {isLoading ? 'Processing...' : 'Not done'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.actionButton, styles.doneButton, { backgroundColor: '#000000' }]}
                        onPress={() => handleCommitmentCheckIn(commitment.id, true)}
                        disabled={isLoading}
                      >
                        <Text style={[styles.actionButtonText, { color: colors.background, opacity: .91 }]} numberOfLines={1}>
                          {isLoading ? 'Processing...' : 'Done'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <View 
                style={[styles.emptyCommitmentsCard, { 
                  backgroundColor: colorScheme === 'light' ? '#FFFFFF' : '#222'
                }]}
              >
                <Text style={[styles.commitmentTitle, { color: colors.text, opacity: .5, textAlign: 'center' }]}>
                  No Active Commitments
                </Text>
                <Text style={[styles.commitmentDescription, { color: colors.text, opacity: .3, textAlign: 'center', marginTop: 4 }]}>
                  Create commitments through coaching sessions
                </Text>
              </View>
            )}

            {/* Compass Cards Grid */}
            <View style={styles.compassCardsGrid}>
              {/* Main Focus Card */}
              <TouchableOpacity 
                style={[styles.compassCard, { 
                  backgroundColor: colorScheme === 'light' ? '#FFFFFF' : '#222'
                }]}
                onPress={handleViewInsights}
              >
                <View style={styles.compassCardHeader}>
                  <View style={styles.compassCardTitleContainer}>
                    <Text style={[styles.compassCardTitle, { color: '#2563EB' }]}>Main Focus</Text>
                    <Text style={[styles.compassCardTime, { color: colors.text, opacity: .5 }]}>
                      {formatLastUpdated(insights?.mainFocus?.updatedAt)}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.compassCardContent, { color: colors.text, opacity: .9 }]} numberOfLines={2}>
                  {insights?.mainFocus?.headline || 'Generate insights by journaling and coaching'}
                </Text>
              </TouchableOpacity>

              {/* Key Blockers Card */}
              <TouchableOpacity 
                style={[styles.compassCard, { 
                  backgroundColor: colorScheme === 'light' ? '#FFFFFF' : '#222'
                }]}
                onPress={handleViewInsights}
              >
                <View style={styles.compassCardHeader}>
                  <View style={styles.compassCardTitleContainer}>
                    <Text style={[styles.compassCardTitle, { color: '#EA580C' }]}>Key Blockers</Text>
                    <Text style={[styles.compassCardTime, { color: colors.text, opacity: .5 }]}>
                      {formatLastUpdated(insights?.keyBlockers?.updatedAt)}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.compassCardContent, { color: colors.text, opacity: .9 }]} numberOfLines={2}>
                  {insights?.keyBlockers?.headline || 'Generate insights by journaling and coaching'}
                </Text>
              </TouchableOpacity>

              {/* Your Plan Card */}
              <TouchableOpacity 
                style={[styles.compassCard, { 
                  backgroundColor: colorScheme === 'light' ? '#FFFFFF' : '#222'
                }]}
                onPress={handleViewInsights}
              >
                <View style={styles.compassCardHeader}>
                  <View style={styles.compassCardTitleContainer}>
                    <Text style={[styles.compassCardTitle, { color: '#16A34A' }]}>Your Plan</Text>
                    <Text style={[styles.compassCardTime, { color: colors.text, opacity: .5 }]}>
                      {formatLastUpdated(insights?.plan?.updatedAt)}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.compassCardContent, { color: colors.text, opacity: .9 }]} numberOfLines={2}>
                  {insights?.plan?.headline || 'Generate insights by journaling and coaching'}
                </Text>
              </TouchableOpacity>

              {/* Your Stats Card */}
              <TouchableOpacity 
                style={[styles.compassCard, styles.compassCardViewAll, { 
                  backgroundColor: colorScheme === 'light' ? '#FFFFFF' : '#222'
                }]}
                onPress={handleViewInsights}
              >
                <View style={styles.compassCardHeader}>
                  <View style={styles.compassCardTitleContainer}>
                    <Text style={[styles.compassCardTitle, { color: colors.text, opacity: .8 }]}>Your stats</Text>
                    <Text style={[styles.compassCardTime, { color: colors.text, opacity: .5 }]}>
                      Today
                    </Text>
                  </View>
                </View>
                <View style={styles.statsContent}>
                  <Text style={[styles.statsText, { color: colors.text, opacity: .9 }]}>
                    {todayStats.minutes} minutes{' '}
                    <Text style={[styles.statsSubtext, { color: colors.text, opacity: .5 }]}>
                      invested in yourself.
                    </Text>
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Account Section */}
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Account</Text>

            <View style={[styles.settingItem, { backgroundColor: colors.background, borderColor: colorScheme === 'dark' ? '#222' : '#EAEAEA' }]}>
              <Text style={[styles.settingTitle, { color: colors.text }]}>Account Information</Text>
              <Text style={[styles.settingDescription, { color: '#999' }]}>
                View your account information
              </Text>
              <View style={styles.userProfile}>
            <Image source={{ uri: user?.imageUrl }} style={[styles.userImage, { borderColor: colors.text }]} />
            <View>
              <Text style={[styles.settingLabel, { color: colors.text }]}>
                Name
              </Text>
              <Text style={[styles.settingLabel, { color: '#999' }]}>
                {user?.fullName || user?.firstName || 'Not available'}
              </Text>
            </View>
          </View>
          <View style={styles.userInfoSection}>
            <View>
              <Text style={[styles.settingLabel, { color: colors.text }]}>
                Email
              </Text>
              <Text style={[styles.settingLabel, { color: '#999' }]}>
                {user?.primaryEmailAddress?.emailAddress || 'Not available'}
              </Text>
            </View>
          </View>
          <Button
            variant="outline"
            style={styles.standardButton}
            onPress={handleManageAccount}
          >
            Manage Account
          </Button>
            </View>

        {/* Subscription Section */}
        {!shouldShowSkeleton && <Text style={[styles.sectionTitle, { color: colors.text }]}>Subscription</Text>}

        {!shouldShowSkeleton && <View style={[styles.settingItem, { backgroundColor: colors.background, borderColor: colorScheme === 'dark' ? '#222' : '#EAEAEA' }]}>
          <View style={styles.subscriptionHeader}>
            <View style={styles.subscriptionTitleRow}>
              <Crown size={24} color={isPro ? '#FFD700' : colors.icon} />
              <Text style={[styles.settingTitle, { color: colors.text }]}>
                {isPro ? 'Reflecta Pro' : 'Reflecta Free'}
              </Text>
              {isPro && (
                <View style={[styles.proBadge, { backgroundColor: colorScheme === 'dark' ? '#FFD700' : '#FFD700' }]}>
                  <Star size={12} color={colors.tint} fill={colors.tint} />
                  <Text style={[styles.proBadgeText, { color: colors.tint }]}>PRO</Text>
                </View>
              )}
            </View>
            <Text style={[styles.subscriptionDescription, { color: colors.text, opacity: .6 }]}>
              {isPro 
                ? 'You have access to all premium features including unlimited AI coaching, voice transcription, and advanced insights.'
                : 'Upgrade to Pro to unlock unlimited AI coaching, voice transcription, advanced insights and more.'
              }
            </Text>
          </View>

          {rcInitialized && (
            <View style={styles.subscriptionActions}>
              {isPro ? (
                <>
                  <Button
                    variant="outline"
                    style={styles.standardButton}
                    onPress={handleManageSubscription}
                    disabled={isLoading}
                  >
                    Manage Subscription
                  </Button>
                  <Button
                    variant="ghost"
                    style={[styles.standardButton, { marginTop: 10 }]}
                    onPress={async () => {
                      try {
                        setIsLoading(true);
                        const success = await restorePurchases();
                        if (success) {
                          Alert.alert('Success', 'Your purchases have been restored.');
                        } else {
                          Alert.alert('No Purchases Found', 'No previous purchases were found for this account.');
                        }
                      } catch (error) {
                        Alert.alert('Error', 'Failed to restore purchases. Please try again.');
                      } finally {
                        setIsLoading(false);
                      }
                    }}
                    disabled={isLoading}
                  >
                    Restore Purchases
                  </Button>
                </>
              ) : (
                <Button
                  variant="primary"
                  style={[styles.standardButton, { backgroundColor: '#FFD700', borderColor: '#FFD700' }]}
                  onPress={handleUpgradeToPro}
                  disabled={isLoading}
                  iconLeft={<Crown size={18} color="#000" />}
                >
                  <Text style={{ color: '#000', fontWeight: '600' }}>Upgrade to Pro</Text>
                </Button>
              )}
              
              {!isPro && (
                <Button
                  variant="ghost"
                  style={[styles.standardButton, { marginTop: 10 }]}
                  onPress={async () => {
                    try {
                      setIsLoading(true);
                      const success = await restorePurchases();
                      if (success) {
                        Alert.alert('Success', 'Your purchases have been restored.');
                      } else {
                        Alert.alert('No Purchases Found', 'No previous purchases were found for this account.');
                      }
                    } catch (error) {
                      Alert.alert('Error', 'Failed to restore purchases. Please try again.');
                    } finally {
                      setIsLoading(false);
                    }
                  }}
                  disabled={isLoading}
                >
                  Restore Purchases
                </Button>
              )}
            </View>
          )}

          {!rcInitialized && (
            <View style={styles.subscriptionLoading}>
              <Text style={[styles.settingDescription, { color: '#999' }]}>
                Loading subscription status...
              </Text>
            </View>
          )}
        </View>}

        {/* Security Section */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Security</Text>

        {biometricSupported && (
          <View style={[styles.settingItem, { backgroundColor: colors.background, borderColor: colorScheme === 'dark' ? '#222' : '#EAEAEA' }]}>
            <View style={styles.settingHeader}>
              <Text style={[styles.settingTitle, { color: colors.text }]}>{getAuthTypeLabel()}</Text>
            </View>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={[styles.settingLabel, { color: colors.text }]}>Enable {getAuthTypeLabel()}</Text>
                <Text style={[styles.settingDescription, { color: '#999' }]}>
                  Protect your account with {getAuthTypeLabel()} authentication when opening the app.
                </Text>
              </View>
              <Switch
                value={biometricEnabled}
                onValueChange={handleBiometricToggle}
                trackColor={{ false: '#E5E5E7', true: colors.tint }}
                thumbColor={colors.background}
                disabled={biometricLoading || isLoading || !biometricEnrolled}
              />
            </View>
            {biometricSupported && !biometricEnrolled && (
              <TouchableOpacity
                style={styles.systemSettingsButton}
                onPress={() => { Linking.openSettings() }}
              >
                <Text style={styles.systemSettingsText}>
                  Set up {getAuthTypeLabel()} in System Settings to enable this feature
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Notifications Section */}
        {!shouldShowSkeleton && <Text style={[styles.sectionTitle, { color: colors.text }]}>Notifications</Text>}

        {!shouldShowSkeleton && <View style={[styles.settingItem, { backgroundColor: colors.background, borderColor: colorScheme === 'dark' ? '#222' : '#EAEAEA' }]}>
          <View style={styles.settingHeader}>
            <Text style={[styles.settingTitle, { color: colors.text }]}>Push Notifications</Text>
          </View>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Enable Push Notifications</Text>
              <Text style={[styles.settingDescription, { color: '#999' }]}>
                Receive Notifications directly on your home screen by enabling push notification banners.
              </Text>
            </View>
            <Switch
              value={pushNotificationsEnabled}
              onValueChange={handlePushNotificationToggle}
              trackColor={{ false: '#E5E5E7', true: colors.tint }}
              thumbColor={colors.background}
              disabled={isLoading}
            />
          </View>
          {pushNotificationsEnabled && permissionStatus !== 'granted' && (
            <TouchableOpacity
              style={styles.systemSettingsButton}
              onPress={() => { Linking.openSettings() }}
            >
              <Text style={styles.systemSettingsText}>
                Allow receiving notifications in System Settings
              </Text>
            </TouchableOpacity>
          )}
        </View>}

        {/* App Settings */}
        {/* <Text style={[styles.sectionTitle, { color: colors.text }]}>App Settings</Text>

        <View style={[styles.settingItem, { backgroundColor: colors.background, borderColor: colorScheme === 'dark' ? '#222' : '#EAEAEA' }]}>
          <View style={styles.settingHeader}>
            <Text style={[styles.settingTitle, { color: colors.text }]}>Appearance</Text>
          </View>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Theme</Text>
              <Text style={[styles.settingDescription, { color: '#999' }]}>
                Set the color theme appearance of the App
              </Text>
            </View>
            <TouchableOpacity style={styles.dropdown}>
              <Text style={[styles.dropdownText, { color: '#999' }]}>System</Text>
              <ChevronDown size={20} color="#999" />
            </TouchableOpacity>
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Entry Creation</Text>
              <Text style={[styles.settingDescription, { color: '#999' }]}>
                Change the way you create new entries
              </Text>
            </View>
            <TouchableOpacity style={styles.dropdown}>
              <Text style={[styles.dropdownText, { color: '#999' }]}>Swipe to Create</Text>
              <ChevronDown size={20} color="#999" />
            </TouchableOpacity>
          </View>

          <View style={[styles.subsettingItem, { borderColor: colorScheme === 'dark' ? '#' : '#EAEAEA' }]}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={[styles.settingLabel, { color: colors.text }]}>Language</Text>
                <Text style={[styles.settingDescription, { color: '#999' }]}>
                  Set the App and AI language for Appearance, AI Cues, etc.
                </Text>
              </View>
              <TouchableOpacity style={styles.dropdown}>
                <Text style={[styles.dropdownText, { color: colors.text }]}>English (US)</Text>
                <Ionicons name="chevron-down" size={20} color="#999" />
              </TouchableOpacity>
            </View>
          </View>
        </View> */}

        {/* AI Features */}
        {!shouldShowSkeleton && <Text style={[styles.sectionTitle, { color: colors.text }]}>AI Features</Text>}

        {/* Push Notifications for AI */}
        <View style={[styles.settingItem, { backgroundColor: colors.background, borderColor: colorScheme === 'dark' ? '#222' : '#EAEAEA' }]}>
          <View style={styles.settingHeader}>
            <Text style={[styles.settingTitle, { color: colors.text }]}>AI Coaching Config</Text>
          </View>
          {/* <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Entry Coach</Text>
              <Text style={[styles.settingDescription, { color: '#999' }]}>
                While typing your entry, receive AI-generated responses to help you reflect on your thoughts and feelings.
              </Text>
            </View>
            <Switch
              value={}
              onValueChange={() => { }}
              trackColor={{ false: '#E5E5E7', true: colors.tint }}
              thumbColor={colors.background}
            />
          </View> */}
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Receive Coaching Messages</Text>
              <Text style={[styles.settingDescription, { color: '#999' }]}>
                Receive periodic, reflective messages from the AI Coach based on your coaching sessions.
              </Text>
            </View>
            <Switch
              value={coachingMessages}
              onValueChange={handleCoachingMessagesToggle}
              trackColor={{ false: '#E5E5E7', true: colors.tint }}
              thumbColor={colors.background}
              disabled={isLoading}
            />
          </View>
        </View>

        {/* Journal Settings */}
        {/* <Text style={[styles.sectionTitle, { color: colors.text }]}>Journal Settings</Text>

        <View style={[styles.settingItem, { backgroundColor: colors.background, borderColor: colorScheme === 'dark' ? '# ' : '#EAEAEA' }]}>
          <View style={styles.settingHeader}>
            <Text style={[styles.settingTitle, { color: colors.text }]}>Journal Template</Text>
          </View>
          <Text style={[styles.templateDescription, { color: '#999' }]}>
            Customize your Daily Journal Template
          </Text>

          <Button
            variant="primary"
            style={styles.editTemplateButton}
            onPress={() => {
              (navigation as any).navigate('TemplateEditor');
            }}
          >
            Edit Template
          </Button>
        </View> */}

        {/* Information */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>More Information</Text>

        <View style={styles.sectionGap}>
          <View style={[styles.settingItem, { gap: 10, backgroundColor: colors.background, borderColor: colorScheme === 'dark' ? '#222' : '#EAEAEA' }]}>
            <Button
              variant="ghost"
              iconLeft={<FileText size={20} color={colors.text} />}
              style={styles.infoButton}
              onPress={() => {
                WebBrowser.openBrowserAsync('https://reflecta.so/privacy', {
                  controlsColor: colors.tint,
                  toolbarColor: colors.background,
                  showTitle: true,
                });
              }}
            >
              Privacy Policy
            </Button>
            <View style={[styles.separator, { backgroundColor: colorScheme === 'dark' ? '#222' : '#E5E5E7' }]} />
            <Button
              variant="ghost"
              iconLeft={<FileText size={20} color={colors.text} />}
              style={styles.infoButton}
              onPress={() => {
                WebBrowser.openBrowserAsync('https://reflecta.so/terms', {
                  controlsColor: colors.tint,
                  toolbarColor: colors.background,
                  showTitle: true,
                });
              }}
            >
              Terms of Service
            </Button>
            <View style={[styles.separator, { backgroundColor: colorScheme === 'dark' ? '#222' : '#E5E5E7' }]} />
            <Button
              variant="ghost"
              iconLeft={<Info size={20} color={colors.text} />}
              style={styles.infoButton}
              onPress={() => {
                (navigation as any).navigate('Info');
              }}
            >
              App Information
            </Button>
          </View>
          <View style={[styles.settingItem, { gap: 10, backgroundColor: colors.background, borderColor: colorScheme === 'dark' ? '#222' : '#EAEAEA' }]}>
            <Button
              variant="ghost"
              iconLeft={<RotateCcw size={20} color={colors.text} />}
              style={styles.infoButton}
              onPress={handleResetOnboarding}
            >
              Reset Onboarding
            </Button>
            <View style={[styles.separator, { backgroundColor: colorScheme === 'dark' ? '#222' : '#E5E5E7' }]} />
            <Button
              variant="ghost"
              iconLeft={<Compass size={20} color={colors.text} />}
              style={styles.infoButton}
              onPress={handleResetCompass}
            >
              Reset Life Compass
            </Button>
          </View>
          <Button
            variant="outline"
            iconRight={<LogOut size={20} color={colors.text} />}
            style={styles.standardButton}
            onPress={() => {
              console.log('🚪 Settings - Sign Out button onPress triggered');
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              handleSignOut();
            }}
          >
            Sign Out
          </Button>
        </View>
            <Text style={[styles.appInfo, { color: colors.text }]}>
              Reflecta.
            </Text>
            <Text style={[styles.versionInfo, { color: colors.text }]}>
              Version {Application.nativeApplicationVersion}
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 30,
    paddingBottom: 15,
    alignItems: 'flex-start',
  },
  userName: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 24,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: '500',
    marginVertical: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '500',
    marginTop: 30,
    marginBottom: 15,
    marginLeft: 10,
  },
  settingItem: {
    gap: 5,
    opacity: 1,
    borderRadius: 20,
    borderWidth: 0.5,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  settingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  settingTitle: {
    fontSize: 20,
    fontWeight: '500',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  settingInfo: {
    flex: 1,
    marginRight: 15,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 5,
  },
  settingDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  separator: {
    height: 1,
    width: '100%',
  },
  userProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    marginTop: 20,
  },
  userImage: {
    width: 54,
    height: 54,
    borderRadius: 100,
    borderWidth: 1,
  },
  userInfoSection: {
    gap: 10,
    marginTop: 20,
    marginBottom: 20,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 15,
  },
  dropdownText: {
    fontSize: 16,
    fontWeight: '500',
  },
  systemSettingsButton: {
    marginTop: 15,
    backgroundColor: '#CB801544',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF6F00',
    alignItems: 'center',
  },
  systemSettingsText: {
    fontSize: 12,
    textAlign: 'center',
    color: '#FF6F00',
  },
  standardButton: {
    flex: 1,
  },
  infoButton: {
    flex: 1,
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionGap: {
    gap: 30,
  },
  appInfo: {
    marginTop: 30,
    marginBottom: 10,
    fontSize: 18,
    fontWeight: '500',
    textAlign: 'center',
  },
  versionInfo: {
    marginBottom: 20,
    fontSize: 14,
    fontWeight: '300',
    textAlign: 'center',
    opacity: 0.5,
  },
  activeCommitmentCard: {
    alignSelf: 'stretch',
    height: 171,
    padding: 16,
    borderRadius: 24,
    borderWidth: 0,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 8,
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    marginTop: 10,
  },
  compassCardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 30,
    paddingHorizontal: 5,
  },
  compassCard: {
    width: '48%',
    height: 171,
    padding: 16,
    borderRadius: 24,
    borderWidth: 0,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 8,
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  compassCardViewAll: {
    // Special styling for the "View All" card if needed
  },
  // Active Commitment Card Styles
  commitmentHeader: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  commitmentTitleContainer: {
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    flex: 1,
  },
  commitmentTitle: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 20,
  },
  commitmentDescription: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 20,
  },
  editButton: {
    padding: 8,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editButtonText: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    textAlign: 'center',
  },
  commitmentStats: {
    alignItems: 'flex-end',
  },
  commitmentStatsText: {
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 16,
  },
  commitmentTypeText: {
    fontSize: 10,
    fontWeight: '400',
    lineHeight: 14,
  },
  // Scrollable commitments styles
  commitmentsScrollView: {
    marginBottom: 20,
  },
  commitmentsScrollContent: {
    paddingLeft: 20,
    paddingRight: 8,
  },
  commitmentCard: {
    width: 280,
    height: 171,
    padding: 16,
    borderRadius: 24,
    borderWidth: 0,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 8,
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginRight: 12,
  },
  emptyCommitmentsCard: {
    alignSelf: 'stretch',
    height: 120,
    padding: 16,
    borderRadius: 24,
    borderWidth: 0,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 8,
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  commitmentActions: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 32,
  },
  notDoneButton: {
    // Background color set dynamically
  },
  doneButton: {
    // Background color set dynamically
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    textAlign: 'center',
    flexShrink: 0,
  },
  compassCardHeader: {
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    gap: 15,
  },
  compassCardTitleContainer: {
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  compassCardTitle: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 20,
  },
  compassCardTime: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 20,
  },
  compassCardContent: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 20,
    textAlign: 'left',
    alignSelf: 'flex-start',
    marginTop: 'auto',
  },
  statsContent: {
    alignSelf: 'stretch',
    flex: 1,
    justifyContent: 'flex-end',
  },
  statsText: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 20,
  },
  statsSubtext: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 20,
  },
  subscriptionHeader: {
    marginBottom: 20,
  },
  subscriptionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  subscriptionDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginLeft: 36,
  },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  proBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  subscriptionActions: {
    gap: 0,
  },
  subscriptionLoading: {
    paddingVertical: 20,
    alignItems: 'center',
  },
}); 