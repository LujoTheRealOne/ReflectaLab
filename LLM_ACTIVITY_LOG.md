# LLM Activity Log - ReflectaLab

This file records all important changes and implementations made by the LLM assistant.


*This log file should be updated after every significant LLM implementation.*

## 2025-08-25

- **Fixed Logout White Screen Issue**: Resolved critical UX problem where users saw white screen during logout:
  * **Enhanced Auth State Management**: 
    - Added `isSigningOut` state to track logout process and prevent auth state confusion
    - Improved `isAuthReady` logic to remain stable during logout transitions
    - Added proper timing control with 500ms delay to allow smooth navigation completion
  * **Navigation Loading Enhancement**: 
    - Updated Navigation component to show splash screen during logout process
    - Prevented white screen flash by maintaining loading state throughout sign out
    - Added debug logging for `isSigningOut` state for better monitoring
  * **Firebase Auth State Cleanup**: 
    - Preserved `isSigningOut` state during Firebase auth cleanup to maintain stability
    - Enhanced comment documentation for timeout management strategy
  * **Result**: Logout now provides smooth transition with proper loading state, eliminating jarring white screen experience

- **Fixed Logout Navigation & Auth Token Errors**: Resolved persistent navigation issues and API errors during logout:
  * **HomeContent Auth Guards**: 
    - Added authentication checks to `fetchCoachingSession` to prevent API calls when `firebaseUser` is null
    - Enhanced dependency arrays to include `firebaseUser` for proper cleanup during logout
    - Added early return logic with descriptive logging for auth state validation
  * **Navigation Flow Optimization**: 
    - Force auth flow during sign out by including `isSigningOut` in `shouldShowAuthFlow` logic
    - Enhanced navigation key to include logout state for immediate navigation reset
    - Improved logout transition timing from 500ms to 200ms for faster UX
  * **Auth State Cleanup Enhancement**: 
    - Added comprehensive logging for auth state reset completion
    - Immediate state cleanup in Firebase auth change handler when user signs out
    - Faster isSigningOut reset with improved timeout management
  * **Result**: Eliminated "Error fetching coaching session: No auth token" errors and ensured immediate navigation to auth flow during logout

- **Fixed Critical Logout Race Condition**: Resolved persistent auto re-sign-in issue that was causing infinite logout loops:
  * **Enhanced Timing Control**: 
    - Removed premature timeout-based `isSigningOut` reset (200ms) that was causing race conditions
    - Reset `isSigningOut` only when Firebase auth state actually changes to null (proper lifecycle management)
    - Added comprehensive logging for sign out completion and auth state transitions
  * **Multi-Layer Auto Sign-In Guards**: 
    - Added `isSigningOut` guard to prevent auto sign-in during logout process
    - Added `isFirebaseReady` check to ensure Firebase is ready before attempting auto sign-in
    - Implemented 2-second cooldown period after sign out using `lastSignOutTimeRef` timestamp
    - Added detailed logging for each guard condition with remaining cooldown time
  * **Robust State Management**: 
    - Track sign out timestamp in `lastSignOutTimeRef` to prevent immediate re-authentication
    - Enhanced dependency arrays to include `isSigningOut` in auto sign-in and user loading effects
    - Comprehensive cleanup of all auth-related state when Firebase user becomes null
  * **Result**: Eliminated race condition where logout would complete but immediately trigger auto sign-in, causing white screen and auth loops

- **Enhanced PostHog Analytics for New User Tracking**: Implemented comprehensive user tracking system with intelligent new user detection:
  * **Enhanced Analytics Functions**: 
    - Enhanced `trackSignUp` with detailed user properties (email, name, method, account creation time, duration)
    - Enhanced `trackSignIn` with user identification and returning user detection
    - Enhanced `trackOnboardingCompleted` with onboarding data, user responses, and completion analytics
    - Added `trackFirstTimeAppOpened` for new user funnel analysis and first-session tracking
  * **Intelligent New User Detection**: 
    - Implemented smart detection based on account creation time (within 60 seconds) and onboarding status
    - Automatic differentiation between new sign-ups and returning user sign-ins
    - Fallback account creation tracking for edge cases and error scenarios
  * **Comprehensive Logging System**: 
    - Added detailed console logging for all PostHog events with user identification
    - Enhanced debug logging for sign-up vs sign-in detection with timing analysis
    - Structured logging with user properties, methods, and duration tracking
  * **Enhanced OAuth Flow Tracking**: 
    - Added step-by-step logging for Google and Apple OAuth flows
    - Enhanced error tracking and user journey analytics
    - Improved sign-in duration tracking and method detection
  * **Result**: Complete PostHog analytics pipeline for user acquisition, onboarding funnel analysis, and retention tracking with production-ready event structure

- **Fixed Onboarding Consistency System**: Resolved critical issue where OnboardingChatScreen (life deep dive) wouldn't resume properly after app restart:
  * **Enhanced Navigation Priority Logic**: 
    - Implemented 3-tier priority system in AuthNavigator: step 17 resume > saved progress > fresh start
    - Added priority override for OnboardingChat (step 17) to ALWAYS resume regardless of Firestore state
    - Enhanced getInitialRouteName with detailed logging and step-by-step decision tracking
  * **Fixed Timing and State Conflicts**: 
    - Added progressLoading dependency to root Navigation component to wait for AsyncStorage before routing
    - Enhanced navigation route determination to respect AsyncStorage progress over Firestore user account state
    - Added hasOnboardingChatProgress check to force auth flow when user has step 17 progress
  * **Enhanced Progress Persistence**: 
    - Added immediate progress saving on OnboardingChatScreen mount with detailed parameter logging
    - Implemented unmount progress saving to catch user navigation away from screen
    - Enhanced progress tracking with comprehensive console logging for debugging
  * **Added AppNavigator Safeguard**: 
    - Implemented safety mechanism to redirect users back to auth flow if they reach main app with OnboardingChat progress
    - Added CommonActions.reset navigation to ensure proper flow redirection
    - Comprehensive logging for safeguard activation and user flow tracking
  * **Enhanced Debug Logging System**: 
    - Added detailed logging for shouldResumeOnboarding and canNavigateToChat decisions
    - Enhanced AuthNavigator debug logs with full progress state and routing decisions
    - Added comprehensive logging for progress loading, saving, and navigation state changes
  * **Result**: Bulletproof onboarding consistency system that ensures users always resume from their exact position in OnboardingChatScreen, with multiple layers of safeguards and comprehensive debugging

- **Fixed Infinite Loop and Analytics Dependencies**: Resolved critical performance issues in OnboardingChatScreen and useAnalytics.ts:
  * **OnboardingChatScreen Infinite Loop Fix**: 
    - Identified and fixed infinite unmount/mount loop caused by excessive dependencies in useEffect cleanup function
    - Changed unmount useEffect to empty dependency array to only run on actual component unmount
    - Eliminated continuous "Component unmounting, ensuring progress is saved" console spam
    - Improved component lifecycle management and performance
  * **useAnalytics.ts Dependencies Fix**: 
    - Fixed missing posthog dependencies in 15+ useCallback functions causing potential stale closure issues
    - Added posthog dependency to all analytics tracking functions for proper React hooks compliance
    - Fixed trackSignOut, trackAppOpened, trackEntryCreated, trackMeaningfulAction, and 10+ other functions
    - Ensured all PostHog tracking functions properly update when posthog instance changes
  * **Result**: Eliminated performance degradation and infinite loops, improved analytics reliability with proper React hooks patterns

- **Fixed Onboarding Completion Loop**: Resolved critical issue where completed onboarding would restart life deep dive:
  * **Root Cause Analysis**: OnboardingChatScreen was saving progress on component unmount even after successful onboarding completion
    - User completes life deep dive → `handleEnterApp()` → onboarding completion ✅
    - AsyncStorage cleared → `🗑️ Cleared onboarding progress` ✅
    - Firebase updated → `needsOnboarding: false, onboardingCompleted: true` ✅
    - BUT component unmount cleanup → `💾 Saved onboarding progress: {currentStep: 17}` ❌
    - Next app start → Found progress → Redirected to OnboardingChat again ❌
  * **Solution Implemented**: 
    - Added `isOnboardingCompleted` state and `isOnboardingCompletedRef` useRef for closure-safe tracking
    - Enhanced `handleEnterApp()` to mark completion before navigation: `setIsOnboardingCompleted(true)` + `isOnboardingCompletedRef.current = true`
    - Modified unmount useEffect cleanup to check completion status before saving progress
    - Added safeguard: `if (isOnboardingCompletedRef.current) { skip progress save }`
  * **Technical Details**:
    - Used useRef pattern to avoid stale closure issues in useEffect cleanup with empty dependencies
    - Maintained proper React hooks patterns while preventing unwanted side effects
    - Added comprehensive logging for debugging onboarding completion flow
  * **Result**: Clean onboarding completion → no progress saved on unmount → no false resume → direct home screen access after life deep dive completion

- **Fixed PostHog Analytics Spam**: Eliminated excessive user_signed_in event tracking that was flooding analytics:
  * **Problem Identified**: `user_signed_in` event was being tracked multiple times per session on every Firebase auth state change
    - Every Firebase auth state update → `initializeUserDocument()` → `trackSignIn()` call
    - Same user session producing 5-10+ duplicate analytics events
    - PostHog dashboard polluted with redundant sign-in data
    - Analytics data accuracy compromised by false engagement metrics
  * **Solution Implemented**: 
    - Added session-based tracking with `lastTrackedUserIdRef` to prevent duplicate events
    - Enhanced tracking logic: `if (!hasAlreadyTrackedThisUser) { track() }` pattern
    - Session tracking state: Mark user as tracked once per app session
    - Logout state cleanup: Reset `lastTrackedUserIdRef.current = null` on user sign-out
    - Smart logging: Added "(session-once)" markers and "already tracked" skip messages
  * **Technical Implementation**:
    - Used `useRef` for session-persistent tracking state across auth state changes
    - Maintained proper lifecycle: Track on first auth → Skip subsequent → Reset on logout → Track next user
    - Preserved all tracking functionality while eliminating spam
    - Added comprehensive logging for tracking decisions and skips
  * **Result**: Clean analytics flow → One sign-in event per user per session → Accurate PostHog metrics → No tracking spam

## 2025-08-24

- **Fixed Authentication Consistency Issues**: Completely overhauled authentication state management to provide smooth user experience:
  * **Enhanced useAuth Hook**: 
    - Added timeout handling (10s) for user account loading to prevent infinite loading states
    - Implemented exponential backoff retry logic for Firebase authentication failures
    - Added comprehensive error state management with user-friendly messages
    - Created fallback user account creation to prevent blocking when Firestore fails
    - Added proper cleanup of timeouts and retry mechanisms on component unmount
    - Improved state synchronization between Clerk and Firebase authentication
  * **Improved Navigation State Management**: 
    - Simplified navigation keys to reduce unnecessary stack resets
    - Added dedicated error screens with retry functionality
    - Implemented proper loading states for both authentication and user data
    - Removed blocking user account loading that could cause infinite loading
    - Added graceful handling of network failures and timeouts
  * **Enhanced Security & Error Handling**: 
    - Added input validation for authentication tokens and API configurations
    - Improved error messages with specific handling for network and token errors
    - Added proper response validation for token exchange operations
    - Enhanced logging with security-conscious debug information
    - Implemented proper error recovery mechanisms
  * **Professional Code Structure**: 
    - Organized state variables with clear comments and sections
    - Added comprehensive TypeScript types for all authentication states
    - Implemented proper cleanup patterns for all async operations
    - Added computed authentication states for better navigation decisions
  * **Result**: Authentication now handles edge cases gracefully, provides clear error feedback, and never blocks users indefinitely. The app provides a smooth authentication experience even with poor network conditions or service failures.

- **Fixed Login Screen Flash Issue**: Eliminated the bad UX of showing login screen before redirecting to home for authenticated users:
  * **Enhanced Splash Screen Management**: 
    - Modified App.tsx to keep splash screen visible until Clerk authentication is fully loaded
    - Reduced splash screen timeout from 2s to 500ms after auth state is determined
    - Prevents premature hiding of splash screen during auth initialization
  * **Improved Authentication State Logic**: 
    - Enhanced isAuthReady computation to wait for both Clerk and Firebase auth states
    - Added comprehensive authentication state checks before showing navigation
    - Implemented conservative auth state management to prevent false negatives
  * **Optimized Navigation Flow**: 
    - Return null from Navigation component until auth is fully ready (keeps splash visible)
    - Removed blocking user account loading that caused additional loading screens
    - Allow authenticated users to proceed to app while user data loads in background
  * **Enhanced Debug Logging**: 
    - Added detailed console logs for authentication state changes
    - Improved debugging capabilities for authentication flow issues
  * **Result**: App now opens directly to the correct screen (home for authenticated users, login for non-authenticated) without any intermediate flashing or loading screens. Provides a smooth, professional app startup experience.

## 2025-08-24 (Previous)

- **Added Year Display to Home Screen**: Enhanced the date display section in HomeContent.tsx:
  * Added year display above the existing weekday/month/day display
  * Extracted year from the same `displayDate` used for other date components
  * Added `yearText` style with small font (12px), bold weight (600), reduced opacity (0.6), and negative margin for proper spacing
  * Maintains consistent styling with existing date display design
  * Works with both current day entries and historical entries

- **Added Calendar Navigation to Journal Drawer**: Implemented date-based navigation in JournalDrawer.tsx:
  * Added calendar icon button next to "Journal Entries" title in drawer header
  * Installed and integrated `@react-native-community/datetimepicker` dependency
  * Created bottom sheet modal with calendar picker for date selection
  * Implemented date selection logic to navigate to entries for chosen date
  * If entry exists for selected date, navigates to that entry
  * If no entry exists for selected date, creates new entry opportunity
  * Added proper TypeScript types and error handling
  * Includes haptic feedback and smooth modal animations
  * Compatible with both iOS and Android date picker styles
  * Enhanced modal layout with proper positioning, handle bar, shadows, and safe area support
  * Improved UX with backdrop touch handling and proper modal animations
  * Fixed calendar layout positioning and styling for better user experience

- **Repositioned Microphone Button with Keyboard Animations**: Enhanced microphone button UX in HomeContent.tsx:
  * Moved microphone button from bottom navbar to floating right-side position
  * Created round, floating design with shadow and elevation effects
  * Implemented smooth animations that respond to keyboard visibility
  * When keyboard appears: button animates smoothly above keyboard
  * When keyboard hides: button returns to right side, slightly above navbar
  * Added proper z-index layering and touch handling
  * Maintained all existing recording functionality and disabled states
  * Used React Native Reanimated for performant, smooth animations
  * Fixed keyboard behavior: navigation elements now hide when keyboard opens
  * Lowered microphone button position above keyboard (20px gap instead of 80px)
  * Improved UX by preventing navigation interference during text input
  * Removed navbar container styling (borders, shadows, background) for cleaner appearance
  * Fine-tuned microphone button positioning: positioned much lower when keyboard open (80px above keyboard) with consistent 2px right padding in both states
  * Fixed microphone button visibility issue when keyboard opens
  * Optimized positioning for better accessibility and visual consistency

- **Fixed Editor Text Wrapping and Layout**: Resolved horizontal overflow issues in TipTap editor:
  * Added proper word-wrap and overflow-wrap properties to editor styles in TipTap.tsx
  * Implemented max-width constraints and box-sizing for proper container behavior
  * Enhanced CSS in tiptap.css with comprehensive text wrapping rules for all content types
  * Added specific handling for long URLs, code blocks, and links to prevent horizontal scrolling
  * Updated HomeContent container styles to properly constrain editor width
  * Fixed TypeScript typing issues with CSS properties
  * Text now properly wraps within screen boundaries instead of extending horizontally
  * Restored coaching cards to always be visible (reversed previous hiding behavior)
  * Resized microphone button from 60x60px to 50x50px for better proportion
  * Changed microphone icon color from white to gray (#666666) and reduced icon size to 20px
  * Added plus button next to date text for creating new journal entries
  * Plus button triggers createNewEntry() function with haptic feedback
  * Styled as minimal icon without background or border
  * Reduced navigation button widths from 70px to 45px for Settings and Chat buttons to match drawer button size
  * Improved visual consistency across bottom navigation elements
  * Replaced text-based save status indicators with icons:
    - "Saved" → Check icon (✓)
    - "Saving/Unsaved" → Animated spinning Loader2 icon
    - "Creating new entry" → FileText/Draft icon  
  * Added smooth rotation animation for loading states using React Native Reanimated
  * Enhanced save status icons for better visibility: increased size from 16px to 18px
  * Implemented dark mode compatibility with appropriate colors and opacity
  * All status icons use consistent colors: white in dark mode, black in light mode

- Switched `screens/CoachingScreen.tsx` from `useAudioTranscriptionAv` (expo-av) to `useAudioTranscription` (expo-audio) to enable real-time microphone input metering for the recording indicator. No UI changes, only hook swap. The `AudioLevelIndicator` now reflects actual levels via `recorderState.metering` with normalization and graceful fallback.

- Fixed keyboard behavior in CoachingScreen: When the text input is focused and user starts voice recording, the keyboard now stays open instead of dismissing. Applied to `handleMicrophonePress`, `handleRecordingCancel`, and `handleRecordingConfirm` functions using `isChatInputFocused` state and delayed focus restoration.

- Implemented onboarding progress persistence with AsyncStorage:
  * Created `hooks/useOnboardingProgress.ts` to manage onboarding state persistence
  * Updated `screens/auth/Onboarding.tsx` to save progress on each step and restore on app restart
  * Updated `screens/auth/OnboardingChatScreen.tsx` to clear progress when onboarding completes
  * Updated `navigation/AuthNavigator.tsx` to resume onboarding from saved progress
  * Users can now exit the app during onboarding and resume from where they left off
  * Progress includes: currentStep, name, selectedRoles, selectedSelfReflection, clarityLevel, stressLevel, coachingStylePosition, timeDuration, and interaction states


- **Enhanced Message Scrolling System in OnboardingChatScreen**: Copied advanced message positioning and scrolling logic from CoachingScreen to OnboardingChatScreen:
  * Implemented powerful message positioning system with dynamic content height calculation
  * Added smart scroll management with user scroll detection and auto-positioning
  * Added scroll-to-bottom button that appears when AI responses complete and user scrolls up
  * Added performance optimizations with useMemo for dynamic calculations
  * User messages now position 20px below header for optimal visibility

- **Improved Input Box Handling in OnboardingChatScreen**: Updated input system to match CoachingScreen's advanced functionality:
  * TextInput now completely hides (renders null) during voice recording
  * Added intelligent keyboard focus management - preserves and restores focus during recording
  * Implemented SpinningAnimation during transcription phase
  * Added clean recording UI with audio level indicator and cancel/confirm buttons
  * Switched from `useAudioTranscriptionAv` to `useAudioTranscription` for real-time audio level metering

- **Enhanced UI Components**: 
  * Added AnimatedTypingIndicator with 3-dot animation for AI response loading states
  * Improved AudioLevelIndicator with 6-dot real-time visualization during recording
  * Added scroll-to-bottom button with proper styling and positioning
  * Updated loading message containers with fixed heights for smooth animations

- **Fixed Onboarding Completion Flow**: Updated OnboardingChatScreen completion behavior:
  * "View Compass Results" button now properly completes onboarding process by calling `completeOnboarding()`
  * Added loading state to completion button to prevent double-taps
  * Button shows "Completing..." text during onboarding completion process
  * Ensures user is marked as onboarding complete in Firebase and AsyncStorage is cleared

- **Fixed Enter App Button Persistence**: Resolved issue where Enter App button would disappear after appearing:
  * Added `hasReached100` state to track when progress reaches 100%
  * Enter App button now stays visible permanently once progress reaches 100%
  * Added progress bar safety with Math.min to prevent values exceeding 100%
  * Added debug logging for progress tracking

- **Ensured Premium Bypass for Initial Compass Access**: Enhanced CompassStoryScreen to properly bypass premium requirements for onboarding:
  * Added detailed debug logging when `fromOnboarding: true` parameter is passed
  * Confirmed premium paywall is bypassed for first-time compass access after deep dive
  * Users can view their initial compass results without premium subscription requirement

- **Fixed Meditation Screen Exit Behavior**: Corrected navigation logic when user exits app during meditation:
  * Updated `canNavigateToChat()` function in `hooks/useOnboardingProgress.ts` to properly handle step 15 (meditation preparation screen)
  * Removed incorrect logic that allowed navigation to main app when onboarding steps were completed but onboarding wasn't officially finished
  * Now only allows chat navigation for step 17 (OnboardingChat) or when `completedAt` timestamp exists
  * Fixed issue where exiting during meditation would redirect to home screen instead of returning to step 15 (meditation preparation)
  * Users now properly resume from meditation preparation screen (step 15) when they exit during meditation, allowing them to restart meditation process

- **Fixed View Insights Button**: Corrected function errors in SettingsScreen.tsx:
  * Fixed undefined variable `initialized` → `rcInitialized`
  * Fixed undefined function `presentPaywallIfNeeded` → `presentPaywall`
  * Removed unused `currentOffering` parameter
  * Button now properly navigates to CompassStory screen for Pro users
  * Non-Pro users correctly see paywall before accessing insights

- **Added Restore Subscription for Pro Users**: Enhanced subscription management in SettingsScreen.tsx:
  * Added small "Restore Purchases" button below "Manage Subscription" for Pro users
  * Used ghost variant for subtle appearance with 10px top margin
  * Maintained existing restore functionality with proper error handling
  * Preserved original layout for Free users

- **TEMPORARY: RevenueCat Bypass for TestFlight Testing**: Disabled RevenueCat integration to prevent crashes:
  * Modified `useRevenueCat` hook to always return `isPro: true` and `initialized: true`
  * Bypassed all RevenueCat SDK configuration, initialization, and API calls
  * Disabled paywall presentations (`presentPaywall`, `presentPaywallIfNeeded`) - always return true
  * Disabled purchase restoration and customer info refresh functions
  * Added clear bypass comments and TODO notes for easy reversion
  * Users can now access all Pro features (coaching, compass, voice recording) without subscription
  * All original RevenueCat code preserved in comments for future restoration
  * This allows full app testing in TestFlight without subscription-related crashes

- **Enhanced Editor and UI Polish**: Improved user experience with personalized welcome and theme consistency:
  * Updated TipTap editor placeholder to "Welcome Louis, what's on your mind?" for personalized greeting
  * Fixed microphone button icon color in light mode - now white (#ffffff) for better contrast
  * Confirmed save status icons are properly themed - black (#000000) in light mode, white (#ffffff) in dark mode
  * Placeholder text disappears automatically when user starts typing (built-in TipTap behavior)
  * All UI elements now properly respect system theme changes

- **UI Refinements and Cleanup**: Final polish for better user experience:
  * Increased save status icon opacity to 0.8 in light mode for better visibility (was 0.4, too faint)
  * Centered chat and settings icons in navbar with justifyContent and alignItems center alignment
  * Removed TipTap placeholder extension completely - clean editor with no placeholder text
  * Removed unused user prop from TipTap component for cleaner code
  * All UI elements now have consistent visual hierarchy and proper contrast

## 2025-01-13

- **Enhanced PostHog Analytics Implementation**: Comprehensive tracking system for professional dashboards and metrics:
  * **Enhanced Analytics Functions in `useAnalytics.ts`**:
    - `trackMeaningfulAction` - Tracks substantial user actions (journal entries 200+ chars, coaching sessions) for true DAU/WAU measurement
    - `trackOnboardingStep` - Detailed funnel tracking for key steps (signup → coaching config → meditation → session start → compass view)
    - `trackCoachingSessionStarted/Completed` - Full coaching session lifecycle with duration, message count, words written, insights generated
    - `trackNotificationPermissionRequested/Granted/Denied` - Permission tracking with context (onboarding/settings/prompt)
    - `trackCoachingMessagesOptIn` - Coach message preference tracking with frequency and context
    - `trackLifeCompassViewed` - Life compass viewing analytics with source context and compass data
  * **Implementation across all key screens**:
    - `HomeContent.tsx` - Meaningful action tracking for journal entries (triggers at 200+ characters)
    - `Onboarding.tsx` - Key onboarding step completion tracking with user input and time spent
    - `OnboardingChatScreen.tsx` - Coaching session lifecycle, notification permissions, and coaching message opt-ins
    - `SettingsScreen.tsx` - Settings-based notification and coaching message preference changes
    - `CompassStoryScreen.tsx` - Life compass viewing from different contexts (onboarding/coaching/navigation)
  * **Professional Dashboard Metrics Now Available**:
    - DAU/WAU based on meaningful actions (not just app opens)
    - Retention analysis based on valuable user actions
    - Detailed onboarding funnel with drop-off analysis
    - Notification opt-in rates and coaching message adoption
    - Coaching session engagement and completion rates
    - Life compass viewing patterns and user journey mapping
  * All tracking includes proper timestamps, user context, and relevant metadata for comprehensive analytics

- **Enhanced Onboarding Analytics for Detailed Funnel Analysis**: Significantly improved onboarding step tracking for granular drop-off analysis:
  * **Expanded Step Tracking in `Onboarding.tsx`**: Updated `getStepName()` function to track 15 detailed onboarding steps:
    - `name_entered` (Step 1) - User entered their name
    - `roles_selected` (Step 2) - User selected their life roles 
    - `self_reflection_selected` (Step 3) - User selected self-reflection practices
    - `clarity_level_set` (Step 4) - User set their life clarity level
    - `stress_level_set` (Step 5) - User set their stress level
    - `motivation_viewed` (Step 6) - User viewed motivational message
    - `research_viewed` (Step 8) - User viewed research-backed benefits
    - `figures_viewed` (Step 9) - User viewed world leading figures
    - `ready_confirmed` (Step 10) - User confirmed they're ready
    - `coaching_style_configured` (Step 11) - User configured coaching style
    - `time_duration_set` (Step 12) - User set session duration
    - `configuration_loading` (Step 13) - System loading custom configuration
    - `meditation_intro_viewed` (Step 14) - User viewed meditation introduction
    - `meditation_prepared` (Step 15) - User prepared for meditation (headphones step)
    - `meditation_started` (Step 16) - User started 5-minute meditation
  * **Renamed Initial Coaching Session Tracking**: Distinguished initial life deep dive from regular coaching sessions:
    - Changed `session_type` from 'onboarding' to 'initial_life_deep_dive' in `OnboardingChatScreen.tsx`
    - Updated `trackOnboardingStep` call to use 'initial_life_deep_dive_started' instead of 'coaching_session_started'
    - Updated `trackCoachingSessionStarted` type definition to include 'initial_life_deep_dive' session type
    - Enhanced console logging to clarify when initial life deep dive starts vs. regular coaching sessions
  * **Enhanced Analytics Type System**: Updated `trackOnboardingStep` function in `useAnalytics.ts`:
    - Added all 15 new step names plus 'initial_life_deep_dive_started' and 'life_compass_viewed' to type definitions
    - Enables comprehensive funnel analysis with detailed drop-off points identification
    - Better segmentation between initial onboarding deep dive and regular coaching usage
  * **PostHog Dashboard Benefits**: With these analytics improvements, now possible to create:
    - Detailed 17-step onboarding funnel (signup → name → roles → ... → meditation → deep dive → compass)
    - Precise drop-off analysis at every onboarding checkpoint
    - Distinction between initial life deep dive engagement vs. ongoing coaching sessions
    - User journey mapping from first touch to compass completion
    - Granular retention analysis based on specific onboarding completion milestones

- **Separated Initial vs Regular Coaching Session Events**: Enhanced event naming for clearer PostHog analytics distinction:
  * **Updated `trackCoachingSessionStarted` Function**: Modified to use different event names based on session type:
    - Initial life deep dive sessions → `initial_coaching_session_started` event
    - Regular coaching sessions → `coaching_session_started` event  
    - Session type automatically determined from `session_type` parameter
  * **Updated `trackCoachingSessionCompleted` Function**: Added session type parameter and dynamic event naming:
    - Initial life deep dive completion → `initial_coaching_session_completed` event
    - Regular coaching completion → `coaching_session_completed` event
    - Added `session_type` parameter to completion tracking calls
  * **Enhanced All Coaching Session Tracking**: Updated both `OnboardingChatScreen.tsx` and `CoachingScreen.tsx`:
    - OnboardingChatScreen tracks with `session_type: 'initial_life_deep_dive'`
    - CoachingScreen tracks with `session_type: 'regular'`
    - Console logging now shows the specific event name being tracked
  * **PostHog Dashboard Benefits**: With these changes, now possible to create:
    - Separate funnel analysis for initial life deep dive vs. regular coaching engagement
    - Clear conversion tracking from onboarding deep dive to regular coaching usage
    - Distinct session duration and completion rate metrics for each coaching type
    - Better user journey understanding: onboarding → initial deep dive → regular coaching patterns

- **Fixed Critical WebView Bridge Error in TipTap Editor**: Resolved production crash caused by webkit messageHandlers access in DOM context:
  * **Root Cause**: TipTap editor using `"use dom"` directive was trying to access `window.webkit.messageHandlers.ReactNativeWebView.postMessage()` which doesn't exist in DOM context
  * **Solution in `TipTap.tsx`**: Added WebView bridge safety polyfill to prevent undefined object access:
    ```typescript
    // WebView bridge safety check - prevent webkit messageHandlers errors in DOM context
    if (typeof window !== 'undefined' && !window.webkit) {
      window.webkit = {
        messageHandlers: {
          ReactNativeWebView: {
            postMessage: () => {
              console.warn('WebView postMessage called in DOM context - ignoring');
            }
          }
        }
      } as any;
    }
    ```
  * **Added Error Boundary Protection**: Created `EditorErrorBoundary.tsx` component to catch and handle editor errors gracefully
  * **Wrapped Editor in HomeContent**: Protected TipTap editor with error boundary to prevent app crashes and provide user-friendly error messages
  * **Impact**: Prevents production crashes, improves app stability, maintains journal functionality even if editor encounters errors

- **Improved Onboarding Event Naming for PostHog Clarity**: Changed from generic to specific event names for each onboarding step:
  * **Before**: Single `onboarding_step_completed` event with `step_name` property differentiation
  * **After**: Individual event names using `onboarding_${step_name}` pattern for cleaner analytics:
    - `onboarding_name_entered` - User entered their name  
    - `onboarding_roles_selected` - User selected life roles
    - `onboarding_self_reflection_selected` - User selected self-reflection practices
    - `onboarding_clarity_level_set` - User set clarity level
    - `onboarding_stress_level_set` - User set stress level
    - `onboarding_motivation_viewed` - User viewed motivational content
    - `onboarding_research_viewed` - User viewed research benefits
    - `onboarding_figures_viewed` - User viewed world leading figures
    - `onboarding_ready_confirmed` - User confirmed readiness
    - `onboarding_coaching_style_configured` - User configured coaching style
    - `onboarding_time_duration_set` - User set session duration
    - `onboarding_configuration_loading` - System loading configuration
    - `onboarding_meditation_intro_viewed` - User viewed meditation intro
    - `onboarding_meditation_prepared` - User prepared for meditation
    - `onboarding_meditation_started` - User started meditation
    - `onboarding_initial_life_deep_dive_started` - User started initial coaching
    - `onboarding_life_compass_viewed` - User viewed life compass results
  * **PostHog Dashboard Benefits**: Each step now appears as a separate event for easier filtering, funnel creation, and drop-off analysis without needing property-based breakdowns