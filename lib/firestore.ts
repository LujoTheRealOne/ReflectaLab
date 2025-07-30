import { 
  collection, 
  doc, 
  getDoc,
  setDoc,
  updateDoc,
  Timestamp,
  serverTimestamp,
  FieldValue
} from 'firebase/firestore';
import { db } from './firebase';
import { UserAccount, MorningGuidance } from '@/types/journal';

// Firestore user account interface
export interface FirestoreUserAccount {
  uid: string;
  currentMorningGuidance?: {
    journalQuestion: string;
    detailedMorningPrompt: string;
    reasoning: string;
    generatedAt: Timestamp | FieldValue;
    usedAt?: Timestamp | FieldValue;
  };
  alignment?: string;
  createdAt: Timestamp | FieldValue;
  updatedAt: Timestamp | FieldValue;
  onboardingCompleted?: boolean; // Track if user has completed onboarding
  onboardingData?: {
    name: string;
    selectedRoles: string[];
    selectedSelfReflection: string[];
    clarityLevel: number;
    stressLevel: number;
    coachingStylePosition: {
      x: number;
      y: number;
    };
    timeDuration: number;
  };
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
  
  let currentMorningGuidance: MorningGuidance | undefined = undefined;
  if (data.currentMorningGuidance) {
    currentMorningGuidance = {
      journalQuestion: data.currentMorningGuidance.journalQuestion,
      detailedMorningPrompt: data.currentMorningGuidance.detailedMorningPrompt,
      reasoning: data.currentMorningGuidance.reasoning,
      generatedAt: data.currentMorningGuidance.generatedAt ? (data.currentMorningGuidance.generatedAt as Timestamp).toDate() : new Date(),
      usedAt: data.currentMorningGuidance.usedAt ? (data.currentMorningGuidance.usedAt as Timestamp).toDate() : undefined
    };
  }
  
  return {
    uid: data.uid as string,
    currentMorningGuidance,
    alignment: data.alignment as string | undefined,
    onboardingCompleted: data.onboardingCompleted as boolean | undefined,
    onboardingData: data.onboardingData as {
      name: string;
      selectedRoles: string[];
      selectedSelfReflection: string[];
      clarityLevel: number;
      stressLevel: number;
      coachingStylePosition: {
        x: number;
        y: number;
      };
      timeDuration: number;
    } | undefined,
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

  if (userAccount.currentMorningGuidance) {
    data.currentMorningGuidance = {
      journalQuestion: userAccount.currentMorningGuidance.journalQuestion,
      detailedMorningPrompt: userAccount.currentMorningGuidance.detailedMorningPrompt,
      reasoning: userAccount.currentMorningGuidance.reasoning,
      generatedAt: Timestamp.fromDate(userAccount.currentMorningGuidance.generatedAt),
      ...(userAccount.currentMorningGuidance.usedAt && {
        usedAt: Timestamp.fromDate(userAccount.currentMorningGuidance.usedAt)
      })
    };
  }

  if (userAccount.alignment !== undefined) {
    data.alignment = userAccount.alignment;
  }

  if (userAccount.onboardingCompleted !== undefined) {
    data.onboardingCompleted = userAccount.onboardingCompleted;
  }
  
  if (userAccount.onboardingData !== undefined) {
    data.onboardingData = userAccount.onboardingData;
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
        
        // Fix missing createdAt field for existing documents
        if (!userData.createdAt && userData.updatedAt) {
          console.log('🔧 [FIX] Adding missing createdAt field to existing document');
          await updateDoc(docRef, {
            createdAt: userData.updatedAt
          });
        }
        
        return convertFirestoreUserAccount({ id: docSnap.id, data: () => docSnap.data() });
      } else {
        // Create new user account
        const newUserAccount: UserAccount = {
          uid: userId,
          onboardingCompleted: false, // Set to false for new users
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