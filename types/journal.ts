export interface JournalEntry {
  id: string;
  uid: string;
  content: string;
  timestamp: Date;
  lastUpdated: Date;
  title?: string;
  linkedCoachingSessionId?: string; // id of the coaching session that this entry is linked to
  linkedCoachingMessageId?: string; // id of the coaching message that this entry is linked to
}

export interface UserAccount {
  uid: string;
  createdAt: Date;
  updatedAt: Date;
  firstName: string;
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

export interface MorningGuidance {
  journalQuestion: string;
  detailedMorningPrompt: string;
  reasoning: string;
  generatedAt: Date;
  usedAt?: Date;
} 