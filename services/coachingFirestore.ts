import { CoachingMessage } from '@/hooks/useAICoaching';

// Prevent concurrent Firestore saves
const firestoreSaveInProgress = new Set<string>();

/**
 * Load coaching messages from Firestore for a specific user
 */
export const loadMessagesFromFirestore = async (userId: string): Promise<{ allMessages: CoachingMessage[]; totalCount: number }> => {
  try {
    console.log('🔥 Loading messages from Firestore for user:', userId);
    
    // Import Firestore dynamically to avoid SSR issues
    const { db } = await import('../lib/firebase');
    const { collection, query, where, orderBy, limit, getDocs } = await import('firebase/firestore');
    
    // Query for the user's default coaching session
    const sessionsRef = collection(db, 'coachingSessions');
    const sessionQuery = query(
      sessionsRef,
      where('userId', '==', userId),
      where('sessionType', '==', 'default-session'),
      orderBy('createdAt', 'desc'),
      limit(1)
    );
    
    const sessionSnapshot = await getDocs(sessionQuery);
    
    if (!sessionSnapshot.empty) {
      const sessionDoc = sessionSnapshot.docs[0];
      const sessionData = sessionDoc.data();
      const messages = sessionData.messages || [];
      
      console.log(`🔥 Found coaching session with ${messages.length} messages`);
      
      // Convert to our message format
      const firestoreMessages: CoachingMessage[] = messages.map((msg: any, index: number) => ({
        id: msg.id || `msg_${index}`,
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content || '',
        timestamp: msg.timestamp ? new Date(msg.timestamp.seconds * 1000) : new Date()
      }));
      
      console.log(`✅ Successfully loaded ${firestoreMessages.length} messages from Firestore`);
      return { allMessages: firestoreMessages, totalCount: firestoreMessages.length };
    } else {
      console.log('🔥 No coaching session found for user');
      return { allMessages: [], totalCount: 0 };
    }
  } catch (error) {
    console.log('🔥 Firestore loading failed:', error);
    return { allMessages: [], totalCount: 0 };
  }
};

/**
 * Save coaching messages to Firestore for a specific user
 */
export const saveMessagesToFirestore = async (messages: CoachingMessage[], userId: string): Promise<void> => {
  // Prevent concurrent saves for the same user
  if (firestoreSaveInProgress.has(userId)) {
    console.log('⚠️ [FIRESTORE] Save already in progress for user, skipping:', userId);
    return;
  }
  
  firestoreSaveInProgress.add(userId);
  
  try {
    console.log('🔥 [FIRESTORE] Starting Firestore save for user:', userId);
    console.log('🔥 [FIRESTORE] Messages to save:', messages.length);
    
    // Import Firestore dynamically
    const { db } = await import('../lib/firebase');
    const { collection, query, where, getDocs, doc, updateDoc, setDoc, serverTimestamp } = await import('firebase/firestore');
    
    // Find existing coaching session
    const sessionsRef = collection(db, 'coachingSessions');
    const sessionQuery = query(
      sessionsRef,
      where('userId', '==', userId),
      where('sessionType', '==', 'default-session')
    );
    
    console.log('🔍 [FIRESTORE] Searching for existing session...');
    const sessionSnapshot = await getDocs(sessionQuery);
    
    console.log('🔍 [FIRESTORE] Query result:', {
      isEmpty: sessionSnapshot.empty,
      docCount: sessionSnapshot.docs.length,
      userId: userId
    });
    
    // Convert messages to Firestore format (save all messages to backend)
    const firestoreMessages = messages.map((msg) => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp
    }));
    
    if (!sessionSnapshot.empty) {
      // Update existing session - NEVER CREATE NEW
      const sessionDoc = sessionSnapshot.docs[0];
      const existingData = sessionDoc.data();
      
      console.log('🔍 [FIRESTORE] Found existing session:', {
        sessionId: sessionDoc.id,
        existingMessageCount: existingData.messages?.length || 0,
        newMessageCount: firestoreMessages.length,
        sessionType: existingData.sessionType
      });
      
      await updateDoc(sessionDoc.ref, {
        messages: firestoreMessages,
        updatedAt: serverTimestamp()
      });
      console.log('✅ [FIRESTORE] Updated existing coaching session:', sessionDoc.id);
    } else {
      // No session exists - backend should create it first via API call
      console.log('⚠️ [FIRESTORE] No existing session found - session should be created by backend API first');
      console.log('⚠️ [FIRESTORE] Skipping mobile session creation to prevent duplicate sessions');
      
      // Don't create session here to avoid conflicts with backend session creation
      // Backend API will create the session with proper sessionId = userId
      return;
    }
    
    console.log(`✅ [FIRESTORE] Successfully saved ${firestoreMessages.length} messages to Firestore`);
  } catch (error) {
    console.error('❌ [FIRESTORE] Firestore save failed:', error);
    console.error('❌ [FIRESTORE] Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      userId: userId,
      messageCount: messages.length
    });
  } finally {
    // Always remove from in-progress set
    firestoreSaveInProgress.delete(userId);
    console.log('🔄 [FIRESTORE] Save completed for user:', userId);
  }
};

/**
 * Sync commitment states with backend commitments
 */
export const syncCommitmentStatesWithBackend = async (
  messages: CoachingMessage[], 
  userId: string,
  getToken: () => Promise<string | null>
): Promise<CoachingMessage[]> => {
  try {
    console.log('🔄 Starting commitment state sync with backend...');
    
    const token = await getToken();
    if (!token) {
      console.warn('⚠️ No auth token available for commitment sync');
      return messages;
    }

    // Get all commitments from backend
    const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}api/coaching/commitments/checkin`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      console.warn('⚠️ Failed to fetch backend commitments for sync');
      return messages;
    }

    const data = await response.json();
    const backendCommitments = data.commitments || [];
    console.log(`🔄 Found ${backendCommitments.length} commitments in backend`);

    if (backendCommitments.length === 0) {
      return messages;
    }

    // Create a map of backend commitments by title for matching
    const commitmentMap = new Map();
    backendCommitments.forEach((commitment: any) => {
      const key = `${commitment.title}_${commitment.description}_${commitment.type}`;
      commitmentMap.set(key, commitment);
      console.log(`🗂️ Backend commitment mapped:`, {
        title: commitment.title,
        description: commitment.description,
        type: commitment.type,
        id: commitment.id,
        key
      });
    });

    // Update messages with backend commitment states
    let updatedCount = 0;
    const syncedMessages = messages.map((message, messageIndex) => {
      if (message.role !== 'assistant') return message;

      // Check if message has commitment tokens
      const commitmentRegex = /\[commitmentDetected:([^\]]+)\]/g;
      const commitmentMatches = message.content.match(commitmentRegex);
      
      if (commitmentMatches) {
        console.log(`🔍 Message ${messageIndex} has ${commitmentMatches.length} commitment(s):`, commitmentMatches);
      }
      
      let hasUpdates = false;
      
      const updatedContent = message.content.replace(commitmentRegex, (match, propsString) => {
        const props: Record<string, string> = {};
        const propRegex = /(\w+)="([^"]+)"/g;
        let propMatch;
        
        while ((propMatch = propRegex.exec(propsString)) !== null) {
          const [, key, value] = propMatch;
          props[key] = value;
        }

        // Try to match with backend commitment
        const matchKey = `${props.title}_${props.description}_${props.type}`;
        const backendCommitment = commitmentMap.get(matchKey);
        
        console.log(`🔍 Trying to match commitment:`, {
          title: props.title,
          description: props.description,
          type: props.type,
          currentState: props.state,
          currentCommitmentId: props.commitmentId,
          matchKey,
          foundInBackend: !!backendCommitment
        });
        
        if (backendCommitment) {
          // Update with backend data
          props.state = 'accepted';
          props.commitmentId = backendCommitment.id;
          hasUpdates = true;
          updatedCount++;
          
          console.log(`✅ Synced commitment: ${props.title} → state=accepted, id=${backendCommitment.id}`);
        } else {
          console.log(`❌ No matching commitment found in backend for: ${props.title}`);
        }

        const newPropsString = Object.entries(props)
          .map(([k, v]) => `${k}="${v}"`)
          .join(',');
        return `[commitmentDetected:${newPropsString}]`;
      });

      return hasUpdates ? { ...message, content: updatedContent } : message;
    });

    if (updatedCount > 0) {
      console.log(`✅ Updated ${updatedCount} commitment states from backend`);
      
      // Save synced messages to Firestore
      await saveMessagesToFirestore(syncedMessages, userId);
      
      console.log('✅ Synced messages saved to Firestore');
    } else {
      console.log('ℹ️ No commitment states needed syncing');
    }

    return syncedMessages;
  } catch (error) {
    console.error('❌ Error syncing commitment states:', error);
    return messages; // Return original messages on error
  }
};

/**
 * Initialize coaching session by loading messages from Firestore
 */
export const initializeCoachingSession = async (
  userId: string,
  setAllMessages: (messages: CoachingMessage[]) => void,
  setHasMoreMessages: (hasMore: boolean) => void,
  setDisplayedMessageCount: (count: number) => void,
  setMessages: (messages: CoachingMessage[]) => void,
  getToken: () => Promise<string | null>
): Promise<CoachingMessage[]> => {
  console.log('🔄 Initializing coaching session for user:', userId);
  
  try {
    // Load existing session from Firestore
    console.log('🔄 Loading existing session from Firestore...');
    const firestoreResult = await loadMessagesFromFirestore(userId);
    
    if (firestoreResult.allMessages.length > 0) {
      console.log(`✅ Found existing session with ${firestoreResult.allMessages.length} messages`);
      
      // Set up pagination for existing session
      setAllMessages(firestoreResult.allMessages);
      setHasMoreMessages(firestoreResult.allMessages.length > 300);
      setDisplayedMessageCount(Math.min(300, firestoreResult.allMessages.length));
      
      // Return last 30 messages for display
      const displayMessages = firestoreResult.allMessages.slice(-30);
      console.log(`✅ Session loaded with ${displayMessages.length} display messages`);
      
      // Sync commitment states with backend in background (non-blocking)
      console.log('🔄 Starting background commitment sync...');
      syncCommitmentStatesWithBackend(firestoreResult.allMessages, userId, getToken).then((syncedMessages) => {
        console.log('🔄 Background sync completed, updating messages...');
        setAllMessages(syncedMessages);
        setMessages(syncedMessages.slice(-30));
      }).catch((error) => {
        console.error('❌ Background commitment sync failed:', error);
      });
      
      return displayMessages;
    } else {
      console.log('📝 No existing session found - ready to create new session on first message');
      
      // No session exists - reset everything
      setAllMessages([]);
      setHasMoreMessages(false);
      setDisplayedMessageCount(0);
      
      return [];
    }
  } catch (error) {
    console.error('❌ Session initialization failed:', error);
    
    // Reset on error
    setAllMessages([]);
    setHasMoreMessages(false);
    setDisplayedMessageCount(0);
    
    return [];
  }
};
