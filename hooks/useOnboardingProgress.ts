import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface OnboardingProgress {
  currentStep: number;
  name: string;
  selectedRoles: string[];
  selectedSelfReflection: string[];
  clarityLevel: number;
  stressLevel: number;
  hasInteractedWithClaritySlider: boolean;
  hasInteractedWithStressSlider: boolean;
  coachingStylePosition: { x: number; y: number };
  hasInteractedWithCoachingStyle: boolean;
  timeDuration: number;
  completedAt?: string;
}

const ONBOARDING_PROGRESS_KEY = '@onboarding_progress';

export const useOnboardingProgress = () => {
  const [progress, setProgress] = useState<OnboardingProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load progress from AsyncStorage on mount
  useEffect(() => {
    loadProgress();
  }, []);

  const loadProgress = async () => {
    try {
      const stored = await AsyncStorage.getItem(ONBOARDING_PROGRESS_KEY);
      if (stored) {
        const parsedProgress = JSON.parse(stored) as OnboardingProgress;
        setProgress(parsedProgress);
        console.log('📱 Loaded onboarding progress:', parsedProgress);
      }
    } catch (error) {
      console.error('❌ Error loading onboarding progress:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveProgress = async (newProgress: Partial<OnboardingProgress>) => {
    try {
      const updatedProgress = progress ? { ...progress, ...newProgress } : newProgress as OnboardingProgress;
      await AsyncStorage.setItem(ONBOARDING_PROGRESS_KEY, JSON.stringify(updatedProgress));
      setProgress(updatedProgress);
      console.log('💾 Saved onboarding progress:', updatedProgress);
    } catch (error) {
      console.error('❌ Error saving onboarding progress:', error);
    }
  };

  const clearProgress = async () => {
    try {
      await AsyncStorage.removeItem(ONBOARDING_PROGRESS_KEY);
      setProgress(null);
      console.log('🗑️ Cleared onboarding progress');
    } catch (error) {
      console.error('❌ Error clearing onboarding progress:', error);
    }
  };

  const completeOnboarding = async () => {
    try {
      const completedProgress = {
        ...progress,
        completedAt: new Date().toISOString(),
      } as OnboardingProgress;
      
      await AsyncStorage.setItem(ONBOARDING_PROGRESS_KEY, JSON.stringify(completedProgress));
      setProgress(completedProgress);
      console.log('✅ Onboarding completed and saved');
    } catch (error) {
      console.error('❌ Error completing onboarding:', error);
    }
  };

  const getInitialStep = (): number => {
    if (!progress) return 1;
    if (progress.completedAt) return 1; // If completed, start fresh
    return progress.currentStep || 1;
  };

  const shouldResumeOnboarding = (): boolean => {
    return progress !== null && !progress.completedAt && progress.currentStep > 1;
  };

  const canNavigateToChat = (): boolean => {
    if (!progress) return false;
    
    // If already in OnboardingChat (step 17), can navigate to chat
    if (progress.currentStep === 17) return true;
    
    // If onboarding is marked as completed, can navigate to chat
    if (progress.completedAt) return true;
    
    // Otherwise, user is still in onboarding process - should not navigate to chat
    return false;
  };

  return {
    progress,
    isLoading,
    saveProgress,
    clearProgress,
    completeOnboarding,
    getInitialStep,
    shouldResumeOnboarding,
    canNavigateToChat,
  };
};