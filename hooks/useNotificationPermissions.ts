import { useState, useEffect, useCallback } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { doc, updateDoc, arrayUnion, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';

export type PermissionStatus = 'undetermined' | 'granted' | 'denied';

interface UseNotificationPermissionsReturn {
  permissionStatus: PermissionStatus;
  isLoading: boolean;
  requestPermissions: () => Promise<boolean>;
  checkPermissions: () => Promise<void>;
  expoPushToken: string | null;
  savePushTokenToFirestore: () => Promise<boolean>;
}

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function useNotificationPermissions(): UseNotificationPermissionsReturn {
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>('undetermined');
  const [isLoading, setIsLoading] = useState(false);
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const { firebaseUser } = useAuth();

  const checkPermissions = useCallback(async () => {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      setPermissionStatus(status);
    } catch (error) {
      console.error('Error checking notification permissions:', error);
    }
  }, []);

  useEffect(() => {
    checkPermissions();
  }, [checkPermissions]);

  // Get Expo push token
  const getExpoPushToken = useCallback(async (): Promise<string | null> => {
    try {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      }

      const { data: token } = await Notifications.getExpoPushTokenAsync({
        projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
      });
      
      console.log('✅ Expo push token retrieved:', token);
      setExpoPushToken(token);
      return token;
    } catch (error) {
      console.error('Error getting Expo push token:', error);
      return null;
    }
  }, []);

  // Save push token to Firestore
  const savePushTokenToFirestore = useCallback(async (): Promise<boolean> => {
    if (!firebaseUser || !firebaseUser.uid) {
      console.error('❌ No authenticated user found');
      return false;
    }

    try {
      const token = expoPushToken || await getExpoPushToken();
      if (!token) {
        console.error('❌ Failed to get Expo push token');
        return false;
      }

      const userDocRef = doc(db, 'users', firebaseUser.uid);
      
      // Check if token already exists to avoid duplicates
      const userDoc = await getDoc(userDocRef);
      const userData = userDoc.data();
      const existingTokens = userData?.mobilePushNotifications?.expoPushTokens || [];
      
      if (existingTokens.includes(token)) {
        console.log('ℹ️ Push token already exists in Firestore');
        return true;
      }

      // Add token using arrayUnion to avoid overwriting
      await updateDoc(userDocRef, {
        'mobilePushNotifications.enabled': true,
        'mobilePushNotifications.expoPushTokens': arrayUnion(token),
        updatedAt: new Date(),
      });

      console.log('✅ Push token saved to Firestore:', token);
      return true;
    } catch (error) {
      console.error('❌ Error saving push token to Firestore:', error);
      return false;
    }
  }, [firebaseUser, expoPushToken, getExpoPushToken]);

  const requestPermissions = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    try {
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });
      
      setPermissionStatus(status);
      
      if (status === 'granted') {
        // Get and save push token when permissions are granted
        await savePushTokenToFirestore();
      }
      
      return status === 'granted';
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [savePushTokenToFirestore]);

  return {
    permissionStatus,
    isLoading,
    requestPermissions,
    checkPermissions,
    expoPushToken,
    savePushTokenToFirestore,
  };
}