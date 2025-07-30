export interface JournalEntry {
  id: string;
  uid: string;
  content: string;
  timestamp: Date;
  lastUpdated: Date;
  title?: string;
}

export interface UserAccount {
  uid: string;
  currentMorningGuidance?: MorningGuidance;
  alignment?: string;
  createdAt: Date;
  updatedAt: Date;
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

export interface MorningGuidance {
  journalQuestion: string;
  detailedMorningPrompt: string;
  reasoning: string;
  generatedAt: Date;
  usedAt?: Date;
} 