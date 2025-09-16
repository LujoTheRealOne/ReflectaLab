import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, Unsubscribe } from 'firebase/firestore';

export interface CoachingMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isError?: boolean;
  originalUserMessage?: string;
}

export interface CoachingSession {
  id: string;
  userId: string;
  sessionType: string;
  messages: CoachingMessage[];
  createdAt: Date;
  updatedAt: Date;
  duration?: number;
  wordCount?: number;
  title?: string;
  goal?: string;
  plannedDuration?: string;
  parentSessionId?: string;
}

interface UseCoachingSessionReturn {
  session: CoachingSession | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  hasSession: boolean;
}

export function useCoachingSession(sessionId: string | null): UseCoachingSessionReturn {
  const { user, firebaseUser } = useAuth();
  const [session, setSession] = useState<CoachingSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Helper to convert Firestore timestamp to Date
  const convertTimestamp = (timestamp: any): Date => {
    if (!timestamp) return new Date();
    if (timestamp.toDate) return timestamp.toDate();
    if (timestamp.seconds) return new Date(timestamp.seconds * 1000);
    return new Date(timestamp);
  };

  // Helper to convert Firestore session to our format
  const convertFirestoreSession = useCallback((data: any, docId: string): CoachingSession => {
    return {
      id: docId,
      userId: data.userId || '',
      sessionType: data.sessionType || 'default-session',
      messages: (data.messages || []).map((msg: any) => ({
        id: msg.id || `msg_${Date.now()}`,
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content || '',
        timestamp: convertTimestamp(msg.timestamp),
        isError: msg.isError || false,
        originalUserMessage: msg.originalUserMessage
      })),
      createdAt: convertTimestamp(data.createdAt),
      updatedAt: convertTimestamp(data.updatedAt),
      duration: data.duration,
      wordCount: data.wordCount,
      title: data.title,
      goal: data.goal,
      plannedDuration: data.plannedDuration,
      parentSessionId: data.parentSessionId
    };
  }, []);

  useEffect(() => {
    // Reset state when sessionId changes or user logs out
    if (!user?.id || !firebaseUser?.uid || !sessionId) {
      setSession(null);
      setLoading(false);
      setError(null);
      return;
    }

    // Security validation: Define valid session ID patterns
    const isMainChatSession = sessionId === user.id;
    const isBreakoutSession = sessionId.startsWith('session_');
    const isOnboardingSession = sessionId.startsWith('onboarding-');
    
    if (!isMainChatSession && !isBreakoutSession && !isOnboardingSession) {
      console.warn('⚠️ [COACHING-SESSION] Invalid session ID format:', sessionId);
      setSession(null);
      setLoading(false);
      setError('Invalid session ID');
      return;
    }

    setLoading(true);
    setError(null);

    console.log('🔄 [COACHING-SESSION] Setting up real-time listener for:', sessionId);

    // Set up real-time listener for the coaching session
    const sessionDocRef = doc(db, 'coachingSessions', sessionId);
    
    const unsubscribe: Unsubscribe = onSnapshot(
      sessionDocRef,
      (docSnapshot) => {
        try {
          if (docSnapshot.exists()) {
            const sessionData = convertFirestoreSession(docSnapshot.data(), docSnapshot.id);
            setSession(sessionData);
            setLoading(false);
            
            // Log session load for development
            if (__DEV__) {
              console.log(`✅ [COACHING-SESSION] Loaded session: ${sessionId} with ${sessionData.messages.length} messages`, {
                sessionType: sessionData.sessionType,
                title: sessionData.title,
                goal: sessionData.goal,
                messageCount: sessionData.messages.length,
                lastMessageRole: sessionData.messages[sessionData.messages.length - 1]?.role,
                lastMessagePreview: sessionData.messages[sessionData.messages.length - 1]?.content.substring(0, 50) + '...'
              });
            }
          } else {
            console.log(`📭 [COACHING-SESSION] No session found: ${sessionId}`);
            setSession(null);
            setLoading(false);
          }
        } catch (err) {
          console.error('❌ [COACHING-SESSION] Error processing session data:', err);
          setError(err instanceof Error ? err.message : 'Failed to process session data');
          setLoading(false);
        }
      },
      (err) => {
        console.error('❌ [COACHING-SESSION] Firestore listener error:', err);
        setError(err.message || 'Failed to listen to session changes');
        setLoading(false);
      }
    );

    // Cleanup listener on unmount or dependencies change
    return () => {
      console.log('🧹 [COACHING-SESSION] Cleaning up listener for:', sessionId);
      unsubscribe();
    };
  }, [user?.id, firebaseUser?.uid, sessionId, convertFirestoreSession]);

  // Helper function to manually refetch session
  const refetch = useCallback(async () => {
    if (!sessionId || !user?.id) return;

    try {
      setLoading(true);
      setError(null);
      
      // The real-time listener will handle the update
      console.log('🔄 [COACHING-SESSION] Manual refetch requested for:', sessionId);
    } catch (err) {
      console.error('❌ [COACHING-SESSION] Error during manual refetch:', err);
      setError(err instanceof Error ? err.message : 'Failed to refetch coaching session');
    } finally {
      setLoading(false);
    }
  }, [sessionId, user?.id]);

  return {
    session,
    loading,
    error,
    refetch,
    hasSession: session !== null
  };
}
