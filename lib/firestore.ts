import { 
  collection, 
  doc, 
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
  serverTimestamp,
  FieldValue,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  onSnapshot
} from 'firebase/firestore';
import { db } from './firebase';
import { UserAccount, MorningGuidance } from '@/types/journal';
import { userInsight } from '@/types/insights';
import { BackendCoachingMessage } from '@/types/coachingMessage';

// Firestore user account interface
export interface FirestoreUserAccount {
  uid: string;
  firstName: string;
  createdAt: Timestamp | FieldValue;
  updatedAt: Timestamp | FieldValue;
  onboardingData: {
    onboardingCompleted: boolean;
    onboardingCompletedAt: number; // unix timestamp
    whatDoYouDoInLife: string[]; // string of tags selected
    selfReflectionPracticesTried: string[]; // string of tags selected
    clarityInLife: number; // 0 being totally unclear, 10 being very clear
    stressInLife: number; // 0 being totally not stressed, 10 being very stressed
  };
  coachingConfig: {
    challengeDegree: 'gentle' | 'moderate' | 'challenging' | 'intense';
    harshToneDegree: 'supportive' | 'direct' | 'firm' | 'harsh';
    coachingMessageFrequency: 'daily' | 'multipleTimesPerWeek' | 'onceAWeek';
    enableCoachingMessages: boolean; // if true, based on frequency messages will be sent. this should be a setting in the user doc.
    lastCoachingMessageSentAt: number; // unix timestamp
    coachingMessageTimePreference: 'morning' | 'afternoon' | 'evening';
  };
  mobilePushNotifications: {
    enabled: boolean;
    expoPushTokens: string[]; // array of expo tokens
    lastNotificationSentAt: number; // unix timestamp
  };
  userTimezone: string; // timezone of the user (e.g. "America/New_York")
  nextCoachingMessageDue?: number; // unix timestamp when next coaching message should be sent
}

// Convert Firestore document to UserAccount
const convertFirestoreUserAccount = (doc: { id: string; data: () => any }): UserAccount => {
  const data = doc.data();
  
  if (!data.uid) {
    throw new Error('User document missing uid field');
  }
  
  if (!data.updatedAt) {
    throw new Error('User document missing updatedAt field');
  }
  
  const createdAt = data.createdAt ? (data.createdAt as Timestamp).toDate() : (data.updatedAt as Timestamp).toDate();
  
  // Provide default onboarding data for safety (should be rare after migration)
  const defaultOnboardingData = {
    onboardingCompleted: false,
    onboardingCompletedAt: 0,
    whatDoYouDoInLife: [],
    selfReflectionPracticesTried: [],
    clarityInLife: 0,
    stressInLife: 0
  };

  // Provide default coaching config for safety
  const defaultCoachingConfig = {
    challengeDegree: 'moderate' as const,
    harshToneDegree: 'supportive' as const,
    coachingMessageFrequency: 'daily' as const,
    enableCoachingMessages: true,
    lastCoachingMessageSentAt: 0,
    coachingMessageTimePreference: 'morning' as const
  };

  // Provide default mobile push notifications for safety
  const defaultMobilePushNotifications = {
    enabled: false,
    expoPushTokens: [],
    lastNotificationSentAt: 0
  };

  return {
    uid: data.uid as string,
    firstName: data.firstName || '',
    onboardingData: data.onboardingData || defaultOnboardingData,
    coachingConfig: data.coachingConfig || defaultCoachingConfig,
    mobilePushNotifications: data.mobilePushNotifications || defaultMobilePushNotifications,
    userTimezone: data.userTimezone || 'America/New_York',
    nextCoachingMessageDue: data.nextCoachingMessageDue,
    createdAt,
    updatedAt: (data.updatedAt as Timestamp).toDate()
  };
};

// Convert UserAccount to Firestore document data
const convertToFirestoreUserData = (userAccount: Partial<UserAccount>): Partial<FirestoreUserAccount> => {
  const now = Timestamp.now();
  const data: Partial<FirestoreUserAccount> = {
    uid: userAccount.uid!,
    updatedAt: now,
    ...(userAccount.createdAt && { createdAt: Timestamp.fromDate(userAccount.createdAt) })
  };

  if (userAccount.firstName !== undefined) {
    data.firstName = userAccount.firstName;
  }

  if (userAccount.onboardingData !== undefined) {
    data.onboardingData = userAccount.onboardingData;
  }

  if (userAccount.coachingConfig !== undefined) {
    data.coachingConfig = userAccount.coachingConfig;
  }

  if (userAccount.mobilePushNotifications !== undefined) {
    data.mobilePushNotifications = userAccount.mobilePushNotifications;
  }

  if (userAccount.userTimezone !== undefined) {
    data.userTimezone = userAccount.userTimezone;
  }

  if (userAccount.nextCoachingMessageDue !== undefined) {
    data.nextCoachingMessageDue = userAccount.nextCoachingMessageDue;
  }

  return data;
};

export class FirestoreService {
  private static USERS_COLLECTION_NAME = 'users';
  private static INSIGHTS_COLLECTION_NAME = 'userInsights';
  
  // Get or create user account
  static async getUserAccount(userId: string): Promise<UserAccount> {
    try {
      const docRef = doc(db, this.USERS_COLLECTION_NAME, userId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const userData = docSnap.data();
        
        // Check if document has essential fields - if not, treat as non-existent
        if (!userData.uid || !userData.updatedAt) {
          console.log('🔧 [FIX] Document exists but missing essential fields, recreating...', {
            hasUid: !!userData.uid,
            hasUpdatedAt: !!userData.updatedAt,
            userId
          });
          
          // Delete the corrupted document and create a new one
          await deleteDoc(docRef);
          
          // Create new user account with default values
          const newUserAccount: UserAccount = {
            uid: userId,
            firstName: '', // Will need to be set during onboarding
            onboardingData: {
              onboardingCompleted: false,
              onboardingCompletedAt: 0,
              whatDoYouDoInLife: [],
              selfReflectionPracticesTried: [],
              clarityInLife: 0,
              stressInLife: 0
            },
            coachingConfig: {
              challengeDegree: 'moderate',
              harshToneDegree: 'supportive',
              coachingMessageFrequency: 'daily',
              enableCoachingMessages: true,
              lastCoachingMessageSentAt: 0,
              coachingMessageTimePreference: 'morning'
            },
            mobilePushNotifications: {
              enabled: false,
              expoPushTokens: [],
              lastNotificationSentAt: 0
            },
            userTimezone: userData.userTimezone || 'America/New_York', // Default timezone
            createdAt: new Date(),
            updatedAt: new Date()
          };
          
          const firestoreData = convertToFirestoreUserData(newUserAccount);
          await setDoc(docRef, firestoreData);
          console.log('✅ Created new user document for:', userId);
          return newUserAccount;
        }
        
        // Check if user is missing onboarding data (migration for web users)
        if (!userData.onboardingData) {
          console.log('🔧 [MIGRATION] Web user detected - adding missing onboarding data...', { userId });
          
          const onboardingDataUpdate = {
            onboardingData: {
              onboardingCompleted: false,
              onboardingCompletedAt: 0,
              whatDoYouDoInLife: [],
              selfReflectionPracticesTried: [],
              clarityInLife: 0,
              stressInLife: 0
            },
            coachingConfig: {
              challengeDegree: 'moderate',
              harshToneDegree: 'supportive',
              coachingMessageFrequency: 'daily',
              enableCoachingMessages: false
            },
            mobilePushNotifications: {
              enabled: false,
              expoPushTokens: []
            },
            userTimezone: userData.userTimezone || 'America/New_York',
            firstName: userData.firstName || ''
          };
          
          await updateDoc(docRef, onboardingDataUpdate);
          console.log('✅ Added onboarding data for web user:', userId);
        }
        
        // Check if user is missing coachingConfig (partial migration)
        if (!userData.coachingConfig) {
          console.log('🔧 [MIGRATION] Adding missing coaching config...', { userId });
          
          const coachingConfigUpdate = {
            coachingConfig: {
              challengeDegree: 'moderate',
              harshToneDegree: 'supportive',
              coachingMessageFrequency: 'daily',
              enableCoachingMessages: false
            }
          };
          
          await updateDoc(docRef, coachingConfigUpdate);
          console.log('✅ Added coaching config for user:', userId);
        }
        
        // Check if user is missing mobilePushNotifications
        if (!userData.mobilePushNotifications) {
          console.log('🔧 [MIGRATION] Adding missing mobile push notifications config...', { userId });
          
          const pushNotificationsUpdate = {
            mobilePushNotifications: {
              enabled: false,
              expoPushTokens: []
            }
          };
          
          await updateDoc(docRef, pushNotificationsUpdate);
          console.log('✅ Added mobile push notifications config for user:', userId);
        }
        
        // Fix missing createdAt field for existing documents
        if (!userData.createdAt && userData.updatedAt) {
          console.log('🔧 [FIX] Adding missing createdAt field to existing document');
          await updateDoc(docRef, {
            createdAt: userData.updatedAt
          });
        }
        
        // Re-fetch the document data after any migrations to ensure we have the complete structure
        const updatedDocSnap = await getDoc(docRef);
        return convertFirestoreUserAccount({ id: updatedDocSnap.id, data: () => updatedDocSnap.data() });
      } else {
        // Create new user account with default values
        // Try to detect user's timezone, fallback to America/New_York
        const detectedTimezone = (() => {
          try {
            return Intl.DateTimeFormat().resolvedOptions().timeZone;
          } catch {
            return 'America/New_York';
          }
        })();

        const newUserAccount: UserAccount = {
          uid: userId,
          firstName: '', // Will need to be set during onboarding
          onboardingData: {
            onboardingCompleted: false,
            onboardingCompletedAt: 0,
            whatDoYouDoInLife: [],
            selfReflectionPracticesTried: [],
            clarityInLife: 0,
            stressInLife: 0
          },
          coachingConfig: {
            challengeDegree: 'moderate',
            harshToneDegree: 'supportive',
            coachingMessageFrequency: 'daily',
            enableCoachingMessages: true, // Enabled by default
            lastCoachingMessageSentAt: 0,
            coachingMessageTimePreference: 'morning'
          },
          mobilePushNotifications: {
            enabled: false, // Disabled by default for privacy
            expoPushTokens: [],
            lastNotificationSentAt: 0
          },
          userTimezone: detectedTimezone,
          nextCoachingMessageDue: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        const firestoreData = convertToFirestoreUserData(newUserAccount);
        await setDoc(docRef, firestoreData);
        console.log('✅ Created new user document for:', userId);
        return newUserAccount;
      }
    } catch (error) {
      console.error('🚨 [ERROR] Error getting user account:', error);
      console.error('🚨 [ERROR] Error details:', {
        userId,
        errorCode: error instanceof Error ? error.name : 'Unknown',
        errorMessage: error instanceof Error ? error.message : String(error),
        fullError: error
      });
      throw new Error('Failed to get user account from Firestore');
    }
  }
  
  // Update user account
  static async updateUserAccount(userId: string, updates: Partial<UserAccount>): Promise<void> {
    try {
      const docRef = doc(db, this.USERS_COLLECTION_NAME, userId);
      const firestoreData = convertToFirestoreUserData({
        uid: userId,
        ...updates,
        updatedAt: new Date()
      });
      
      await updateDoc(docRef, firestoreData);
      console.log('✅ Updated user document for:', userId);
    } catch (error) {
      console.error('🚨 [ERROR] Error updating user account:', error);
      throw new Error('Failed to update user account in Firestore');
    }
  }

  // User Insights Methods
  
  /**
   * Get user insights from userInsights collection
   */
  static async getUserInsights(userId: string): Promise<userInsight | null> {
    try {
      const q = query(
        collection(db, this.INSIGHTS_COLLECTION_NAME),
        where('userId', '==', userId),
        orderBy('updatedAt', 'desc'),
        limit(1)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return null;
      }
      
      const doc = querySnapshot.docs[0];
      const data = doc.data();
      
      return {
        mainFocus: data.mainFocus,
        keyBlockers: data.keyBlockers,
        plan: data.plan,
        userId: data.userId,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt
      };
    } catch (error) {
      console.error('Error fetching user insights:', error);
      throw new Error('Failed to fetch insights from Firestore');
    }
  }

  /**
   * Real-time listener for user insights
   */
  static subscribeToUserInsights(
    userId: string,
    callback: (insights: userInsight | null) => void
  ): () => void {
    try {
      const q = query(
        collection(db, this.INSIGHTS_COLLECTION_NAME),
        where('userId', '==', userId),
        orderBy('updatedAt', 'desc'),
        limit(1)
      );

      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        if (querySnapshot.empty) {
          callback(null);
          return;
        }

        const doc = querySnapshot.docs[0];
        const data = doc.data();
        
        const insights: userInsight = {
          mainFocus: data.mainFocus,
          keyBlockers: data.keyBlockers,
          plan: data.plan,
          userId: data.userId,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt
        };

        callback(insights);
      }, (error) => {
        console.error('Error in insights subscription:', error);
        callback(null);
      });

      return unsubscribe;
    } catch (error) {
      console.error('Error setting up insights subscription:', error);
      return () => {}; // Return empty unsubscribe function
    }
  }
}

/**
 * Get a coaching message by ID
 */
export async function getCoachingMessage(messageId: string): Promise<BackendCoachingMessage | null> {
  try {
    const messageRef = doc(db, 'coachingMessages', messageId);
    const messageSnap = await getDoc(messageRef);
    
    if (!messageSnap.exists()) {
      return null;
    }
    
    const data = messageSnap.data();
    
    // Convert the Firestore document to BackendCoachingMessage type
    const coachingMessage: BackendCoachingMessage = {
      id: messageSnap.id,
      uid: data.uid || '',
      createdAt: data.createdAt || 0,
      updatedAt: data.updatedAt || 0,
      messageContent: data.messageContent || '',
      messageType: data.messageType || '',
      pushNotificationText: data.pushNotificationText || '',
      effectivenessRating: data.effectivenessRating || 0,
      recommendedAction: data.recommendedAction || 'SEND_MESSAGE',
      wasSent: data.wasSent || false,
      journalEntryId: data.journalEntryId,
      contextUsed: data.contextUsed || '',
      generationAttempt: data.generationAttempt || 1,
      failureReason: data.failureReason,
      userTimezone: data.userTimezone || '',
      userTimePreference: data.userTimePreference || 'morning',
      scheduledFor: data.scheduledFor
    };
    
    return coachingMessage;
  } catch (error) {
    console.error('Error fetching coaching message:', error);
    return null;
  }
} 