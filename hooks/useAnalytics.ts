import { useCallback, useEffect } from 'react';
import { usePostHog } from 'posthog-react-native';
import { useUser } from '@clerk/clerk-expo';

// Global state to track if user has been identified
let identifiedUserId: string | null = null;

export function useAnalytics() {
  const posthog = usePostHog();
  const { user } = useUser();

  // Identify user only once per user session
  useEffect(() => {
    if (user && posthog && user.id !== identifiedUserId) {
      console.log('🔑 [POSTHOG] Identifying user (one-time):', user.id);
      posthog.identify(user.id, {
        email: user.emailAddresses[0]?.emailAddress,
        name: user.fullName,
      });
      identifiedUserId = user.id; // Mark as identified
    } else if (!user && identifiedUserId) {
      // User logged out, clear identify state
      console.log('🚪 [POSTHOG] User logged out, clearing identify state');
      identifiedUserId = null;
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
  }, []);

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
  }, []);

  const trackSignOut = useCallback(() => {
    console.log('🚪 [POSTHOG] User signing out, clearing identify state');
    posthog?.capture('user_signed_out', {
      timestamp: new Date().toISOString(),
    });
    // Clear identified user state so next user gets identified
    identifiedUserId = null;
  }, []);

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
  }, []);

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
  }, []);

  const trackAppOpenedFromCoachingMessage = useCallback((properties?: {
    message_id?: string;
    message_type?: string;
  }) => {
    posthog?.capture('app_opened_from_coaching_message', {
      timestamp: new Date().toISOString(),
      ...(properties?.message_id && { message_id: properties.message_id }),
      ...(properties?.message_type && { message_type: properties.message_type }),
    });
  }, []);

  // Journal Actions
  const trackEntryCreated = useCallback((properties?: {
    entry_id?: string;
  }) => {
    console.log('📊 [POSTHOG] Tracking entry_created:', properties);
    posthog?.capture('entry_created', {
      timestamp: new Date().toISOString(),
      ...(properties?.entry_id && { entry_id: properties.entry_id }),
    });
  }, []);

  const trackEntryUpdated = useCallback((properties?: {
    entry_id?: string;
    content_length?: number;
    edit_duration?: number;
  }) => {
    // No debounce here since saveEntry already handles debouncing
    console.log('📊 [POSTHOG] Tracking entry_updated:', properties);
    posthog?.capture('entry_updated', {
      timestamp: new Date().toISOString(),
      ...(properties?.entry_id && { entry_id: properties.entry_id }),
      content_length: properties?.content_length || 0,
      ...(properties?.edit_duration && { edit_duration: properties.edit_duration }),
    });
  }, []);

  const trackEntryDeleted = useCallback((properties?: {
    entry_id?: string;
    content_length?: number;
    entry_age_days?: number;
  }) => {
    posthog?.capture('entry_deleted', {
      timestamp: new Date().toISOString(),
      ...(properties?.entry_id && { entry_id: properties.entry_id }),
      content_length: properties?.content_length || 0,
      ...(properties?.entry_age_days && { entry_age_days: properties.entry_age_days }),
    });
  }, []);

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
  }, []);

  const trackAlignmentSet = useCallback((properties?: {
    alignmentLength?: number;
    isUpdate?: boolean;
  }) => {
    posthog?.capture('alignment_set', {
      timestamp: new Date().toISOString(),
      alignment_length: properties?.alignmentLength || 0,
      is_update: properties?.isUpdate || false,
    });
  }, []);

  // Enhanced Analytics for Professional Dashboards
  
  // Meaningful Action Tracking for DAU/WAU
  const trackMeaningfulAction = useCallback((properties: {
    action_type: 'journal_entry' | 'coaching_session';
    session_id?: string;
    duration?: number;
    content_length?: number;
  }) => {
    const logInfo = properties.action_type === 'coaching_session' 
      ? `${properties.action_type} (${properties.duration}s)`
      : `${properties.action_type} (${properties.content_length} chars)`;
    console.log('📊 [POSTHOG] Meaningful action tracked:', logInfo);
    posthog?.capture('meaningful_action', {
      timestamp: new Date().toISOString(),
      action_type: properties.action_type,
      ...(properties.session_id && { session_id: properties.session_id }),
      ...(properties.duration && { duration: properties.duration }),
      ...(properties.content_length && { content_length: properties.content_length }),
    });
  }, []);

  // Enhanced Onboarding Funnel Tracking
  const trackOnboardingStep = useCallback((properties: {
    step_name: 'name_entered' | 'roles_selected' | 'self_reflection_selected' | 'clarity_level_set' | 'stress_level_set' | 'motivation_viewed' | 'research_viewed' | 'figures_viewed' | 'ready_confirmed' | 'coaching_style_configured' | 'time_duration_set' | 'configuration_loading' | 'meditation_intro_viewed' | 'meditation_prepared' | 'meditation_started' | 'initial_life_deep_dive_started' | 'life_compass_viewed';
    step_number: number;
    user_input?: any;
    time_spent?: number;
  }) => {
    // Use specific event names for each onboarding step for cleaner PostHog analytics
    const eventName = `onboarding_${properties.step_name}`;
    
    console.log('📊 [POSTHOG] Onboarding step:', eventName);
    posthog?.capture(eventName, {
      timestamp: new Date().toISOString(),
      step_number: properties.step_number,
      ...(properties.user_input && { user_input: JSON.stringify(properties.user_input) }),
      ...(properties.time_spent && { time_spent: properties.time_spent }),
    });
  }, []);

  const trackOnboardingDropoff = useCallback((properties: {
    step_name: string;
    step_number: number;
    time_spent?: number;
  }) => {
    posthog?.capture('onboarding_dropoff', {
      timestamp: new Date().toISOString(),
      step_name: properties.step_name,
      step_number: properties.step_number,
      ...(properties.time_spent && { time_spent: properties.time_spent }),
    });
  }, []);

  // Coaching Session Tracking
  const trackCoachingSessionStarted = useCallback((properties?: {
    session_id?: string;
    session_type?: 'initial_life_deep_dive' | 'regular';
    trigger?: 'manual' | 'notification' | 'scheduled';
  }) => {
    // Use different event names based on session type for better analytics clarity
    const eventName = properties?.session_type === 'initial_life_deep_dive' 
      ? 'initial_coaching_session_started' 
      : 'coaching_session_started';
      
    console.log(`📊 [POSTHOG] Tracking ${eventName}:`, properties);
    posthog?.capture(eventName, {
      timestamp: new Date().toISOString(),
      ...(properties?.session_id && { session_id: properties.session_id }),
      session_type: properties?.session_type || 'regular',
      trigger: properties?.trigger || 'manual',
    });
  }, []);

  const trackCoachingSessionCompleted = useCallback((properties?: {
    session_id?: string;
    duration_minutes?: number;
    message_count?: number;
    words_written?: number;
    insights_generated?: number;
    session_type?: 'initial_life_deep_dive' | 'regular';
  }) => {
    // Use different event names based on session type for better analytics clarity
    const eventName = properties?.session_type === 'initial_life_deep_dive' 
      ? 'initial_coaching_session_completed' 
      : 'coaching_session_completed';
      
    console.log(`📊 [POSTHOG] Tracking ${eventName}:`, properties);
    posthog?.capture(eventName, {
      timestamp: new Date().toISOString(),
      ...(properties?.session_id && { session_id: properties.session_id }),
      ...(properties?.duration_minutes && { duration_minutes: properties.duration_minutes }),
      ...(properties?.message_count && { message_count: properties.message_count }),
      ...(properties?.words_written && { words_written: properties.words_written }),
      ...(properties?.insights_generated && { insights_generated: properties.insights_generated }),
      session_type: properties?.session_type || 'regular',
    });
  }, []);

  // Notification Permission Tracking
  const trackNotificationPermissionRequested = useCallback(() => {
    console.log('📊 [POSTHOG] Tracking notification_permission_requested');
    posthog?.capture('notification_permission_requested', {
      timestamp: new Date().toISOString(),
    });
  }, []);

  const trackNotificationPermissionGranted = useCallback((properties?: {
    granted_via?: 'onboarding' | 'settings' | 'prompt';
  }) => {
    console.log('📊 [POSTHOG] Tracking notification_permission_granted:', properties);
    posthog?.capture('notification_permission_granted', {
      timestamp: new Date().toISOString(),
      granted_via: properties?.granted_via || 'unknown',
    });
  }, []);

  const trackNotificationPermissionDenied = useCallback((properties?: {
    denied_via?: 'onboarding' | 'settings' | 'prompt';
  }) => {
    console.log('📊 [POSTHOG] Tracking notification_permission_denied:', properties);
    posthog?.capture('notification_permission_denied', {
      timestamp: new Date().toISOString(),
      denied_via: properties?.denied_via || 'unknown',
    });
  }, []);

  const trackCoachingMessagesOptIn = useCallback((properties?: {
    opted_in: boolean;
    frequency?: 'daily' | 'weekly';
    context?: 'onboarding' | 'settings';
  }) => {
    console.log('📊 [POSTHOG] Tracking coaching_messages_opt_in:', properties);
    posthog?.capture('coaching_messages_opt_in', {
      timestamp: new Date().toISOString(),
      opted_in: properties?.opted_in || false,
      ...(properties?.frequency && { frequency: properties.frequency }),
      context: properties?.context || 'unknown',
    });
  }, []);

  // Life Compass Tracking
  const trackLifeCompassViewed = useCallback((properties?: {
    viewed_via?: 'onboarding' | 'home_popup' | 'navigation';
    compass_data?: any;
  }) => {
    console.log('📊 [POSTHOG] Tracking life_compass_viewed:', properties);
    posthog?.capture('life_compass_viewed', {
      timestamp: new Date().toISOString(),
      viewed_via: properties?.viewed_via || 'unknown',
      ...(properties?.compass_data && { compass_data: JSON.stringify(properties.compass_data) }),
    });
  }, []);

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

    // Coaching (aligned with web)
    trackCoachingCompletion,
    trackAlignmentSet,

    // Enhanced Analytics for Professional Dashboards
    trackMeaningfulAction,
    trackOnboardingStep,
    trackOnboardingDropoff,
    trackCoachingSessionStarted,
    trackCoachingSessionCompleted,
    trackNotificationPermissionRequested,
    trackNotificationPermissionGranted,
    trackNotificationPermissionDenied,
    trackCoachingMessagesOptIn,
    trackLifeCompassViewed,
  };
}; 