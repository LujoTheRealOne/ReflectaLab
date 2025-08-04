import { 
  collection, 
  doc, 
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
  serverTimestamp,
  FieldValue
} from 'firebase/firestore';
import { db } from './firebase';
import { UserAccount, MorningGuidance } from '@/types/journal';

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
    coachingMessageFrequency?: 'daily' | 'multipleTimesPerWeek' | 'onceAWeek';
    investingTime: number;
    enableCoachingMessages?: boolean; // if true, based on frequency messages will be sent. this should be a setting in the user doc.
  };
  mobilePushNotifications?: {
    enabled: boolean;
    expoPushTokens: string[]; // array of expo tokens
    lastNotificationSentAt?: number; // unix timestamp
  };
  userTimezone: string; // timezone of the user (e.g. "America/New_York")
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
  
  return {
    uid: data.uid as string,
    firstName: data.firstName as string,
    onboardingData: data.onboardingData as {
      onboardingCompleted: boolean;
      onboardingCompletedAt: number;
      whatDoYouDoInLife: string[];
      selfReflectionPracticesTried: string[];
      clarityInLife: number;
      stressInLife: number;
    },
    coachingConfig: data.coachingConfig as {
      challengeDegree: 'gentle' | 'moderate' | 'challenging' | 'intense';
      harshToneDegree: 'supportive' | 'direct' | 'firm' | 'harsh';
      coachingMessageFrequency?: 'daily' | 'multipleTimesPerWeek' | 'onceAWeek';
      investingTime: number;
      enableCoachingMessages?: boolean;
    },
    mobilePushNotifications: data.mobilePushNotifications as {
      enabled: boolean;
      expoPushTokens: string[];
      lastNotificationSentAt?: number;
    },
    userTimezone: data.userTimezone as string,
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
    ...(userAccount.createdAt ? { createdAt: Timestamp.fromDate(userAccount.createdAt) } : { createdAt: now })
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

  return data;
};

export class FirestoreService {
  private static USERS_COLLECTION_NAME = 'users';
  
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
              investingTime: 0,
              enableCoachingMessages: false
            },
            mobilePushNotifications: {
              enabled: false,
              expoPushTokens: []
            },
            userTimezone: 'America/New_York', // Default timezone
            createdAt: new Date(),
            updatedAt: new Date()
          };
          
          const firestoreData = convertToFirestoreUserData(newUserAccount);
          await setDoc(docRef, firestoreData);
          console.log('✅ Created new user document for:', userId);
          return newUserAccount;
        }
        
        // Fix missing createdAt field for existing documents
        if (!userData.createdAt && userData.updatedAt) {
          console.log('🔧 [FIX] Adding missing createdAt field to existing document');
          await updateDoc(docRef, {
            createdAt: userData.updatedAt
          });
        }
        
        return convertFirestoreUserAccount({ id: docSnap.id, data: () => docSnap.data() });
      } else {
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
            investingTime: 0,
            enableCoachingMessages: false
          },
          mobilePushNotifications: {
            enabled: false,
            expoPushTokens: []
          },
          userTimezone: 'America/New_York', // Default timezone
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
} 