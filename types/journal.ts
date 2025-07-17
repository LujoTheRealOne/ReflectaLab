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
}

export interface MorningGuidance {
  journalQuestion: string;
  detailedMorningPrompt: string;
  reasoning: string;
  generatedAt: Date;
  usedAt?: Date;
} 