import { useCallback, useEffect } from 'react';
import { usePostHog } from 'posthog-react-native';
import { useUser } from '@clerk/clerk-expo';

// Global state to track if user has been identified
let identifiedUserId: string | null = null;

// Global deduplication cache for analytics events (session-based)
const sessionEventCache = new Set<string>();

// Helper function to generate unique event key
const generateEventKey = (eventName: string, userId?: string, additionalId?: string): string => {
  return `${eventName}_${userId || 'anonymous'}_${additionalId || 'default'}`;
};

// Helper function to check if event should be tracked (deduplication)
const shouldTrackEvent = (eventName: string, userId?: string, additionalId?: string): boolean => {
  const eventKey = generateEventKey(eventName, userId, additionalId);
  if (sessionEventCache.has(eventKey)) {
    console.log(`🚫 [POSTHOG] Skipping duplicate event: ${eventName} for user: ${userId}`);
    return false;
  }
  sessionEventCache.add(eventKey);
  return true;
};

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
    userEmail?: string;
    userName?: string;
    userId?: string;
    isNewUser?: boolean;
    accountCreatedAt?: string;
    signUpDuration?: number;
  }) => {
    console.log('🎉 [POSTHOG] Tracking user_signed_up:', {
      userId: properties?.userId,
      method: properties?.method,
      isNewUser: properties?.isNewUser,
      userEmail: properties?.userEmail,
      userName: properties?.userName,
      hasExistingData: properties?.hasExistingData,
      signUpDuration: properties?.signUpDuration
    });
    
    posthog?.capture('user_signed_up', {
      timestamp: new Date().toISOString(),
      method: properties?.method || 'clerk',
      has_existing_data: properties?.hasExistingData || false,
      anonymous_entry_count: properties?.anonymousEntryCount || 0,
      user_email: properties?.userEmail,
      user_name: properties?.userName,
      user_id: properties?.userId,
      is_new_user: properties?.isNewUser || true,
      account_created_at: properties?.accountCreatedAt,
      sign_up_duration_seconds: properties?.signUpDuration,
      platform: 'mobile',
      app_version: '1.0.0' // TODO: Get from package.json
    });
  }, [posthog]);

  const trackSignIn = useCallback((properties?: {
    method?: string;
    hasExistingData?: boolean;
    anonymousEntryCount?: number;
    userEmail?: string;
    userName?: string;
    userId?: string;
    isNewUser?: boolean;
    signInDuration?: number;
  }) => {
    console.log('🔐 [POSTHOG] Tracking user_signed_in:', {
      userId: properties?.userId,
      method: properties?.method,
      isNewUser: properties?.isNewUser,
      userEmail: properties?.userEmail,
      userName: properties?.userName,
      hasExistingData: properties?.hasExistingData,
      signInDuration: properties?.signInDuration
    });
    
    posthog?.capture('user_signed_in', {
      timestamp: new Date().toISOString(),
      method: properties?.method || 'clerk',
      has_existing_data: properties?.hasExistingData || false,
      anonymous_entry_count: properties?.anonymousEntryCount || 0,
      user_email: properties?.userEmail,
      user_name: properties?.userName,
      user_id: properties?.userId,
      is_new_user: properties?.isNewUser || false,
      sign_in_duration_seconds: properties?.signInDuration,
      platform: 'mobile',
      app_version: '1.0.0'
    });
  }, [posthog]);

  const trackSignOut = useCallback(() => {
    console.log('🚪 [POSTHOG] User signing out, clearing identify state');
    posthog?.capture('user_signed_out', {
      timestamp: new Date().toISOString(),
    });
    // Clear identified user state so next user gets identified
    identifiedUserId = null;
  }, [posthog]);

  // Onboarding Events
  // Note: trackOnboardingCompleted is defined later in the file for session end completion

  const trackFirstTimeAppOpened = useCallback((properties?: {
    userId?: string;
    userName?: string;
    userEmail?: string;
    method?: string;
    accountCreatedAt?: string;
  }) => {
    console.log('🌟 [POSTHOG] Tracking first_time_app_opened:', {
      userId: properties?.userId,
      userName: properties?.userName,
      method: properties?.method
    });
    
    posthog?.capture('first_time_app_opened', {
      timestamp: new Date().toISOString(),
      user_id: properties?.userId,
      user_name: properties?.userName,
      user_email: properties?.userEmail,
      sign_up_method: properties?.method,
      account_created_at: properties?.accountCreatedAt,
      platform: 'mobile',
      app_version: '1.0.0'
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
    console.log('📊 [POSTHOG] Tracking entry_created:', properties);
    posthog?.capture('entry_created', {
      timestamp: new Date().toISOString(),
      ...(properties?.entry_id && { entry_id: properties.entry_id }),
    });
  }, [posthog]);

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
  }, [posthog]);

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
  }, [posthog]);

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
  }, [posthog]);

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
  }, [posthog]);

  // Coaching Message Tracking - Single session approach
  const trackCoachingMessageSent = useCallback((properties?: {
    user_id?: string;
    message_length?: number;
    input_method?: 'text' | 'voice';
    message_type?: 'user' | 'retry';
    daily_message_count?: number;
    session_context?: string;
  }) => {
    console.log('📊 [POSTHOG] Tracking coaching_message_sent:', {
      userId: properties?.user_id,
      messageLength: properties?.message_length,
      inputMethod: properties?.input_method,
      messageType: properties?.message_type,
      dailyCount: properties?.daily_message_count
    });
    
    posthog?.capture('coaching_message_sent', {
      timestamp: new Date().toISOString(),
      user_id: properties?.user_id,
      message_length: properties?.message_length || 0,
      input_method: properties?.input_method || 'text',
      message_type: properties?.message_type || 'user',
      daily_message_count: properties?.daily_message_count || 1,
      session_context: properties?.session_context || 'single_session',
      platform: 'mobile',
      app_version: '1.0.0'
    });
  }, [posthog]);

  // Commitment Tracking - Track when users create commitments
  const trackCommitmentCreated = useCallback((properties?: {
    user_id?: string;
    commitment_type?: 'one-time' | 'recurring';
    deadline?: string;
    cadence?: string;
    title_length?: number;
    description_length?: number;
    coaching_session_id?: string;
    source?: 'coaching_card' | 'manual' | 'api';
  }) => {
    console.log('📊 [POSTHOG] Tracking commitment_created:', {
      userId: properties?.user_id,
      type: properties?.commitment_type,
      deadline: properties?.deadline,
      cadence: properties?.cadence,
      titleLength: properties?.title_length,
      source: properties?.source
    });
    
    posthog?.capture('commitment_created', {
      timestamp: new Date().toISOString(),
      ...(properties?.user_id && { user_id: properties.user_id }),
      ...(properties?.commitment_type && { commitment_type: properties.commitment_type }),
      ...(properties?.deadline && { deadline: properties.deadline }),
      ...(properties?.cadence && { cadence: properties.cadence }),
      title_length: properties?.title_length || 0,
      description_length: properties?.description_length || 0,
      ...(properties?.coaching_session_id && { coaching_session_id: properties.coaching_session_id }),
      source: properties?.source || 'coaching_card',
      platform: 'mobile',
      app_version: '1.0.0'
    });
  }, [posthog]);

  // Scheduled Session Tracking - Track when users schedule and use sessions
  const trackScheduledSessionAccepted = useCallback((properties?: {
    user_id?: string;
    session_title?: string;
    session_reason?: string;
    duration_minutes?: number;
    scheduled_date?: string;
    scheduled_time?: string;
    coaching_session_id?: string;
    source?: 'session_suggestion' | 'manual';
  }) => {
    console.log('📊 [POSTHOG] Tracking scheduled_session_accepted:', {
      userId: properties?.user_id,
      title: properties?.session_title,
      duration: properties?.duration_minutes,
      scheduledDate: properties?.scheduled_date,
      source: properties?.source
    });
    
    posthog?.capture('scheduled_session_accepted', {
      timestamp: new Date().toISOString(),
      ...(properties?.user_id && { user_id: properties.user_id }),
      ...(properties?.session_title && { session_title: properties.session_title }),
      ...(properties?.session_reason && { session_reason: properties.session_reason }),
      ...(properties?.duration_minutes && { duration_minutes: properties.duration_minutes }),
      ...(properties?.scheduled_date && { scheduled_date: properties.scheduled_date }),
      ...(properties?.scheduled_time && { scheduled_time: properties.scheduled_time }),
      ...(properties?.coaching_session_id && { coaching_session_id: properties.coaching_session_id }),
      source: properties?.source || 'session_suggestion',
      platform: 'mobile',
      app_version: '1.0.0'
    });
  }, [posthog]);

  const trackScheduledSessionUsed = useCallback((properties?: {
    user_id?: string;
    session_title?: string;
    session_goal?: string;
    duration_minutes?: number;
    scheduled_session_id?: string;
    coaching_session_id?: string;
    breakout_session_id?: string;
    source?: 'scheduled_card' | 'manual';
  }) => {
    console.log('📊 [POSTHOG] Tracking scheduled_session_used:', {
      userId: properties?.user_id,
      title: properties?.session_title,
      duration: properties?.duration_minutes,
      scheduledSessionId: properties?.scheduled_session_id,
      source: properties?.source
    });
    
    posthog?.capture('scheduled_session_used', {
      timestamp: new Date().toISOString(),
      ...(properties?.user_id && { user_id: properties.user_id }),
      ...(properties?.session_title && { session_title: properties.session_title }),
      ...(properties?.session_goal && { session_goal: properties.session_goal }),
      ...(properties?.duration_minutes && { duration_minutes: properties.duration_minutes }),
      ...(properties?.scheduled_session_id && { scheduled_session_id: properties.scheduled_session_id }),
      ...(properties?.coaching_session_id && { coaching_session_id: properties.coaching_session_id }),
      ...(properties?.breakout_session_id && { breakout_session_id: properties.breakout_session_id }),
      source: properties?.source || 'scheduled_card',
      platform: 'mobile',
      app_version: '1.0.0'
    });
  }, [posthog]);

  // Onboarding Completion Tracking - Track when users complete onboarding via sessionEnd
  const trackOnboardingCompleted = useCallback((properties?: {
    user_id?: string;
    session_duration_minutes?: number;
    message_count?: number;
    insights_generated?: number;
    completion_method?: 'session_end_card' | 'manual' | 'timeout';
    onboarding_session_id?: string;
  }) => {
    console.log('📊 [POSTHOG] Tracking onboarding_completed:', {
      userId: properties?.user_id,
      duration: properties?.session_duration_minutes,
      messageCount: properties?.message_count,
      insights: properties?.insights_generated,
      method: properties?.completion_method
    });
    
    posthog?.capture('onboarding_completed', {
      timestamp: new Date().toISOString(),
      ...(properties?.user_id && { user_id: properties.user_id }),
      ...(properties?.session_duration_minutes && { session_duration_minutes: properties.session_duration_minutes }),
      ...(properties?.message_count && { message_count: properties.message_count }),
      ...(properties?.insights_generated && { insights_generated: properties.insights_generated }),
      completion_method: properties?.completion_method || 'session_end_card',
      ...(properties?.onboarding_session_id && { onboarding_session_id: properties.onboarding_session_id }),
      platform: 'mobile',
      app_version: '1.0.0'
    });
  }, [posthog]);

  // Notification Permission Tracking
  const trackNotificationPermissionRequested = useCallback(() => {
    console.log('📊 [POSTHOG] Tracking notification_permission_requested');
    posthog?.capture('notification_permission_requested', {
      timestamp: new Date().toISOString(),
    });
  }, [posthog]);

  const trackNotificationPermissionGranted = useCallback((properties?: {
    granted_via?: 'onboarding' | 'settings' | 'prompt';
  }) => {
    console.log('📊 [POSTHOG] Tracking notification_permission_granted:', properties);
    posthog?.capture('notification_permission_granted', {
      timestamp: new Date().toISOString(),
      granted_via: properties?.granted_via || 'unknown',
    });
  }, [posthog]);

  const trackNotificationPermissionDenied = useCallback((properties?: {
    denied_via?: 'onboarding' | 'settings' | 'prompt';
  }) => {
    console.log('📊 [POSTHOG] Tracking notification_permission_denied:', properties);
    posthog?.capture('notification_permission_denied', {
      timestamp: new Date().toISOString(),
      denied_via: properties?.denied_via || 'unknown',
    });
  }, [posthog]);

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
  }, [posthog]);

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
  }, [posthog]);

  return {
    // Core Authentication
    trackSignUp,
    trackSignIn,
    trackSignOut,

    // Onboarding
    trackFirstTimeAppOpened,

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
    trackCoachingMessageSent,
    trackCommitmentCreated,
    trackScheduledSessionAccepted,
    trackScheduledSessionUsed,
    trackOnboardingCompleted,
    trackNotificationPermissionRequested,
    trackNotificationPermissionGranted,
    trackNotificationPermissionDenied,
    trackCoachingMessagesOptIn,
    trackLifeCompassViewed,
  };
}; 