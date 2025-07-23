import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { CoachingInteractionRequest, CoachingInteractionResponse } from '@/types/coaching';
import aiCoachingService from '@/services/aiCoachingService';

interface UseAICoachingReturn {
  isLoading: boolean;
  error: string | null;
  generateCoachingResponse: (request: CoachingInteractionRequest) => Promise<CoachingInteractionResponse>;
  clearError: () => void;
}

export function useAICoaching(): UseAICoachingReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateCoachingResponse = useCallback(async (request: CoachingInteractionRequest): Promise<CoachingInteractionResponse> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await aiCoachingService.generateCoachingResponse(request);
      
      if (!response.success) {
        const errorMessage = response.error || 'Failed to generate coaching response';
        setError(errorMessage);
        
        // Show user-friendly error alert
        Alert.alert(
          'AI Coaching Error',
          errorMessage,
          [{ text: 'OK' }]
        );
      }
      
      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      setError(errorMessage);
      
      console.error('AI Coaching hook error:', error);
      
      Alert.alert(
        'AI Coaching Error',
        'There was an error connecting to the AI service. Please try again.',
        [{ text: 'OK' }]
      );
      
      return {
        success: false,
        error: errorMessage
      };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    isLoading,
    error,
    generateCoachingResponse,
    clearError
  };
}

export default useAICoaching; 