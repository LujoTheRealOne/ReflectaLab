import { useState, useEffect } from 'react';
import { FirestoreService } from '@/lib/firestore';
import { useAuth } from '@/hooks/useAuth';
import { userInsight } from '@/types/insights';

export const useInsights = () => {
  const { firebaseUser } = useAuth();
  const [insights, setInsights] = useState<userInsight | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!firebaseUser?.uid) {
      setInsights(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    // Set up real-time listener for insights
    console.log('🔍 Setting up insights listener for user:', firebaseUser.uid);
    const unsubscribe = FirestoreService.subscribeToUserInsights(
      firebaseUser.uid,
      (newInsights) => {
        console.log('🔍 Insights listener callback triggered:', {
          hasInsights: !!newInsights,
          insightsData: newInsights ? {
            mainFocusSourcesCount: newInsights.mainFocus.sources?.length || 0,
            keyBlockersSourcesCount: newInsights.keyBlockers.sources?.length || 0,
            planSourcesCount: newInsights.plan.sources?.length || 0,
            updatedAt: newInsights.updatedAt
          } : null
        });
        setInsights(newInsights);
        setLoading(false);
      }
    );

    // Cleanup listener on unmount or user change
    return () => {
      unsubscribe();
    };
  }, [firebaseUser?.uid]);

  // Helper function to manually refetch insights
  const refetch = async () => {
    if (!firebaseUser?.uid) return;

    try {
      setLoading(true);
      setError(null);
      const freshInsights = await FirestoreService.getUserInsights(firebaseUser.uid);
      setInsights(freshInsights);
    } catch (err) {
      console.error('Error refetching insights:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch insights');
    } finally {
      setLoading(false);
    }
  };

  return {
    insights,
    loading,
    error,
    refetch,
    hasInsights: insights !== null
  };
};