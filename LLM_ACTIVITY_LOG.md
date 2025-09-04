# LLM Activity Log - ReflectaLab

This file records all important changes and implementations made by the LLM assistant.


*This log file should be updated after every significant LLM implementation.*

## 2025-01-27

- **Added Onboarding Reset Feature to Settings**: Implemented functionality to allow users to reset their onboarding progress and go through the onboarding process again:
  * **Settings Screen Enhancement**: Added new "Reset Onboarding" button to the "More Information" section:
    - Added RotateCcw icon from lucide-react-native for visual clarity
    - Positioned button in the information section alongside Privacy Policy, Terms of Service, and App Information
    - Maintains consistent styling with other info buttons using ghost variant
  * **Reset Functionality**: Implemented `handleResetOnboarding()` function with proper user confirmation:
    - Shows confirmation alert explaining the consequences of resetting onboarding
    - Uses destructive style for the reset action to indicate permanent change
    - Calls `clearOnboardingProgress()` from useOnboardingProgress hook to clear AsyncStorage
    - Shows success confirmation after reset completion
    - Includes proper error handling with user-friendly error messages
  * **Integration with Existing System**: Leverages existing onboarding infrastructure:
    - Uses `useOnboardingProgress` hook's `clearProgress` function
    - Removes onboarding data from AsyncStorage (@onboarding_progress key)
    - App will automatically detect missing onboarding progress on next launch
    - User will be redirected through complete onboarding flow again
  * **User Experience**: Clear communication about what the reset does:
    - Explains that all onboarding progress will be cleared
    - Informs user they'll need to complete onboarding again
    - Provides confirmation that reset was successful
    - Maintains app stability - no immediate navigation changes required
  * **CRITICAL FIX - Complete Reset Implementation**: Fixed the reset functionality to clear both AsyncStorage AND Firebase onboarding status:
    - **Issue**: Initial implementation only cleared AsyncStorage but Firebase still had `onboardingCompleted: true`
    - **Root Cause**: App navigation logic checks Firebase user account data (`useAuth.ts` line 195) for onboarding completion status
    - **Solution**: Updated `handleResetOnboarding()` to also reset Firebase onboarding data:
      - Calls `FirestoreService.updateUserAccount()` to set `onboardingCompleted: false`
      - Resets all onboarding data fields to default values (empty arrays, 0 values)
      - Updates `updatedAt` timestamp for proper data consistency
    - **Complete Reset Flow**: Now properly clears both local (AsyncStorage) and server (Firebase) onboarding state
    - **User Guidance**: Updated success message to recommend app restart for clean onboarding experience

- **Fixed ArdaEditor Layout and Size Constraints**: Resolved editor expanding beyond screen boundaries and improved layout behavior:
  * **Height Constraints**: Limited editor height to prevent unlimited expansion:
    - Set `minHeight: 300px` and `maxHeight: 600px` for the RichEditor
    - Reduced `initialHeight` from 500px to 300px for better initial display
    - Added proper height constraints to `editorStack` container
  * **Width and Overflow Control**: Prevented horizontal overflow and content expansion:
    - Added `maxWidth: '100%'` and `overflow: 'hidden'` to all container styles
    - Enhanced CSS styling with `max-width: 100%` and `overflow-x: hidden`
    - Added `word-wrap: break-word` to ensure text wraps properly
    - Applied `box-sizing: border-box` to all elements for consistent sizing
  * **ScrollView Improvements**: Enhanced scrolling behavior and content containment:
    - Removed `KeyboardAvoidingView` wrapper that was causing layout issues
    - Added `bounces={false}` and `overScrollMode="never"` to prevent overscroll
    - Updated `contentContainerStyle` to use proper style object instead of inline styles
    - Added proper padding and margin constraints
  * **Coaching Blocks Layout**: Fixed coaching block positioning and text wrapping:
    - Added horizontal margins (16px) to coaching blocks for proper spacing
    - Applied `maxWidth: '100%'` and `overflow: 'hidden'` to prevent expansion
    - Enhanced text wrapping with `flexWrap: 'wrap'` for content and buttons
    - Added `flexShrink: 1` to option buttons for responsive sizing
  * **CSS Enhancements**: Improved web content styling within RichEditor:
    - Added comprehensive CSS rules for content containment
    - Enhanced `cssText` and `contentCSSText` with proper width constraints
    - Added proper padding (16px left/right) for better text positioning
    - Ensured all elements respect container boundaries with `!important` rules

- **Fixed Autocorrect and Word Suggestions in ArdaEditor**: Resolved text input issues where autocorrect and word suggestions weren't working properly:
  * **Native Text Input Properties**: Added proper autocorrect and spell checking support:
    - Enabled `autoCorrect={true}` and `spellCheck={true}` on RichEditor
    - Added `autoCapitalize="sentences"` for proper capitalization
    - Set appropriate `keyboardType="default"` and `returnKeyType="default"`
    - Added `textContentType="none"` to prevent interference with text input
  * **WebView CSS Enhancements**: Improved contenteditable behavior with proper CSS rules:
    - Added `autocorrect: on`, `spellcheck: true`, and `autocapitalize: sentences` to CSS
    - Enhanced `[contenteditable]` elements with `-webkit-user-modify: read-write-plaintext-only`
    - Added `-webkit-line-break: after-white-space` for proper word breaking
    - Applied `word-break: break-word` for consistent text wrapping
  * **Focus and Initialization Handling**: Added proper event handlers for better text input:
    - Added `handleEditorFocus()` to ensure proper focus behavior
    - Added `handleEditorInitialized()` for proper content loading
    - Added `onFocus` and `onLoad` event handlers to RichEditor
    - Set `keyboardDisplayRequiresUserAction={false}` for immediate keyboard access
  * **Hardware Acceleration**: Optimized performance for text input:
    - Enabled `androidHardwareAccelerationDisabled={false}` for better performance
    - Set `androidLayerType="hardware"` for optimized rendering
    - Added `-webkit-text-size-adjust: 100%` for consistent text sizing
  * **Text Selection Improvements**: Enhanced text selection and editing capabilities:
    - Added `-webkit-user-select: text` and `-webkit-touch-callout: default`
    - Set `-webkit-appearance: none` to prevent system interference
    - Initially enabled full keyboard functionality, then refined for better UX

- **Removed iOS Keyboard Accessory View (Done Bar)**: Hidden the unwanted keyboard toolbar that appears above the iOS keyboard:
  * **Native Property**: Set `hideKeyboardAccessoryView={true}` on RichEditor to hide the accessory view
  * **CSS Enhancement**: Added `-webkit-keyboard-accessory-view: none` to both `cssText` and `contentCSSText`
  * **Applied to All Input Elements**: Ensured the CSS rule applies to `input`, `textarea`, and `[contenteditable]` elements
  * **User Experience**: Provides cleaner keyboard interface without the distracting "Done" toolbar
  * **Maintains Functionality**: Autocorrect and spell checking still work without the accessory view

- **Repositioned Microphone Button and Extended Editor Height**: Improved layout by moving microphone button to navigation level and extending editor reach:
  * **Microphone Button Positioning**: Moved floating microphone button down to navigation buttons level:
    - Changed `bottom` position from `120px` to `40px` in `floatingMicButton` style
    - Updated animation `translateY` values from `20px` to `-80px` for keyboard-closed state
    - Updated initial position to match new lower placement
    - Button now aligns with navigation buttons when keyboard is closed
  * **Editor Height Extension**: Increased editor container height to reach navigation buttons:
    - Reduced `marginBottom` from `80px` to `20px` when keyboard is closed
    - Editor now extends much closer to navigation buttons for better space utilization
    - Maintained `200px` margin when keyboard is visible for proper text input space
  * **Improved Space Utilization**: Better use of screen real estate:
    - More writing space available when keyboard is closed
    - Microphone button positioned at natural thumb reach level
    - Cleaner visual alignment with navigation elements

- **Added Automatic Cursor Positioning to End of Text in ArdaEditor**: Enhanced UX by automatically moving cursor to the end of content when editor is focused or tapped:
  * **Cursor Positioning Function**: Implemented `moveCursorToEnd()` with robust JavaScript injection:
    - Uses `document.createRange()` and `window.getSelection()` APIs for precise cursor control
    - Handles both text nodes and element nodes for comprehensive content support
    - Includes proper error handling with non-critical logging
    - Focuses the contenteditable element before positioning cursor
  * **Focus Event Integration**: Enhanced `handleEditorFocus()` to automatically position cursor:
    - Calls `moveCursorToEnd()` with 100ms delay after focus to ensure proper timing
    - Maintains existing focus functionality while adding cursor positioning
    - Provides console logging for debugging and user feedback
  * **Smart Click Detection**: Enhanced cursor positioning to only trigger on empty areas:
    - Analyzes click location using `window.getSelection()` and `getBoundingClientRect()`
    - Only moves cursor to end when clicking on truly empty areas
    - Preserves normal text editing when clicking within existing content
    - Prevents interference with text selection and editing operations
  * **Improved Writing Experience**: Smart cursor behavior that respects user intent:
    - Cursor automatically jumps to end only when clicking on empty areas
    - Normal text editing preserved when clicking within existing content
    - Allows proper text selection and cursor positioning within text
    - Seamless continuation of writing flow when accessing empty areas
  * **WebView Message Handling**: Added `onMessage` handler for potential future enhancements:
    - Logs WebView messages for debugging purposes
    - Provides foundation for advanced editor interactions if needed

- **Enhanced Editor Layout and Width Constraints**: Fixed editor height consistency and prevented horizontal expansion:
  * **Improved Height Management**: Enhanced editor to always reach navigation buttons:
    - Changed `editorStack` and `richEditor` to use `flex: 1` for full space utilization
    - Increased `minHeight` from 300px to 400px for better minimum coverage
    - Increased `initialHeight` from 300px to 500px for better initial display
    - Editor now consistently reaches navigation level regardless of content amount
  * **Strict Width Control**: Implemented comprehensive horizontal constraint system:
    - Added `width: 100% !important` and `min-width: 100% !important` to body element
    - Applied `max-width: 100% !important` and `overflow-x: hidden !important` to all elements
    - Enhanced word wrapping with `word-break: break-word !important` and `overflow-wrap: break-word !important`
    - Prevented editor from expanding beyond container boundaries
  * **Content Element Constraints**: Applied strict width rules to all content elements:
    - Paragraphs (`p`) and divs constrained to `width: 100% !important`
    - All contenteditable elements forced to respect container width
    - Input and textarea elements prevented from horizontal overflow
    - Comprehensive CSS rules with `!important` flags to override any conflicting styles
  * **Improved Text Wrapping**: Enhanced text flow and line breaking:
    - Multiple word-wrapping strategies: `word-wrap`, `word-break`, and `overflow-wrap`
    - Proper line breaking with `-webkit-line-break: after-white-space`
    - Consistent text flow regardless of content length or type

- **Added Life Compass Reset Feature to Settings**: Implemented functionality to allow users to reset their compass insights and start fresh:
  * **Settings Screen Enhancement**: Added new "Reset Life Compass" button to the "More Information" section:
    - Added Compass icon from lucide-react-native for visual clarity
    - Positioned alongside other reset/utility options (Reset Onboarding, App Information)
    - Maintains consistent styling with other info buttons using ghost variant
  * **Compass Reset Functionality**: Implemented `handleResetCompass()` function with proper user confirmation:
    - Shows detailed confirmation alert explaining permanent deletion of all compass data
    - Uses destructive style to indicate irreversible action
    - Calls new `FirestoreService.deleteUserInsights()` method to remove all insights
    - Shows success confirmation after deletion completion
    - Includes proper error handling with user-friendly error messages
  * **Backend Support**: Added `deleteUserInsights()` method to FirestoreService:
    - Queries `userInsights` collection for all documents belonging to the user
    - Deletes all insights documents using batch Promise.all() for efficiency
    - Includes proper error handling and logging
    - Returns meaningful error messages for UI handling
  * **Data Management**: Complete removal of compass insights data:
    - Deletes all user insights from Firestore `userInsights` collection
    - Removes Main Focus, Key Blockers, and Plan data permanently
    - Real-time listeners automatically update UI to reflect empty state
    - New insights will be generated as user continues journaling and coaching
  * **User Experience**: Clear communication about compass reset consequences:
    - Explains that all compass insights will be permanently deleted
    - Warns that action cannot be undone
    - Informs user that new insights will be generated through future activity
    - Provides confirmation that reset was successful

- **Restored Goal Breakout Session Generation After Coaching Completion**: Re-implemented the missing functionality where completing a coaching session automatically generates a goal breakout session linked to a journal entry:
  * **Enhanced Coaching Completion Flow**: Modified `CoachingScreen.tsx` to create goal breakout sessions after coaching completion:
    - Added `createGoalBreakoutSession()` function that generates a new coaching session with `sessionType: 'default-session'`
    - Creates initial assistant message welcoming user to goal breakout planning
    - Links the new session to the completed coaching session via `parentSessionId`
  * **Automatic Journal Entry Linking**: Creates a new journal entry automatically linked to the goal breakout session:
    - Generates journal entry with `linkedCoachingSessionId` pointing to the goal breakout session
    - Sets appropriate title: "Goal Breakout - [date]"
    - Leaves content empty for user to fill in during their reflection
  * **Updated Type Definitions**: Enhanced `types/journal.ts` to include `linkedCoachingSessionId` field:
    - Added `linkedCoachingSessionId?: string` to `JournalEntry` interface
    - Maintains existing `linkedCoachingMessageId` field for coaching messages
    - Enables proper linking between journal entries and coaching sessions
  * **HomeContent Integration**: The existing HomeContent logic automatically detects and displays linked coaching sessions:
    - Shows "Goal breakout session" card when `linkedCoachingSessionId` is present
    - Allows users to click and continue the goal breakout conversation
    - Maintains proper session type detection (`sessionType === 'default-session'` → "Goal breakout session")
  * **User Experience Flow**: 
    1. User completes coaching session → clicks "End this session"
    2. System creates goal breakout session in background
    3. System creates linked journal entry
    4. User sees compass results, then returns to home
    5. Home screen shows new "Goal breakout session" card
    6. User can click to continue goal planning conversation
  * **Error Handling**: Added proper error handling and logging for goal breakout session creation
  * **Analytics Integration**: Tracks journal entry creation for goal breakout sessions using existing analytics

## 2025-08-25

- **Replaced TipTap Editor with High-Performance Native React Native Editor**: Eliminated WebKit issues and performance problems by creating a complete native replacement:
  * **Backup and Migration**: 
    - Moved existing TipTap.tsx to TipTap_backup.tsx for safe preservation of original implementation
    - Created new native editor using same interface (EditorProps) for seamless drop-in replacement
    - Maintained backward compatibility with all existing props and callbacks
  * **Native Performance Gains**: 
    - Replaced DOM-based TipTap editor with native React Native TextInput for superior performance
    - Eliminated WebKit bridge issues and webkit.messageHandlers polyfills
    - Removed heavy dependencies (@tiptap packages) reducing bundle size
    - Native keyboard handling and text selection for better mobile UX
  * **Preserved AI Coaching Features**: 
    - Maintained spacebar trigger for AI coaching blocks (empty line + space)
    - Preserved streaming AI response handling and XML parsing logic
    - Kept all coaching block variants (text, buttons, multi-select) with native rendering
    - Maintained AIChatInterface integration and keyboard shortcuts
  * **Enhanced Native Experience**: 
    - Native React Native coaching blocks using TouchableOpacity and Text components
    - Proper KeyboardAvoidingView and ScrollView for optimal mobile experience
    - Native haptic feedback and animations using React Native Reanimated
    - Intelligent cursor position tracking and text insertion
  * **Visual Consistency**: 
    - Maintained dark/light theme compatibility with proper Colors integration
    - Preserved same dimensions and styling as original editor
    - Native components styled to match existing app design patterns
  * **Technical Implementation**: 
    - Used AsyncStorage-ready architecture for future offline capabilities
    - Proper React Native lifecycle management with useRef and useCallback patterns
    - Error handling and graceful fallbacks for API failures
    - Memory-efficient with no DOM manipulation or web dependencies
  * **Developer Experience**: 
    - Cleaner codebase with standard React Native patterns
    - Easier debugging without web/native context switching
    - Simplified maintenance without webkit compatibility issues
  * **Result**: High-performance native journal editor that eliminates WebKit crashes while preserving all AI coaching functionality and providing superior mobile UX

- **Added Native Keyboard Formatting Toolbar**: Enhanced the native journal editor with comprehensive text formatting capabilities:
  * **Smart Keyboard Toolbar**: Created `KeyboardToolbar.tsx` component that appears above keyboard when typing
    - Positioned dynamically above keyboard using keyboard height detection
    - Horizontal scrolling for all formatting options
    - Clean, native design matching app theme
  * **Complete Formatting Options**: 
    - **Bold** (`**text**`) - Wrap selected text in double asterisks
    - **Italic** (`*text*`) - Wrap selected text in single asterisks  
    - **Strikethrough** (`~~text~~`) - Cross out text with tildes
    - **Code** (`\`text\``) - Inline code with backticks
    - **Heading 1** (`# text`) - Large headers with hash
    - **Heading 2** (`## text`) - Medium headers with double hash
    - **Bullet Lists** (`• text`) - Unordered lists with bullet points
    - **Numbered Lists** (`1. text`) - Ordered lists with numbers
    - **Quotes** (`> text`) - Block quotes with greater than symbol
    - **Clear Formatting** - Remove all markdown formatting from text
  * **Intelligent Text Processing**: 
    - **Cursor-aware formatting**: Inserts formatting at exact cursor position
    - **Line-based formatting**: Headers, lists, and quotes applied to current line
    - **Inline formatting**: Bold, italic, code applied around cursor with proper positioning
    - **Smart cursor placement**: Positions cursor between formatting markers for immediate typing
  * **Native Performance Features**: 
    - Uses native TextInput setNativeProps for instant cursor positioning
    - Haptic feedback on all button presses for tactile experience
    - Markdown-style formatting that's readable in plain text
    - Real-time text updates with proper state management
  * **Enhanced Keyboard Integration**: 
    - Automatic show/hide based on keyboard visibility
    - Proper padding adjustments for toolbar space
    - Smooth keyboard animations and transitions
    - keyboardShouldPersistTaps for uninterrupted formatting
  * **Result**: Professional text editing experience with full formatting capabilities while maintaining native performance and eliminating WebKit issues. Users can now format their journal entries with rich text while typing, creating beautifully formatted content that remains readable even in plain text form.

## 2025-08-25 (Previous)

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

- **CRITICAL FIX: Firebase Auth Persistence on React Native**
  * Implemented AsyncStorage-backed persistence to prevent random logouts across sessions
  * Changes in `lib/firebase.ts`:
    - Switched to `initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })`
    - Added guard to fallback to `getAuth(app)` if `initializeAuth` was already called
    - Ensured this runs only on React Native (non-web) platforms
    - Kept emulator connections intact and idempotent
  * Impact:
    - Fixes `@firebase/auth` warning about memory persistence
    - Prevents auth state loss after app restarts → no more random logouts
    - Stabilizes auth flow and onboarding state across sessions

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