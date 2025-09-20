// 🧠 PURE IN-MEMORY NOTES SERVICE
// All notes stored in memory only, synced with backend when online

import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, getDocs, doc, setDoc, serverTimestamp } from 'firebase/firestore';

// Types
export interface MemoryNote {
  id: string;
  title: string;
  content: string;
  timestamp: string; // ISO string
  uid: string;
  linkedCoachingSessionId?: string;
  linkedCoachingMessageId?: string;
  lastUpdated?: string;
  syncStatus: 'synced' | 'pending' | 'local-only';
  createdOffline?: boolean;
}

export interface SyncState {
  lastSyncTime: string;
  syncInProgress: boolean;
  pendingUploads: string[]; // note IDs
  failedSyncs: string[];
}

class MemoryNotesService {
  private syncInProgress = false;
  private cacheUpdateListeners: Array<(userId: string, notes: MemoryNote[]) => void> = [];
  
  // 🧠 PURE IN-MEMORY STORAGE: All data in memory only
  private notesMemory: Map<string, MemoryNote[]> = new Map();
  private syncStateMemory: Map<string, SyncState> = new Map();
  private currentUserId: string | null = null;

  // =====================
  // MEMORY MANAGEMENT
  // =====================

  /**
   * Get notes from memory for a user
   */
  getNotes(userId: string): MemoryNote[] {
    if (!this.notesMemory.has(userId)) {
      console.log(`🧠 Initializing empty notes for user: ${userId}`);
      this.notesMemory.set(userId, []);
      return [];
    }
    
    const notes = this.notesMemory.get(userId)!;
    return notes.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  /**
   * Set notes in memory for a user
   */
  setNotes(userId: string, notes: MemoryNote[]): void {
    // Deduplicate by ID
    const uniqueNotes = notes.reduce((acc, note) => {
      const existingIndex = acc.findIndex(n => n.id === note.id);
      if (existingIndex >= 0) {
        // Keep the note with most recent timestamp or better sync status
        const existing = acc[existingIndex];
        const noteTime = new Date(note.timestamp).getTime();
        const existingTime = new Date(existing.timestamp).getTime();
        
        if (noteTime > existingTime || note.syncStatus === 'synced') {
          acc[existingIndex] = note;
        }
      } else {
        acc.push(note);
      }
      return acc;
    }, [] as MemoryNote[]);
    
    const sortedNotes = uniqueNotes.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    this.notesMemory.set(userId, sortedNotes);
    
    console.log(`🧠 Stored ${sortedNotes.length} notes in memory for user ${userId}`);
    
    // Notify listeners
    this.notifyCacheUpdate(userId, sortedNotes);
  }

  /**
   * Add a single note to memory
   */
  addNote(userId: string, note: MemoryNote): string {
    const currentNotes = this.getNotes(userId);
    
    // Check if note already exists
    const existingIndex = currentNotes.findIndex(n => n.id === note.id);
    
    let updatedNotes: MemoryNote[];
    if (existingIndex >= 0) {
      // Update existing note
      updatedNotes = [...currentNotes];
      updatedNotes[existingIndex] = note;
      console.log(`🧠 Updated existing note in memory: ${note.id}`);
    } else {
      // Add new note
      updatedNotes = [note, ...currentNotes];
      console.log(`🧠 Added new note to memory: ${note.id}`);
    }
    
    this.setNotes(userId, updatedNotes);
    
    // Add to pending uploads if not synced
    if (note.syncStatus === 'local-only' || note.syncStatus === 'pending') {
      this.addToPendingUploads(userId, note.id);
    }
    
    return note.id;
  }

  /**
   * Update a note in memory
   */
  updateNote(userId: string, noteId: string, updates: Partial<MemoryNote>): void {
    const currentNotes = this.getNotes(userId);
    const noteIndex = currentNotes.findIndex(n => n.id === noteId);
    
    if (noteIndex >= 0) {
      const updatedNote = { ...currentNotes[noteIndex], ...updates };
      const updatedNotes = [...currentNotes];
      updatedNotes[noteIndex] = updatedNote;
      
      this.setNotes(userId, updatedNotes);
      
      // Add to pending uploads if not synced
      if (updatedNote.syncStatus === 'local-only' || updatedNote.syncStatus === 'pending') {
        this.addToPendingUploads(userId, noteId);
      }
      
      console.log(`🧠 Updated note in memory: ${noteId}`);
    }
  }

  /**
   * Delete a note from memory
   */
  deleteNote(userId: string, noteId: string): void {
    const currentNotes = this.getNotes(userId);
    const filteredNotes = currentNotes.filter(n => n.id !== noteId);
    this.setNotes(userId, filteredNotes);
    console.log(`🧠 Deleted note from memory: ${noteId}`);
  }

  // =====================
  // SYNC STATE MANAGEMENT
  // =====================

  getSyncState(userId: string): SyncState {
    if (!this.syncStateMemory.has(userId)) {
      const defaultState: SyncState = {
        lastSyncTime: new Date(0).toISOString(),
        syncInProgress: false,
        pendingUploads: [],
        failedSyncs: [],
      };
      this.syncStateMemory.set(userId, defaultState);
      return defaultState;
    }
    
    return this.syncStateMemory.get(userId)!;
  }

  setSyncState(userId: string, state: SyncState): void {
    this.syncStateMemory.set(userId, state);
  }

  addToPendingUploads(userId: string, noteId: string): void {
    const syncState = this.getSyncState(userId);
    if (!syncState.pendingUploads.includes(noteId)) {
      syncState.pendingUploads.push(noteId);
      this.setSyncState(userId, syncState);
      console.log(`📤 Added to pending uploads: ${noteId}`);
    }
  }

  removeFromPendingUploads(userId: string, noteId: string): void {
    const syncState = this.getSyncState(userId);
    syncState.pendingUploads = syncState.pendingUploads.filter(id => id !== noteId);
    this.setSyncState(userId, syncState);
  }

  // =====================
  // BACKEND SYNC
  // =====================

  /**
   * Load notes from backend and store in memory
   */
  async loadNotesFromBackend(userId: string): Promise<MemoryNote[]> {
    try {
      console.log(`🌐 Loading notes from backend for user: ${userId}`);
      
      const notesRef = collection(db, 'journal_entries');
      const q = query(
        notesRef,
        where('uid', '==', userId),
        orderBy('timestamp', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const backendNotes: MemoryNote[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        backendNotes.push({
          id: doc.id,
          title: data.title || '',
          content: data.content || '',
          timestamp: data.timestamp?.toDate?.()?.toISOString() || data.timestamp || new Date().toISOString(),
          uid: data.uid,
          linkedCoachingSessionId: data.linkedCoachingSessionId,
          linkedCoachingMessageId: data.linkedCoachingMessageId,
          lastUpdated: data.lastUpdated?.toDate?.()?.toISOString() || data.lastUpdated,
          syncStatus: 'synced',
          createdOffline: false,
        });
      });
      
      console.log(`🌐 Loaded ${backendNotes.length} notes from backend`);
      
      // Merge with existing memory notes (keep local-only notes)
      const existingNotes = this.getNotes(userId);
      const localOnlyNotes = existingNotes.filter(n => n.syncStatus === 'local-only' || n.syncStatus === 'pending');
      
      const mergedNotes = [...backendNotes, ...localOnlyNotes];
      this.setNotes(userId, mergedNotes);
      
      return mergedNotes;
    } catch (error) {
      console.error('❌ Error loading notes from backend:', error);
      return this.getNotes(userId); // Return existing memory notes
    }
  }

  /**
   * Sync pending notes to backend
   */
  async syncPendingNotes(userId: string): Promise<{ synced: number; failed: number }> {
    if (this.syncInProgress) {
      console.log('⏭️ Sync already in progress, skipping');
      return { synced: 0, failed: 0 };
    }

    this.syncInProgress = true;
    const syncState = this.getSyncState(userId);
    
    try {
      this.setSyncState(userId, { ...syncState, syncInProgress: true });
      
      console.log(`🔄 Syncing ${syncState.pendingUploads.length} pending notes...`);
      
      let syncedCount = 0;
      let failedCount = 0;
      
      for (const noteId of syncState.pendingUploads) {
        try {
          await this.syncSingleNoteToBackend(userId, noteId);
          syncedCount++;
          this.removeFromPendingUploads(userId, noteId);
          console.log(`✅ Synced note: ${noteId}`);
        } catch (error) {
          console.error(`❌ Failed to sync note ${noteId}:`, error);
          failedCount++;
        }
      }
      
      // Update sync state
      const finalSyncState = this.getSyncState(userId);
      this.setSyncState(userId, {
        lastSyncTime: new Date().toISOString(),
        syncInProgress: false,
        pendingUploads: finalSyncState.pendingUploads, // Keep remaining failed uploads
        failedSyncs: failedCount > 0 ? [...finalSyncState.failedSyncs, new Date().toISOString()] : [],
      });
      
      console.log(`✅ Sync completed: ${syncedCount} synced, ${failedCount} failed`);
      return { synced: syncedCount, failed: failedCount };
      
    } catch (error) {
      console.error('❌ Sync process failed:', error);
      this.setSyncState(userId, { ...syncState, syncInProgress: false });
      return { synced: 0, failed: syncState.pendingUploads.length };
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Sync a single note to backend
   */
  private async syncSingleNoteToBackend(userId: string, noteId: string): Promise<void> {
    const notes = this.getNotes(userId);
    const note = notes.find(n => n.id === noteId);
    
    if (!note) {
      throw new Error(`Note ${noteId} not found in memory`);
    }

    // Upload to Firestore
    const noteRef = doc(db, 'journal_entries', noteId);
    await setDoc(noteRef, {
      id: noteId,
      uid: userId,
      title: note.title || '',
      content: note.content,
      timestamp: serverTimestamp(),
      linkedCoachingSessionId: note.linkedCoachingSessionId || null,
      linkedCoachingMessageId: note.linkedCoachingMessageId || null,
      lastUpdated: serverTimestamp(),
    });

    // Update sync status in memory
    this.updateNote(userId, noteId, { 
      syncStatus: 'synced',
      lastUpdated: new Date().toISOString()
    });
  }

  // =====================
  // USER MANAGEMENT
  // =====================

  /**
   * Initialize user - load their notes from backend
   */
  async initializeUser(userId: string): Promise<MemoryNote[]> {
    console.log(`🚀 Initializing user: ${userId}`);
    this.currentUserId = userId;
    
    try {
      // Load notes from backend and store in memory
      const notes = await this.loadNotesFromBackend(userId);
      console.log(`🚀 User initialized with ${notes.length} notes`);
      return notes;
    } catch (error) {
      console.error('❌ Error initializing user:', error);
      return [];
    }
  }

  /**
   * Clear user data from memory (on sign out)
   */
  clearUserData(userId: string): void {
    console.log(`🧹 Clearing memory data for user: ${userId}`);
    this.notesMemory.delete(userId);
    this.syncStateMemory.delete(userId);
    
    if (this.currentUserId === userId) {
      this.currentUserId = null;
    }
  }

  /**
   * Clear all data from memory
   */
  clearAllData(): void {
    console.log('🧹 Clearing all memory data');
    this.notesMemory.clear();
    this.syncStateMemory.clear();
    this.currentUserId = null;
  }

  // =====================
  // LISTENERS
  // =====================

  onCacheUpdate(listener: (userId: string, notes: MemoryNote[]) => void): () => void {
    this.cacheUpdateListeners.push(listener);
    return () => {
      const index = this.cacheUpdateListeners.indexOf(listener);
      if (index > -1) {
        this.cacheUpdateListeners.splice(index, 1);
      }
    };
  }

  private notifyCacheUpdate(userId: string, notes: MemoryNote[]): void {
    this.cacheUpdateListeners.forEach(listener => {
      try {
        listener(userId, notes);
      } catch (error) {
        console.error('❌ Cache update listener error:', error);
      }
    });
  }
}

// Export singleton instance
export const memoryNotesService = new MemoryNotesService();
