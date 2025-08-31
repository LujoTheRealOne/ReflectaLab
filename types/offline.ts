import { JournalEntry, UserAccount } from './journal';

/**
 * Offline Journal Types
 * Types related to offline journal functionality and storage
 */

// Offline journal entry with string timestamps for AsyncStorage compatibility
export interface OfflineJournalEntry extends Omit<JournalEntry, 'timestamp' | 'lastUpdated'> {
  timestamp: string; // ISO string for AsyncStorage compatibility
  lastUpdated: string; // ISO string for AsyncStorage compatibility
  isSynced: boolean; // Whether this entry has been synced to Firestore
  needsSync: boolean; // Whether this entry needs to be synced
  isNewEntry: boolean; // Whether this is a new entry (for analytics)
  syncAttempts: number; // Number of sync attempts made
  lastSyncAttempt?: string; // ISO string of last sync attempt
}

// Sync queue item for managing offline sync operations
export interface SyncQueueItem {
  entryId: string;
  action: 'create' | 'update';
  timestamp: string; // ISO string
  attempts: number;
  lastAttempt?: string; // ISO string
}

// Sync operation result
export interface SyncResult {
  success: number;
  failed: number;
  errors: string[];
}

// Sync statistics for UI display
export interface SyncStats {
  pendingSync: number;
  lastSyncTime: string | null;
  totalEntries: number;
  syncedEntries: number;
}

// Save status for journal entries
export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'offline' | 'syncing' | 'sync_failed';

/**
 * Offline Authentication Types
 * Types related to offline authentication and user caching
 */

// Cached user data for offline authentication
export interface CachedUserData {
  firebaseUser: {
    uid: string;
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
  };
  userAccount: UserAccount | null;
  lastAuthTime: string; // ISO timestamp
  clerkUserId: string | null;
}

// Offline authentication session info
export interface OfflineAuthSession {
  userId: string;
  startTime: string; // ISO string
  lastActivity: string; // ISO string
  isActive: boolean;
}

/**
 * Network Connectivity Types
 * Types related to network status and connectivity
 */

// Network connectivity state
export interface NetworkState {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
  type: string | null;
}

// Network status for UI components
export interface NetworkStatus {
  isOnline: boolean;
  connectionType: string | null;
  isReachable: boolean;
}

/**
 * Offline Journal Hook Types
 * Types for the useOfflineJournal hook interface
 */

// Return type for useOfflineJournal hook
export interface UseOfflineJournalReturn {
  // Entry management
  latestEntry: OfflineJournalEntry | null;
  saveEntry: (content: string, isNewEntry?: boolean) => Promise<void>;
  createNewEntry: () => void;
  
  // Status
  saveStatus: SaveStatus;
  isOffline: boolean;
  isSyncing: boolean;
  
  // Sync management
  syncNow: () => Promise<void>;
  pendingSyncCount: number;
  lastSyncTime: string | null;
  
  // Loading states
  isLoadingEntry: boolean;
}

/**
 * Navigation Types
 * Types related to offline navigation and context
 */

// Current entry context for navigation
export interface CurrentEntryContextType {
  currentEntryId: string | null;
  setCurrentEntryId: (id: string | null) => void;
}

// Offline navigation state
export interface OfflineNavigationState {
  isOfflineMode: boolean;
  restrictedFeatures: string[];
  availableFeatures: string[];
}
