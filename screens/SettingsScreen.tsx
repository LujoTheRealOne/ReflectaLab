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
import { useNavigation } from '@react-navigation/native';
import * as Application from 'expo-application';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { ChevronDown, ChevronLeft, ExternalLink, FileText, Info, LogOut } from 'lucide-react-native';

export default function SettingsScreen() {
  const navigation = useNavigation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { user, signOut } = useAuth();

  // State for toggles
  const [pushNotificationsEnabled, setPushNotificationsEnabled] = useState(false);
  const [dailyCuesEnabled, setDailyCuesEnabled] = useState(true);
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <ChevronLeft size={24} color={colors.text} />
          <Text style={[styles.backText, { color: colors.text }]}>Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Settings Title */}
        <Text style={[styles.title, { color: colors.text }]}>Settings</Text>

        {/* Account Section */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Account</Text>

        <View style={[styles.settingItem, { borderColor: colorScheme === 'dark' ? '#222' : '#E5E5E7' }]}>
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

        {/* Notifications Section */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Notifications</Text>

        <View style={[styles.settingItem, { borderColor: colorScheme === 'dark' ? '#222' : '#E5E5E7' }]}>
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
              onValueChange={setPushNotificationsEnabled}
              trackColor={{ false: '#E5E5E7', true: colors.tint }}
              thumbColor={colors.background}
              disabled={true}
            />
          </View>
          {pushNotificationsEnabled && (
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
        <Text style={[styles.sectionTitle, { color: colors.text }]}>App Settings</Text>

        <View style={[styles.settingItem, { borderColor: colorScheme === 'dark' ? '#222' : '#E5E5E7' }]}>
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
            </TouchableOpacity>
          </View>

          {/* <View style={[styles.subsettingItem, { borderColor: colorScheme === 'dark' ? '#222' : '#E5E5E7' }]}>
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
          </View> */}
        </View>

        {/* AI Features */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>AI Features</Text>

        {/* Push Notifications for AI */}
        <View style={[styles.settingItem, { borderColor: colorScheme === 'dark' ? '#222' : '#E5E5E7' }]}>
          <View style={styles.settingHeader}>
            <Text style={[styles.settingTitle, { color: colors.text }]}>Sage AI</Text>
          </View>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Entry Cues</Text>
              <Text style={[styles.settingDescription, { color: '#999' }]}>
                While typing your entry, receive AI-generated cues to help you reflect on your thoughts and feelings
              </Text>
            </View>
            <Switch
              value={dailyCuesEnabled}
              onValueChange={() => { }}
              trackColor={{ false: '#E5E5E7', true: colors.tint }}
              thumbColor={colors.background}
            />
          </View>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Receive Daily Cues</Text>
              <Text style={[styles.settingDescription, { color: '#999' }]}>
                Receive periodic, AI-generated reflective cues from Sage based on your journal entries.
              </Text>
            </View>
            <Switch
              value={dailyCuesEnabled}
              onValueChange={() => { }}
              trackColor={{ false: '#E5E5E7', true: colors.tint }}
              thumbColor={colors.background}
            />
          </View>
        </View>

        {/* Journal Settings */}
        {/* <Text style={[styles.sectionTitle, { color: colors.text }]}>Journal Settings</Text>

        <View style={[styles.settingItem, { borderColor: colorScheme === 'dark' ? '#222' : '#E5E5E7' }]}>
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
          <View style={[styles.settingContainer, { borderColor: colorScheme === 'dark' ? '#222' : '#E5E5E7' }]}>
            <Button
              variant="ghost"
              iconLeft={<FileText size={20} color={colors.text} />}
              style={styles.infoButton}
              onPress={() => {
                Linking.openURL('https://reflecta.so/privacy');
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
                Linking.openURL('https://reflecta.so/terms');
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
    paddingVertical: 15,
  },
  backButton: {
    flexDirection: 'row',
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
  },
  settingItem: {
    padding: 15,
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 10,
  },
  settingContainer: {
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    padding: 15,
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
    alignItems: 'flex-start',
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
}); 