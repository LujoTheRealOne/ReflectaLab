# Coaching System Deep Technical Analysis

## Table of Contents

1. [System Architecture Overview](#system-architecture-overview)
2. [Cache Management & Storage Strategy](#cache-management--storage-strategy)
3. [Communication Protocols & API Integration](#communication-protocols--api-integration)
4. [State Management & Data Flow](#state-management--data-flow)
5. [Multi-Device Synchronization](#multi-device-synchronization)
6. [Performance Optimizations & Memory Management](#performance-optimizations--memory-management)
7. [Voice Mode Integration](#voice-mode-integration)
8. [Error Handling & Resilience](#error-handling--resilience)
9. [Security & Authentication](#security--authentication)
10. [Analytics & Tracking](#analytics--tracking)

---

## System Architecture Overview

### Component Hierarchy

```
CoachingScreen.tsx
├── useAICoaching (Hook)
├── useAudioTranscription (Hook)  
├── useAuth (Hook)
├── useAnalytics (Hook)
├── useRevenueCat (Hook)
├── Coaching Cards (Components)
│   ├── FocusCard
│   ├── CommitmentCard
│   ├── MeditationCard
│   ├── ActionPlanCard
│   └── BlockersCard
├── Voice Integration
│   ├── VoiceModeScreen
│   └── voiceApiService
└── Storage Services
    ├── syncService
    ├── authCache
    └── settingsCache
```

### Core Data Types

```typescript
interface CoachingMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isError?: boolean;
  originalUserMessage?: string;
}

interface CoachingSession {
  sessionId: string; // Always = firebaseUser.uid
  sessionType: 'default-session' | 'initial-life-deep-dive';
  messages: CoachingMessage[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  userId: string;
}
```

---

## Cache Management & Storage Strategy

### Multi-Layer Caching Architecture

#### 1. Local AsyncStorage Cache

```typescript
// Storage key pattern
const getStorageKey = (userId: string) => `coaching_messages_${userId}`;

// Cache management strategy
const saveMessagesToStorage = async (messages: CoachingMessage[], userId: string) => {
  const storageKey = getStorageKey(userId);
  // Keep last 300 messages in cache for better offline experience
  const messagesToSave = messages.slice(-300);
  await AsyncStorage.setItem(storageKey, JSON.stringify(messagesToSave));
};
```

**Cache Characteristics:**
- **Limit**: 300 messages per user
- **Purpose**: Fast offline access and immediate app startup
- **Update Pattern**: Every message change triggers cache update
- **Cleanup**: Automatic LRU-style pruning (keeps last 300)

#### 2. Firestore Backend Storage

```typescript
const saveMessagesToFirestore = async (messages: CoachingMessage[], userId: string) => {
  // Convert messages to Firestore format (save all messages to backend)
  const firestoreMessages = messages.map((msg) => ({
    id: msg.id,
    role: msg.role,
    content: msg.content,
    timestamp: msg.timestamp
  }));
  
  // Find or create coaching session document
  const sessionQuery = query(
    sessionsRef,
    where('userId', '==', userId),
    where('sessionType', '==', 'default-session')
  );
};
```

**Firestore Characteristics:**
- **Limit**: Unlimited message storage
- **Purpose**: Complete conversation backup and multi-device sync
- **Update Pattern**: Every message change triggers Firestore update
- **Document Structure**: Single document per user with embedded messages array

#### 3. General App Caching (SyncService)

```typescript
// Entry cache with sync status tracking
interface CachedEntry {
  id: string;
  content: string;
  timestamp: string;
  uid: string;
  _syncStatus: 'synced' | 'pending' | 'local-only';
  _lastSyncAttempt?: string;
}

// Three-tier storage strategy
class SyncService {
  // Tier 1: In-memory cache for active session
  private cachedEntries: Map<string, CachedEntry[]> = new Map();
  
  // Tier 2: AsyncStorage for offline persistence
  async getCachedEntries(userId: string): Promise<CachedEntry[]> {
    const cached = await AsyncStorage.getItem(`${STORAGE_KEYS.ENTRIES}_${userId}`);
    return cached ? JSON.parse(cached) : [];
  }
  
  // Tier 3: Firestore for cloud backup
  private async fetchEntriesFromFirestore(userId: string): Promise<CachedEntry[]> {
    const entriesQuery = query(
      collection(db, 'journal_entries'),
      where('uid', '==', userId),
      orderBy('timestamp', 'desc')
    );
  }
}
```

### Cache Invalidation Strategy

#### Time-Based Invalidation
```typescript
// Auth cache with 24-hour validity
private readonly CACHE_VALIDITY = 24 * 60 * 60 * 1000; // 24 hours

private isCacheValid(data: CachedAuthData): boolean {
  return (Date.now() - new Date(data.cachedAt).getTime()) < this.CACHE_VALIDITY;
}
```

#### Event-Based Invalidation
```typescript
// Real-time sync with automatic cache updates
this.realTimeUnsubscribe = onSnapshot(entriesQuery, async (snapshot) => {
  const latestEntries = snapshot.docs.map(doc => transformFirestoreDoc(doc));
  const mergedEntries = await this.mergeEntries(userId, latestEntries);
  await this.setCachedEntries(userId, mergedEntries);
});
```

#### Manual Invalidation
```typescript
// Force refresh functionality
const refreshEntries = async () => {
  await syncService.performBackgroundSync(firebaseUser.uid);
  const refreshedEntries = await syncService.getCachedEntries(firebaseUser.uid);
  updateGlobalState({ entries: refreshedEntries });
};
```

---

## Communication Protocols & API Integration

### 1. Streaming API Communication

#### Server-Sent Events (SSE) Protocol

```typescript
const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}api/coaching/chat`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({
    message: content.trim(),
    sessionId: sessionId,
    sessionType: 'default-session',
    conversationHistory: messages
  }),
});

// React Native streaming implementation
if (!response.body) {
  const fullResponse = await response.text();
  const lines = fullResponse.split('\n');
  let fullContent = '';
  
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = JSON.parse(line.slice(6));
      if (data.type === 'content') {
        fullContent += data.content;
      }
    }
  }
}
```

#### Streaming Data Format
```typescript
// SSE Event Types
interface StreamingEvent {
  type: 'content' | 'done' | 'error';
  content?: string;
  error?: string;
}

// Browser streaming (if ReadableStream available)
const reader = response.body.getReader();
const decoder = new TextDecoder();
let fullContent = '';

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const chunk = decoder.decode(value);
  const lines = chunk.split('\n');
  
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = JSON.parse(line.slice(6));
      // Process streaming data...
    }
  }
}
```

### 2. WebSocket Communication (Voice Mode)

#### Connection Establishment
```typescript
// Secure WebSocket URL generation via backend
const connectionResponse = await voiceApiService.requestVoiceConnection({
  sessionId: currentSessionId,
  userId: firebaseUser.uid,
}, token);

const { wsUrl } = connectionResponse;
const ws = new WebSocket(wsUrl);

// Session configuration
ws.send(JSON.stringify({
  type: 'session.update',
  session: {
    modalities: ['text', 'audio'],
    instructions: 'You are a helpful AI coach...',
    voice: 'alloy',
    input_audio_format: 'pcm16',
    output_audio_format: 'pcm16',
    input_audio_transcription: { model: 'whisper-1' }
  }
}));
```

#### Message Protocol
```typescript
interface RealtimeMessage {
  type: 'session.update' | 'input_audio_buffer.append' | 'response.create';
  session?: SessionConfig;
  audio?: string; // base64 encoded audio
  response?: ResponseConfig;
}

const handleRealtimeMessage = (data: RealtimeMessage) => {
  switch (data.type) {
    case 'session.updated':
      console.log('Session configuration updated');
      break;
    case 'input_audio_buffer.speech_started':
      setIsRecording(true);
      break;
    case 'response.audio.delta':
      // Handle streaming audio response
      playAudioChunk(data.delta);
      break;
  }
};
```

### 3. REST API Integration

#### Authentication Pattern
```typescript
// Clerk token-based authentication
const token = await getToken();
const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${token}`,
};

// API call with retry logic
const makeAPICall = async (endpoint: string, data: any, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });
      
      if (response.ok) return await response.json();
      throw new Error(`API Error: ${response.status}`);
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
};
```

#### Progress Evaluation API
```typescript
const evaluateProgress = async (sessionId: string, conversationHistory: CoachingMessage[]) => {
  const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}api/coaching/progress`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      conversationHistory,
      previousProgress: progress,
      sessionId,
    }),
  });
  
  if (response.ok) {
    const result = await response.json();
    if (result.success && typeof result.progress === 'number') {
      setProgress(result.progress);
    }
  }
};
```

---

## State Management & Data Flow

### Global State Architecture

#### Singleton Pattern for Sync
```typescript
// Global state to persist across component mounts
let globalEntries: CachedEntry[] = [];
let globalSyncStatus: SyncState = {
  lastSyncTime: new Date(0).toISOString(),
  syncInProgress: false,
  pendingUploads: [],
  failedSyncs: [],
};
let globalListeners: Set<() => void> = new Set();

// State update with listener notification
function updateGlobalState(updates: {
  entries?: CachedEntry[];
  syncStatus?: SyncState;
  isLoading?: boolean;
  error?: string | null;
}) {
  let hasChanges = false;
  
  Object.entries(updates).forEach(([key, value]) => {
    if (value !== undefined && value !== global[key]) {
      global[key] = value;
      hasChanges = true;
    }
  });
  
  if (hasChanges) {
    globalListeners.forEach(listener => listener());
  }
}
```

#### Hook-Based State Management
```typescript
export function useSyncSingleton(): UseSyncReturn {
  const { firebaseUser } = useAuth();
  const [, forceUpdate] = useState({});

  // Force re-render when global state changes
  useEffect(() => {
    const listener = () => forceUpdate({});
    globalListeners.add(listener);
    return () => globalListeners.delete(listener);
  }, []);

  // Initialize sync when user changes
  useEffect(() => {
    if (firebaseUser?.uid) {
      initializeSyncForUser(firebaseUser.uid);
    } else {
      clearSyncData();
    }
  }, [firebaseUser?.uid]);
}
```

### Message State Flow

#### 1. Message Creation Flow
```
User Input → validateInput() → createUserMessage() → addToState() → triggerAPI()
     ↓
API Response → streamingHandler() → createAIMessage() → updateState() → saveToCache()
     ↓
Cache Update → AsyncStorage → Firestore → StateSync → UIUpdate
```

#### 2. Pagination State Management
```typescript
// Pagination state tracking
const [allMessages, setAllMessages] = useState<CoachingMessage[]>([]);
const [displayedMessageCount, setDisplayedMessageCount] = useState(300);
const [isLoadingMore, setIsLoadingMore] = useState(false);
const [hasMoreMessages, setHasMoreMessages] = useState(false);
const MESSAGES_PER_PAGE = 100;

// Load more messages for pagination
const loadMoreMessages = useCallback(async () => {
  if (isLoadingMore || !hasMoreMessages) return;
  
  setIsLoadingMore(true);
  await new Promise(resolve => setTimeout(resolve, 800)); // UX delay
  
  const newCount = Math.min(displayedMessageCount + MESSAGES_PER_PAGE, allMessages.length);
  const messagesToShow = allMessages.slice(-newCount);
  
  setMessages(messagesToShow);
  setDisplayedMessageCount(newCount);
  setHasMoreMessages(newCount < allMessages.length);
}, [isLoadingMore, hasMoreMessages, displayedMessageCount, allMessages]);
```

#### 3. State Synchronization Strategy
```typescript
// Multi-device sync strategy
const syncMessages = useCallback(async (userId: string): Promise<CoachingMessage[]> => {
  console.log('🔄 Starting multi-device sync for user:', userId);
  
  try {
    // 1. Try to load from Firestore first (source of truth)
    const firestoreResult = await loadMessagesFromFirestore(userId);
    
    if (firestoreResult.totalCount > 0) {
      // 2. Firestore has messages, set up pagination
      setAllMessages(firestoreResult.allMessages);
      setHasMoreMessages(firestoreResult.totalCount > 300);
      setDisplayedMessageCount(Math.min(300, firestoreResult.totalCount));
      
      // 3. Cache last 300 messages locally
      const displayMessages = firestoreResult.allMessages.slice(-300);
      await saveMessagesToStorage(firestoreResult.allMessages, userId);
      return displayMessages;
    } else {
      // 4. Fallback to local cache
      const localMessages = await loadMessagesFromStorage(userId);
      if (localMessages.length > 0) {
        await saveMessagesToFirestore(localMessages, userId);
        return localMessages;
      }
    }
  } catch (error) {
    // 5. Error fallback
    const fallbackMessages = await loadMessagesFromStorage(userId);
    return fallbackMessages;
  }
  
  return [];
}, []);
```

---

## Multi-Device Synchronization

### Synchronization Architecture

#### 1. Three-Tier Sync Strategy

```typescript
// Tier 1: Device A Local Cache (300 messages)
// Tier 2: Firestore Cloud Storage (all messages)  
// Tier 3: Device B Local Cache (300 messages)

const synchronizationFlow = {
  // Device A sends message
  1: "User types message on Device A",
  2: "Message added to local state immediately",
  3: "Message saved to AsyncStorage cache",
  4: "Message sent to API for AI response", 
  5: "AI response streamed back to Device A",
  6: "Complete conversation saved to Firestore",
  
  // Device B receives update
  7: "Device B app becomes active",
  8: "initializeSyncForUser() called",
  9: "loadMessagesFromFirestore() fetches latest",
  10: "Local cache updated with latest 300 messages",
  11: "UI refreshed with new conversation state"
};
```

#### 2. Conflict Resolution Strategy

```typescript
const mergeEntries = async (userId: string, firestoreEntries: CachedEntry[]): Promise<CachedEntry[]> => {
  const cachedEntries = await getCachedEntries(userId);
  const merged = new Map<string, CachedEntry>();

  // Firestore entries take precedence (source of truth)
  firestoreEntries.forEach(entry => {
    merged.set(entry.id, entry);
  });

  // Add local-only entries that haven't been synced yet
  cachedEntries.forEach(entry => {
    if (entry._syncStatus === 'local-only' || entry._syncStatus === 'pending') {
      merged.set(entry.id, entry);
    }
  });

  return Array.from(merged.values()).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
};
```

#### 3. Real-Time Sync Implementation

```typescript
// Real-time Firestore listener (disabled by default to prevent loops)
startRealTimeSync(userId: string): void {
  const entriesQuery = query(
    collection(db, 'journal_entries'),
    where('uid', '==', userId),
    orderBy('timestamp', 'desc')
  );

  this.realTimeUnsubscribe = onSnapshot(entriesQuery, async (snapshot) => {
    console.log('🔴 Real-time update received:', snapshot.docs.length, 'entries');
    
    const latestEntries = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      _syncStatus: 'synced',
    }));

    const mergedEntries = await this.mergeEntries(userId, latestEntries);
    await this.setCachedEntries(userId, mergedEntries);
  });
}
```

### Offline-First Architecture

#### 1. Optimistic Updates
```typescript
const addLocalEntry = async (userId: string, entry: CachedEntry): Promise<string> => {
  const entryId = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const localEntry = { ...entry, id: entryId, _syncStatus: 'local-only' };

  // Add to cache immediately
  const cachedEntries = await getCachedEntries(userId);
  const updatedEntries = [localEntry, ...cachedEntries];
  await setCachedEntries(userId, updatedEntries);

  // Queue for sync
  const syncState = await getSyncState(userId);
  await setSyncState(userId, {
    ...syncState,
    pendingUploads: [...syncState.pendingUploads, entryId],
  });

  return entryId;
};
```

#### 2. Background Sync
```typescript
const forceUploadAllCachedEntries = async (userId: string): Promise<void> => {
  const cachedEntries = await getCachedEntries(userId);
  const offlineEntries = cachedEntries.filter(e => 
    e._syncStatus === 'local-only' || e._syncStatus === 'pending'
  );

  if (offlineEntries.length === 0) return;

  let successCount = 0;
  let failCount = 0;
  
  // Upload entries one by one to avoid overwhelming backend
  for (const entry of offlineEntries) {
    try {
      await syncSingleEntryToBackend(userId, entry.id);
      successCount++;
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 150));
    } catch (error) {
      failCount++;
      console.error(`Failed to upload offline entry ${entry.id}:`, error);
    }
  }
  
  console.log(`FORCE UPLOAD: ${successCount} success, ${failCount} failed`);
};
```

#### 3. App State Sync
```typescript
const setupAppStateListener = () => {
  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (!currentUserId) return;

    if (nextAppState === 'active') {
      console.log('App became active, refreshing sync with backend');
      initializeSyncForUser(currentUserId);
    } else if (nextAppState === 'background') {
      console.log('App went to background, performing final sync');
      syncService.performBackgroundSync(currentUserId).then(() => {
        syncService.stopRealTimeSync();
      });
    }
  };

  AppState.addEventListener('change', handleAppStateChange);
};
```

---

## Performance Optimizations & Memory Management

### Message Pagination System

#### 1. Memory-Efficient Message Loading
```typescript
// Three-tier pagination strategy
const MEMORY_LIMITS = {
  DISPLAYED_MESSAGES: 300,      // Messages shown in UI
  CACHE_MESSAGES: 300,          // Messages in AsyncStorage  
  PAGINATION_CHUNK: 100,        // Messages loaded per page
  MAX_FIRESTORE_MESSAGES: -1    // Unlimited cloud storage
};

// Efficient message slice management
const getMessagesWithSeparators = useCallback((messages: CoachingMessage[]) => {
  if (messages.length === 0) return [];
  
  const result = [];
  let lastDate: string | null = null;
  
  messages.forEach((message, index) => {
    const messageDate = new Date(message.timestamp).toDateString();
    
    // Add date separator for new days
    if (messageDate !== lastDate) {
      result.push({
        type: 'separator',
        date: new Date(message.timestamp),
        id: `separator-${messageDate}-${index}`
      });
      lastDate = messageDate;
    }
    
    result.push(message);
  });
  
  return result;
}, []);
```

#### 2. Lazy Loading with Pull-to-Refresh
```typescript
// Pagination trigger detection
const handleScroll = (event: any) => {
  const { contentOffset } = event.nativeEvent;
  const scrollY = contentOffset.y;
  
  // Load more messages when pulling to very top
  const isAtVeryTop = scrollY <= 10;
  const isPullingUp = scrollY < 0;
  const now = Date.now();
  const timeSinceLastLoad = now - lastLoadTimeRef.current;
  
  if ((isAtVeryTop || isPullingUp) && 
      hasMoreMessages && 
      !isLoadingMore && 
      !isLoading && 
      timeSinceLastLoad > LOAD_THROTTLE_MS) {
    console.log('User pulled to top, loading more messages...');
    lastLoadTimeRef.current = now;
    loadMoreMessages();
  }
};
```

#### 3. Content Height Optimization
```typescript
// Dynamic content height calculation for efficient scrolling
const dynamicContentHeight = useMemo(() => {
  let totalHeight = 12; // paddingTop
  
  messages.forEach((message, index) => {
    const contentLength = message.content.length;
    const lines = Math.max(1, Math.ceil(contentLength / 44));
    let messageHeight = lines * 22 + 32;
    
    if (message.role === 'assistant') {
      const isLastMessage = index === messages.length - 1;
      const isCurrentlyStreaming = isLastMessage && isLoading;
      
      messageHeight += isCurrentlyStreaming ? 200 : 80;
    }
    
    totalHeight += messageHeight + 16;
  });
  
  // Add loading indicator height
  if (shouldShowLoadingIndicator) {
    totalHeight += 60;
  }
  
  return totalHeight;
}, [messages, isLoading, shouldShowLoadingIndicator]);
```

### Scroll Performance Optimization

#### 1. Smart Scroll Positioning
```typescript
// Apple Notes-like scroll behavior
const scrollToShowLastMessage = useCallback(() => {
  if (!scrollViewRef.current || messages.length === 0) return;
  
  const lastMessage = messages[messages.length - 1];
  if (lastMessage.role !== 'user') return;
  
  const lastMessageRef = messageRefs.current[lastMessage.id];
  
  if (lastMessageRef) {
    setTimeout(() => {
      lastMessageRef.measureLayout(
        scrollViewRef.current as any,
        (msgX: number, msgY: number, msgWidth: number, msgHeight: number) => {
          // Position message 20px below header
          const targetScrollY = Math.max(0, msgY - MESSAGE_TARGET_OFFSET);
          
          scrollViewRef.current?.scrollTo({
            y: targetScrollY,
            animated: true
          });
          
          targetScrollPosition.current = targetScrollY;
          hasUserScrolled.current = false;
        }
      );
    }, 150); // Wait for layout stabilization
  }
}, [messages]);
```

#### 2. Keyboard-Aware Scrolling
```typescript
// Dynamic bottom padding for keyboard handling
const dynamicBottomPadding = useMemo(() => {
  const basePadding = 50;
  const keyboardExtraSpace = keyboardHeight > 0 ? 
    keyboardHeight + containerHeight + 20 : 80;
  const extraForInput = Math.max(0, containerHeight - CONTAINER_BASE_HEIGHT) + 40;
  
  const lastMessage = messages[messages.length - 1];
  const isUserWaitingForAI = lastMessage?.role === 'user' || isLoading;
  
  if (keyboardHeight > 0) {
    return keyboardExtraSpace;
  } else if (isUserWaitingForAI) {
    return basePadding + extraForInput + 120;
  }
  
  return basePadding + extraForInput;
}, [messages, isLoading, containerHeight, keyboardHeight]);
```

#### 3. Scroll Event Throttling
```typescript
// Throttled scroll handling to prevent performance issues
const LOAD_THROTTLE_MS = 1000; // 1 second between loads
const lastLoadTimeRef = useRef<number>(0);

const handleScroll = useCallback((event: any) => {
  const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
  const scrollY = contentOffset.y;
  
  // Throttled pagination check
  const now = Date.now();
  const timeSinceLastLoad = now - lastLoadTimeRef.current;
  
  if (shouldTriggerPagination && timeSinceLastLoad > LOAD_THROTTLE_MS) {
    lastLoadTimeRef.current = now;
    loadMoreMessages();
  }
}, []);
```

### Memory Management Strategies

#### 1. Component Cleanup
```typescript
// Automatic cleanup on component unmount
useEffect(() => {
  return () => {
    // Clean up timers
    if (positionUpdateInterval.current) {
      clearInterval(positionUpdateInterval.current);
    }
    
    // Deactivate keep awake
    deactivateKeepAwake();
    
    // Stop real-time sync
    syncService.stopRealTimeSync();
    
    // Clear abort controllers
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };
}, []);
```

#### 2. Cache Size Management
```typescript
// Automatic cache pruning
const saveMessagesToStorage = useCallback(async (messages: CoachingMessage[], userId: string) => {
  try {
    const storageKey = getStorageKey(userId);
    // Keep last 300 messages in cache for better offline experience
    const messagesToSave = messages.slice(-300);
    await AsyncStorage.setItem(storageKey, JSON.stringify(messagesToSave));
    debugLog(`💾 Saved ${messagesToSave.length} messages to storage (last 300)`);
  } catch (error) {
    console.error('Error saving messages to storage:', error);
  }
}, []);
```

#### 3. Debounced State Updates
```typescript
// Debounced input handling to prevent excessive re-renders
const handleTextChange = useCallback(
  debounce((text: string) => {
    setChatInput(text);
    
    // Calculate lines and height
    const estimatedLines = Math.max(1, text.split('\n').length);
    const charsPerLine = 42;
    const totalLines = calculateWordWrappedLines(text, charsPerLine);
    
    setCurrentLineCount(totalLines);
    
    const maxLines = isInputExpanded ? EXPANDED_MAX_LINES : MAX_LINES;
    const actualLines = Math.max(MIN_LINES, Math.min(maxLines, totalLines));
    const newInputHeight = actualLines * LINE_HEIGHT;
    
    setInputHeight(newInputHeight);
    setContainerHeight(calculateContainerHeight(newInputHeight));
  }, 100),
  [isInputExpanded]
);
```

---

## Voice Mode Integration

### Audio Processing Pipeline

#### 1. Audio Permission & Configuration
```typescript
const initializeAudio = async () => {
  try {
    const { status } = await Audio.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Microphone access is required for voice mode.');
      return;
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      playThroughEarpieceAndroid: false,
      staysActiveInBackground: false,
    });
  } catch (error) {
    console.error('Failed to initialize audio:', error);
  }
};
```

#### 2. Real-time Audio Streaming
```typescript
// WebSocket-based audio streaming
const connectToRealtimeAPI = useCallback(async () => {
  const { wsUrl } = await voiceApiService.requestVoiceConnection({
    sessionId: currentSessionId,
    userId: firebaseUser.uid,
  }, token);
  
  const ws = new WebSocket(wsUrl);
  
  ws.onopen = () => {
    // Configure session for audio processing
    ws.send(JSON.stringify({
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        instructions: 'You are a helpful AI coach. Speak naturally...',
        voice: 'alloy',
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        input_audio_transcription: { model: 'whisper-1' }
      }
    }));
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    handleRealtimeMessage(data);
  };
}, []);
```

#### 3. Audio Level Monitoring
```typescript
const AudioLevelIndicator = ({ audioLevel, colorScheme }) => {
  const totalDots = 6;
  
  const isDotActive = (index: number) => {
    const threshold = (index + 1) / totalDots;
    return audioLevel >= threshold;
  };
  
  return (
    <View style={styles.audioLevelContainer}>
      {Array.from({ length: totalDots }).map((_, index) => (
        <View 
          key={index}
          style={[
            styles.audioLevelDot, 
            { 
              backgroundColor: isDotActive(index)
                ? (colorScheme === 'dark' ? '#888888' : '#111111')
                : (colorScheme === 'dark' ? '#444444' : '#E5E5E5')
            }
          ]}
        />
      ))}
    </View>
  );
};
```

### Voice API Architecture

#### 1. Backend Voice Service
```typescript
class VoiceApiService {
  // Secure WebSocket URL generation
  async requestVoiceConnection(
    request: VoiceConnectionRequest,
    authToken: string
  ): Promise<VoiceConnectionResponse> {
    const response = await fetch(`${this.baseUrl}api/voice/connect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify(request),
    });

    return await response.json();
  }

  // Session cleanup
  async endVoiceSession(sessionId: string, authToken: string): Promise<void> {
    await fetch(`${this.baseUrl}api/voice/sessions/${sessionId}/end`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    });
  }
}
```

#### 2. Message Handling
```typescript
const handleRealtimeMessage = (data: any) => {
  switch (data.type) {
    case 'session.updated':
      console.log('✅ Session configuration updated');
      break;
      
    case 'input_audio_buffer.speech_started':
      setIsRecording(true);
      setAudioLevel(0.8);
      break;
      
    case 'input_audio_buffer.speech_stopped':
      setIsRecording(false);
      setAudioLevel(0);
      break;
      
    case 'response.audio.delta':
      setIsAITalking(true);
      playAudioChunk(data.delta);
      break;
      
    case 'response.text.delta':
      const newMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant' as const,
        content: data.delta,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, newMessage]);
      break;
      
    case 'response.done':
      setIsAITalking(false);
      break;
  }
};
```

---

## Error Handling & Resilience

### Network Error Recovery

#### 1. Retry Logic with Exponential Backoff
```typescript
const makeAPICallWithRetry = async (endpoint: string, data: any, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getToken()}`,
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        return await response.json();
      }
      
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error);
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, attempt - 1) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};
```

#### 2. Graceful Degradation
```typescript
const sendMessage = useCallback(async (content: string, sessionId: string) => {
  // Cancel any ongoing request
  if (abortControllerRef.current) {
    abortControllerRef.current.abort();
  }
  abortControllerRef.current = new AbortController();

  try {
    // Optimistic update - add user message immediately
    const userMessage = createUserMessage(content);
    setMessages(prev => [...prev, userMessage]);
    
    // API call with timeout
    const response = await Promise.race([
      fetch(apiEndpoint, { 
        signal: abortControllerRef.current.signal,
        // ... other options
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 30000)
      )
    ]);

    // Handle response...
    
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('Request was cancelled');
      return;
    }
    
    // Add error message to chat
    const errorMessage = {
      id: `error-${Date.now()}`,
      role: 'assistant' as const,
      content: `Sorry, I encountered an error: ${error.message}.\nPlease try again.`,
      timestamp: new Date(),
      isError: true,
      originalUserMessage: content,
    };
    
    setMessages(prev => [...prev, errorMessage]);
  }
}, []);
```

#### 3. Offline State Management
```typescript
// Network connectivity handling
const [isOnline, setIsOnline] = useState(true);

useEffect(() => {
  const unsubscribe = NetInfo.addEventListener(state => {
    setIsOnline(state.isConnected && state.isInternetReachable);
    
    if (state.isConnected && state.isInternetReachable) {
      console.log('📡 Network reconnected, syncing pending data...');
      syncPendingData();
    } else {
      console.log('📵 Network disconnected, entering offline mode...');
    }
  });

  return unsubscribe;
}, []);

const syncPendingData = async () => {
  if (!firebaseUser?.uid) return;
  
  try {
    // Upload any local-only entries
    await syncService.forceUploadAllCachedEntries(firebaseUser.uid);
    
    // Refresh from server
    await syncService.performBackgroundSync(firebaseUser.uid);
    
    console.log('✅ Offline data successfully synced');
  } catch (error) {
    console.error('❌ Failed to sync offline data:', error);
  }
};
```

### Error Boundaries & Fault Tolerance

#### 1. React Error Boundary
```typescript
class EditorErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Editor Error Boundary caught an error:', error, errorInfo);
    
    // Log to analytics service
    analytics.logError('editor_crash', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorText}>
            The editor encountered an error. Please try refreshing the app.
          </Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => this.setState({ hasError: false, error: null })}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}
```

#### 2. Stream Error Recovery
```typescript
// Streaming response error handling
const handleStreamingResponse = async (response) => {
  try {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';
    let streamTimeout = null;

    // Set timeout for inactive streams
    const resetTimeout = () => {
      clearTimeout(streamTimeout);
      streamTimeout = setTimeout(() => {
        console.error('Stream timeout - no data received for 30s');
        reader.cancel();
      }, 30000);
    };

    resetTimeout();

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        clearTimeout(streamTimeout);
        break;
      }

      resetTimeout();
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            
            if (data.type === 'error') {
              throw new Error(data.error || 'Streaming error occurred');
            }
            
            if (data.type === 'content') {
              fullContent += data.content;
              updateStreamingMessage(fullContent);
            }
          } catch (parseError) {
            console.warn('Failed to parse streaming line:', line, parseError);
            // Continue processing other lines
          }
        }
      }
    }
  } catch (error) {
    console.error('Streaming error:', error);
    
    // Add error recovery message
    addErrorRecoveryMessage(error.message);
  }
};
```

---

## Security & Authentication

### Authentication Flow

#### 1. Clerk Integration
```typescript
// Multi-layer authentication
const { user, firebaseUser, getToken } = useAuth();

// Token-based API authentication
const makeAuthenticatedRequest = async (endpoint: string, data: any) => {
  const token = await getToken();
  if (!token) {
    throw new Error('Authentication token not available');
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (response.status === 401) {
    // Token expired, trigger re-authentication
    throw new Error('Authentication expired');
  }

  return response;
};
```

#### 2. Session Security
```typescript
// Secure session ID management
const getSessionId = (): string => {
  // Always use authenticated user ID as session ID
  return firebaseUser?.uid || 'anonymous';
};

// Session validation
const validateSession = (sessionId: string, userId: string): boolean => {
  // Ensure session belongs to authenticated user
  return sessionId === userId && userId !== 'anonymous';
};

// Secure data access
const loadUserMessages = async (userId: string) => {
  if (!validateSession(getSessionId(), userId)) {
    throw new Error('Unauthorized session access');
  }
  
  // Proceed with data loading...
};
```

#### 3. Data Isolation
```typescript
// User-scoped data access
const getUserStorageKey = (userId: string, dataType: string): string => {
  if (!userId || userId === 'anonymous') {
    throw new Error('Invalid user ID for storage access');
  }
  return `${dataType}_${userId}`;
};

// Firestore security rules enforcement
const firestoreQuery = query(
  collection(db, 'coachingSessions'),
  where('userId', '==', firebaseUser.uid), // User can only access own data
  where('sessionType', '==', 'default-session')
);
```

### Data Privacy & Protection

#### 1. Sensitive Data Handling
```typescript
// PII data sanitization
const sanitizeUserData = (data: any): any => {
  const sensitiveFields = ['email', 'phoneNumber', 'address'];
  const sanitized = { ...data };
  
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      // Redact sensitive information in logs
      sanitized[field] = '[REDACTED]';
    }
  });
  
  return sanitized;
};

// Secure logging
const secureLog = (message: string, data?: any) => {
  const sanitizedData = data ? sanitizeUserData(data) : undefined;
  console.log(message, sanitizedData);
};
```

#### 2. Local Storage Encryption
```typescript
// Encrypt sensitive data before storing locally
const encryptData = async (data: any): Promise<string> => {
  // Implementation would use proper encryption library
  // This is a simplified example
  const jsonString = JSON.stringify(data);
  return btoa(jsonString); // Base64 encoding (use proper encryption in production)
};

const decryptData = async (encryptedData: string): Promise<any> => {
  try {
    const jsonString = atob(encryptedData);
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Failed to decrypt data:', error);
    return null;
  }
};

// Secure storage operations
const secureStorageSet = async (key: string, data: any) => {
  const encrypted = await encryptData(data);
  await AsyncStorage.setItem(key, encrypted);
};

const secureStorageGet = async (key: string) => {
  const encrypted = await AsyncStorage.getItem(key);
  return encrypted ? await decryptData(encrypted) : null;
};
```

---

## Analytics & Tracking

### Event Tracking System

#### 1. Coaching Analytics
```typescript
const { 
  trackCoachingSessionStarted, 
  trackCoachingSessionCompleted,
  trackEntryCreated
} = useAnalytics();

// Session lifecycle tracking
const trackSessionLifecycle = {
  started: (sessionId: string) => {
    trackCoachingSessionStarted({
      session_id: sessionId,
      session_type: 'regular',
      trigger: 'manual',
    });
  },
  
  completed: (sessionId: string, metrics: SessionMetrics) => {
    trackCoachingSessionCompleted({
      session_id: sessionId,
      duration_minutes: metrics.duration,
      message_count: metrics.messageCount,
      words_written: metrics.wordsWritten,
      insights_generated: metrics.insights,
      session_type: 'regular',
    });
  },
  
  entryCreated: (entryId: string) => {
    trackEntryCreated({
      entry_id: entryId,
    });
  }
};
```

#### 2. Performance Metrics
```typescript
// Performance tracking
const performanceTracker = {
  messageLoadTime: (startTime: number, messageCount: number) => {
    const loadTime = Date.now() - startTime;
    analytics.track('message_load_performance', {
      load_time_ms: loadTime,
      message_count: messageCount,
      performance_category: loadTime < 1000 ? 'fast' : loadTime < 3000 ? 'medium' : 'slow'
    });
  },
  
  syncPerformance: (operation: string, duration: number, success: boolean) => {
    analytics.track('sync_performance', {
      operation,
      duration_ms: duration,
      success,
      performance_impact: duration < 500 ? 'low' : duration < 2000 ? 'medium' : 'high'
    });
  },
  
  apiResponseTime: (endpoint: string, responseTime: number) => {
    analytics.track('api_performance', {
      endpoint,
      response_time_ms: responseTime,
      status: responseTime < 2000 ? 'good' : responseTime < 5000 ? 'acceptable' : 'poor'
    });
  }
};
```

#### 3. User Behavior Analytics
```typescript
// User interaction tracking
const behaviorTracker = {
  messagePatterns: (messageCount: number, sessionDuration: number) => {
    const messagesPerMinute = messageCount / (sessionDuration / 60000);
    
    analytics.track('user_engagement_pattern', {
      messages_per_minute: messagesPerMinute,
      session_duration_minutes: sessionDuration / 60000,
      engagement_level: messagesPerMinute > 2 ? 'high' : messagesPerMinute > 1 ? 'medium' : 'low'
    });
  },
  
  featureUsage: (feature: string, usage_context: string) => {
    analytics.track('feature_usage', {
      feature,
      usage_context,
      timestamp: Date.now()
    });
  },
  
  errorPatterns: (errorType: string, errorContext: string) => {
    analytics.track('error_occurrence', {
      error_type: errorType,
      error_context: errorContext,
      user_action_before_error: 'coaching_interaction'
    });
  }
};
```

### Data Collection & Privacy

#### 1. Privacy-Compliant Analytics
```typescript
// Anonymized data collection
const collectAnonymizedMetrics = (sessionData: any) => {
  return {
    session_duration: sessionData.duration,
    message_count: sessionData.messageCount,
    words_written: sessionData.wordsWritten,
    coaching_cards_generated: sessionData.cardsGenerated,
    // No PII or message content
    user_id_hash: hashUserId(sessionData.userId), // One-way hash
    timestamp: Date.now()
  };
};

// Consent-based tracking
const trackWithConsent = (eventName: string, data: any) => {
  if (userConsent.analytics) {
    const anonymizedData = anonymizeData(data);
    analytics.track(eventName, anonymizedData);
  }
};
```

#### 2. Debugging & Monitoring
```typescript
// Debug logging system
const DEBUG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

const debugLogger = {
  currentLevel: __DEV__ ? DEBUG_LEVELS.DEBUG : DEBUG_LEVELS.ERROR,
  
  log: (level: number, component: string, message: string, data?: any) => {
    if (level <= debugLogger.currentLevel) {
      const prefix = ['❌', '⚠️', 'ℹ️', '🔧'][level];
      console.log(`${prefix} [${component}] ${message}`, data || '');
      
      // Send error logs to monitoring service
      if (level === DEBUG_LEVELS.ERROR) {
        monitoringService.logError(component, message, data);
      }
    }
  },
  
  error: (component: string, message: string, data?: any) => 
    debugLogger.log(DEBUG_LEVELS.ERROR, component, message, data),
  warn: (component: string, message: string, data?: any) => 
    debugLogger.log(DEBUG_LEVELS.WARN, component, message, data),
  info: (component: string, message: string, data?: any) => 
    debugLogger.log(DEBUG_LEVELS.INFO, component, message, data),
  debug: (component: string, message: string, data?: any) => 
    debugLogger.log(DEBUG_LEVELS.DEBUG, component, message, data),
};
```

---

## Conclusion

This deep technical analysis covers the complete coaching system architecture, from low-level cache management to high-level user interactions. The system is designed with:

### Key Architectural Principles

1. **Offline-First**: Local cache with background sync ensures functionality without network
2. **Performance Optimized**: Memory limits, pagination, and throttling prevent performance degradation
3. **Multi-Device Sync**: Firestore-based synchronization with conflict resolution
4. **Resilient Communication**: Retry logic, error recovery, and graceful degradation
5. **Security-Focused**: User data isolation, secure authentication, and privacy protection
6. **Analytics-Driven**: Comprehensive tracking for performance monitoring and user insights

### Technical Specifications

- **Message Limit**: 300 messages in local cache, unlimited in Firestore
- **Pagination**: 100 messages per page with pull-to-refresh loading
- **Sync Strategy**: Three-tier (memory → AsyncStorage → Firestore)
- **API Protocol**: SSE streaming for coaching, WebSocket for voice mode
- **Error Recovery**: Exponential backoff with 3-retry limit
- **Performance**: Sub-1000ms message loading, throttled scroll events
- **Security**: Token-based auth, user-scoped data access, PII protection

The system successfully balances performance, reliability, and user experience while maintaining robust data consistency across multiple devices and network conditions.
