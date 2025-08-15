import { useCallback, useRef, useEffect } from 'react';
import { usePostHog } from 'posthog-react-native';
import { useUser } from '@clerk/clerk-expo';

export function useAnalytics() {
  const posthog = usePostHog();
  const { user } = useUser();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Identify user if authenticated - only when user or posthog changes
  useEffect(() => {
    if (user && posthog) {
      posthog.identify(user.id, {
        email: user.emailAddresses[0]?.emailAddress,
        name: user.fullName,
      });
    }
  }, [user, posthog]);

  // Core Authentication Events
  const trackSignUp = useCallback((properties?: {
    method?: string;
    hasExistingData?: boolean;
    anonymousEntryCount?: number;
  }) => {
    posthog?.capture('user_signed_up', {
      timestamp: new Date().toISOString(),
      method: properties?.method || 'clerk',
      has_existing_data: properties?.hasExistingData || false,
      anonymous_entry_count: properties?.anonymousEntryCount || 0,
    });
  }, [posthog]);

  const trackSignIn = useCallback((properties?: {
    method?: string;
    hasExistingData?: boolean;
    anonymousEntryCount?: number;
  }) => {
    posthog?.capture('user_signed_in', {
      timestamp: new Date().toISOString(),
      method: properties?.method || 'clerk',
      has_existing_data: properties?.hasExistingData || false,
      anonymous_entry_count: properties?.anonymousEntryCount || 0,
    });
  }, [posthog]);

  const trackSignOut = useCallback(() => {
    posthog?.capture('user_signed_out', {
      timestamp: new Date().toISOString(),
    });
  }, [posthog]);

  // Onboarding Events
  const trackOnboardingCompleted = useCallback((properties?: {
    onboarding_duration?: number;
    steps_completed?: number;
    user_responses?: number;
  }) => {
    posthog?.capture('onboarding_completed', {
      timestamp: new Date().toISOString(),
      ...(properties?.onboarding_duration && { onboarding_duration: properties.onboarding_duration }),
      steps_completed: properties?.steps_completed || 0,
      user_responses: properties?.user_responses || 0,
    });
  }, [posthog]);

  // App Lifecycle Events
  const trackAppOpened = useCallback((properties?: {
    source?: string;
    previous_screen?: string;
  }) => {
    posthog?.capture('app_opened', {
      timestamp: new Date().toISOString(),
      source: properties?.source || 'app_launch',
      ...(properties?.previous_screen && { previous_screen: properties.previous_screen }),
    });
  }, [posthog]);

  const trackAppOpenedFromCoachingMessage = useCallback((properties?: {
    message_id?: string;
    message_type?: string;
  }) => {
    posthog?.capture('app_opened_from_coaching_message', {
      timestamp: new Date().toISOString(),
      ...(properties?.message_id && { message_id: properties.message_id }),
      ...(properties?.message_type && { message_type: properties.message_type }),
    });
  }, [posthog]);

  // Journal Actions
  const trackEntryCreated = useCallback((properties?: {
    entry_id?: string;
  }) => {
    posthog?.capture('journal_entry_created', {
      timestamp: new Date().toISOString(),
      ...(properties?.entry_id && { entry_id: properties.entry_id }),
    });
  }, [posthog]);

  const trackEntryUpdated = useCallback((properties?: {
    entry_id?: string;
    content_length?: number;
    edit_duration?: number;
  }) => {
    // Debounce content updates to avoid excessive events
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      posthog?.capture('journal_entry_updated', {
        timestamp: new Date().toISOString(),
        ...(properties?.entry_id && { entry_id: properties.entry_id }),
        content_length: properties?.content_length || 0,
        ...(properties?.edit_duration && { edit_duration: properties.edit_duration }),
      });
    }, 500); // 500ms debounce
  }, [posthog]);

  const trackEntryDeleted = useCallback((properties?: {
    entry_id?: string;
    content_length?: number;
    entry_age_days?: number;
  }) => {
    posthog?.capture('journal_entry_deleted', {
      timestamp: new Date().toISOString(),
      ...(properties?.entry_id && { entry_id: properties.entry_id }),
      content_length: properties?.content_length || 0,
      ...(properties?.entry_age_days && { entry_age_days: properties.entry_age_days }),
    });
  }, [posthog]);

  // Additional tracking functions from the original pattern
  const trackCoachingCompletion = useCallback((properties?: {
    modelId?: string;
    variant?: string;
    entryId?: string;
    contentLength?: number;
    hasOptions?: boolean;
    optionCount?: number;
  }) => {
    posthog?.capture('coaching_completion', {
      timestamp: new Date().toISOString(),
      model_id: properties?.modelId || 'unknown',
      variant: properties?.variant || 'text',
      ...(properties?.entryId && { entry_id: properties.entryId }),
      content_length: properties?.contentLength || 0,
      has_options: properties?.hasOptions || false,
      option_count: properties?.optionCount || 0,
    });
  }, [posthog]);

  const trackAlignmentSet = useCallback((properties?: {
    alignmentLength?: number;
    isUpdate?: boolean;
  }) => {
    posthog?.capture('alignment_set', {
      timestamp: new Date().toISOString(),
      alignment_length: properties?.alignmentLength || 0,
      is_update: properties?.isUpdate || false,
    });
  }, [posthog]);

  return {
    // Core Authentication
    trackSignUp,
    trackSignIn,
    trackSignOut,

    // Onboarding
    trackOnboardingCompleted,

    // App Lifecycle
    trackAppOpened,
    trackAppOpenedFromCoachingMessage,

    // Journal Actions
    trackEntryCreated,
    trackEntryUpdated,
    trackEntryDeleted,

    // Additional Features
    trackCoachingCompletion,
    trackAlignmentSet,
  };
}; 