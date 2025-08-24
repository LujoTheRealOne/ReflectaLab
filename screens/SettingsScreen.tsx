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
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/hooks/useAuth';
import { useInsights } from '@/hooks/useInsights';
import { useNotificationPermissions } from '@/hooks/useNotificationPermissions';
import { useRevenueCat } from '@/hooks/useRevenueCat';
import { useNavigation } from '@react-navigation/native';
import * as Application from 'expo-application';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { ChevronDown, ChevronLeft, Crown, ExternalLink, FileText, Info, LogOut, Star } from 'lucide-react-native';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function SettingsScreen() {
  const navigation = useNavigation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { user, signOut, firebaseUser } = useAuth();
  const { insights, loading: insightsLoading, hasInsights } = useInsights();
  const {
    requestPermissions,
    expoPushToken,
    savePushTokenToFirestore,
    permissionStatus,
    checkPermissions
  } = useNotificationPermissions();
  const { 
    initialized: rcInitialized, 
    isPro, 
    customerInfo, 
    presentPaywall, 
    restorePurchases,
    activeEntitlementIds 
  } = useRevenueCat(firebaseUser?.uid);

  // State for toggles
  const [pushNotificationsEnabled, setPushNotificationsEnabled] = useState(false);
  const [coachingMessages, setCoachingMessages] = useState(true);
  const [userInfo, setUserInfo] = useState<{
    name?: string;
    email?: string;
  }>({});
  const [whatsappStatus, setWhatsappStatus] = useState<{
    verified: boolean;
    phoneNumber?: string;
    verificationStatus?: 'NONE' | 'PENDING' | 'VERIFIED' | 'FAILED';
  }>({ verified: false });

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

  // Load push notification preference from Firestore
  const loadPushNotificationPreference = useCallback(async () => {
    if (!firebaseUser?.uid) return;

    try {
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
  }, [firebaseUser]);

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

  // Load preference on component mount
  useEffect(() => {
    loadPushNotificationPreference();
    loadCoachingMessagesPreference();
    checkPermissions();
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
        const granted = await requestPermissions();

        if (granted) {
          // Permissions granted, save preference and token
          await savePushNotificationPreference(true);
        } else {
          // Permissions denied - revert the switch
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

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
            } catch (error) {
              console.error('Sign out error:', error);
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            }
          }
        }
      ]
    );
  };

  const handleViewInsights = async () => {
    if (!initialized) return; // Wait for RevenueCat init
    
    if (!isPro) {
      const unlocked = await presentPaywallIfNeeded('reflecta_pro', currentOffering || undefined);
      console.log('🧭 Compass insights access Pro check:', unlocked ? 'unlocked' : 'cancelled');
      if (!unlocked) return; // Don't navigate if paywall was cancelled
    }
    
    navigation.navigate('CompassStory' as never);
  };

  // Helper function to format the last updated time
  const formatLastUpdated = (timestamp?: number) => {
    if (!timestamp) return 'No insights yet';

    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);

    if (diffInMinutes < 1) return 'Updated just now';
    if (diffInMinutes < 60) return `Updated ${diffInMinutes} min ago`;
    if (diffInHours < 24) return `Updated ${diffInHours} hours ago`;

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) return 'Updated yesterday';
    return `Updated ${diffInDays} days ago`;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <ChevronLeft size={24} color={colors.text} />
          <Text style={[styles.backText, { color: colors.text }]}>Settings</Text>
          <View style={{ width: 24 }} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Settings Title */}
        {/* <Text style={[styles.title, { color: colors.text }]}>Settings</Text> */}

        {/* Your Compass Section */}
        <View style={styles.compassImageContainer}>
          <Image
            source={require('@/assets/images/Compass-Preview.png')}
            style={{
              width: 280,
              height: 360,
            }}
            resizeMode="contain"
          />
        </View>

        <View style={styles.compassSection}>
          <Text style={[styles.compassTitle, { color: colors.text }]}>Your Compass</Text>
          <Text style={[styles.compassTimestamp, { color: '#999' }]}>
            {formatLastUpdated(insights?.updatedAt)}
          </Text>
          <Button
            variant="primary"
            size="sm"
            style={{ paddingHorizontal: 20 }}
            onPress={handleViewInsights}
            disabled={!hasInsights}
          >
            View Insights
          </Button>
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
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Subscription</Text>

        <View style={[styles.settingItem, { backgroundColor: colors.background, borderColor: colorScheme === 'dark' ? '#222' : '#EAEAEA' }]}>
          <View style={styles.subscriptionHeader}>
            <View style={styles.subscriptionTitleRow}>
              <Crown size={24} color={isPro ? '#FFD700' : colors.icon} />
              <Text style={[styles.settingTitle, { color: colors.text }]}>
                {isPro ? 'Reflecta Pro' : 'Reflecta Free'}
              </Text>
              {isPro && (
                <View style={[styles.proBadge, { backgroundColor: colorScheme === 'dark' ? '#FFD700' : '#FFD700' }]}>
                  <Star size={12} color="#000" fill="#000" />
                  <Text style={[styles.proBadgeText, { color: '#000' }]}>PRO</Text>
                </View>
              )}
            </View>
            <Text style={[styles.subscriptionDescription, { color: '#999' }]}>
              {isPro 
                ? 'You have access to all premium features including unlimited AI coaching, voice transcription, and advanced insights.'
                : 'Upgrade to Pro to unlock unlimited AI coaching, voice transcription, advanced insights and more.'
              }
            </Text>
          </View>

          {rcInitialized && (
            <View style={styles.subscriptionActions}>
              {isPro ? (
                <Button
                  variant="outline"
                  style={styles.standardButton}
                  onPress={handleManageSubscription}
                  disabled={isLoading}
                >
                  Manage Subscription
                </Button>
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
        </View>

        {/* Notifications Section */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Notifications</Text>

        <View style={[styles.settingItem, { backgroundColor: colors.background, borderColor: colorScheme === 'dark' ? '#222' : '#EAEAEA' }]}>
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
        </View>

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
        <Text style={[styles.sectionTitle, { color: colors.text }]}>AI Features</Text>

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
              navigation.navigate('TemplateEditor' as never);
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
                navigation.navigate('Info' as never);
              }}
            >
              App Information
            </Button>
          </View>
          <Button
            variant="outline"
            iconRight={<LogOut size={20} color={colors.text} />}
            style={styles.standardButton}
            onPress={() => {
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
  },
  backButton: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 5,
  },
  backText: {
    fontSize: 16,
    fontWeight: '400',
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
  compassImageContainer: {
    marginTop: -20,
    alignItems: 'center',
  },
  compassSection: {
    alignItems: 'center',
    marginBottom: 30,
    marginTop: -80,
  },
  compassTitle: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 5,
  },
  compassTimestamp: {
    fontSize: 16,
    marginBottom: 20,
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