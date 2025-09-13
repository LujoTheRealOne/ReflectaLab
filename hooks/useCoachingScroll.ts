import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { ScrollView, View } from 'react-native';
import { CoachingMessage } from './useAICoaching';

// Constants for positioning calculations
const HEADER_HEIGHT = 120;
const INPUT_HEIGHT = 160;
const MESSAGE_TARGET_OFFSET = 20; // How many pixels below the header to position user messages

interface UseCoachingScrollProps {
  messages: CoachingMessage[];
  isLoading: boolean;
  shouldShowLoadingIndicator: boolean;
  progress: number;
}

interface UseCoachingScrollReturn {
  // State
  contentHeight: number;
  scrollViewHeight: number;
  showScrollToBottom: boolean;
  
  // Refs
  scrollViewRef: React.RefObject<ScrollView | null>;
  messageRefs: React.MutableRefObject<{ [key: string]: View | null }>;
  scrollToNewMessageRef: React.MutableRefObject<boolean>;
  targetScrollPosition: React.MutableRefObject<number | null>;
  hasUserScrolled: React.MutableRefObject<boolean>;
  didInitialAutoScroll: React.MutableRefObject<boolean>;
  
  // Computed values
  dynamicContentHeight: number;
  dynamicBottomPadding: number;
  scrollLimits: {
    minContentHeight: number;
    maxScrollDistance: number;
  };
  
  // Functions
  setContentHeight: (height: number) => void;
  setScrollViewHeight: (height: number) => void;
  setShowScrollToBottom: (show: boolean) => void;
  scrollToShowLastMessage: () => void;
  handleScrollToBottom: (animated?: boolean) => void;
  handleScroll: (event: any) => void;
  
  // Debug function
  debugLog: (message: string, ...args: any[]) => void;
}

export const useCoachingScroll = ({
  messages,
  isLoading,
  shouldShowLoadingIndicator,
  progress
}: UseCoachingScrollProps): UseCoachingScrollReturn => {
  
  // Debug mode flag - set to false for production
  const DEBUG_LOGS = __DEV__ && true; // Temporarily enabled for debugging
  const debugLog = (message: string, ...args: any[]) => {
    if (DEBUG_LOGS) {
      console.log(message, ...args);
    }
  };

  // State
  const [contentHeight, setContentHeight] = useState(0);
  const [scrollViewHeight, setScrollViewHeight] = useState(700);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  // Refs
  const scrollViewRef = useRef<ScrollView>(null);
  const messageRefs = useRef<{ [key: string]: View | null }>({});
  const scrollToNewMessageRef = useRef(false);
  const targetScrollPosition = useRef<number | null>(null);
  const hasUserScrolled = useRef<boolean>(false);
  const didInitialAutoScroll = useRef<boolean>(false);

  // ========================================================================
  // DYNAMIC CONTENT HEIGHT CALCULATION
  // ========================================================================
  const dynamicContentHeight = useMemo(() => {
    let totalHeight = 12; // paddingTop - Initial spacing from top
    
    // Calculate height for each message
    messages.forEach((message, index) => {
      const contentLength = message.content.length;
      // Estimate lines based on character count (44 chars per line average)
      const lines = Math.max(1, Math.ceil(contentLength / 44));
      let messageHeight = lines * 22 + 32; // line height * lines + padding
      
      // Add extra height for AI messages (coaching cards, buttons, etc.)
      if (message.role === 'assistant') {
        const isLastMessage = index === messages.length - 1;
        const isCurrentlyStreaming = isLastMessage && isLoading;
        
        if (isCurrentlyStreaming) {
          messageHeight += 200; // Extra space for streaming animation
        } else {
          // FIXED: All AI messages get same padding as long messages
          messageHeight += 200; // Increased from 80 to 200 for consistency
        }
      }
      
      totalHeight += messageHeight + 16; // Add message height + bottom margin
    });
    
    // Add space for loading indicator when AI is responding
    if (shouldShowLoadingIndicator) {
      totalHeight += 60;
    }
    
    // DEBUG: Log content height changes during AI response
    if (isLoading) {
      debugLog('🔧 [CONTENT HEIGHT] During AI response:', {
        totalHeight,
        messagesCount: messages.length,
        shouldShowLoadingIndicator
      });
    }
    
    return totalHeight;
  }, [messages, isLoading, shouldShowLoadingIndicator]);

  // ========================================================================
  // SIMPLIFIED BOTTOM PADDING SYSTEM
  // ========================================================================
  const dynamicBottomPadding = useMemo(() => {
    const screenHeight = scrollViewHeight || 700; 
    const availableHeight = screenHeight - HEADER_HEIGHT - INPUT_HEIGHT; // ~420px
    
    // Check if user is waiting for AI response (just sent message or AI is typing)
    const lastMessage = messages[messages.length - 1];
    const isUserWaitingForAI = lastMessage?.role === 'user' || isLoading;
    
    if (isUserWaitingForAI) {
      // Positioning padding - enough space for precise positioning
      return availableHeight + 100;
    } else {
      // Minimal padding - just bottom space
      return 50;
    }
  }, [messages, isLoading, scrollViewHeight]);

  // ========================================================================
  // SIMPLIFIED SCROLL LIMITS CALCULATION
  // ========================================================================
  const scrollLimits = useMemo(() => {
    const screenHeight = scrollViewHeight || 700; 
    const availableHeight = screenHeight - HEADER_HEIGHT - INPUT_HEIGHT; // ~420px
    
    // Simple calculation like the working version
    const minContentHeight = dynamicContentHeight + dynamicBottomPadding;
    const maxScrollDistance = Math.max(0, minContentHeight - availableHeight + 50);
    
    return {
      minContentHeight,
      maxScrollDistance
    };
  }, [dynamicContentHeight, dynamicBottomPadding, scrollViewHeight]);

  // ========================================================================
  // USER MESSAGE POSITIONING SYSTEM
  // ========================================================================
  const scrollToShowLastMessage = useCallback(() => {
    // Early returns for invalid states
    if (!scrollViewRef.current || messages.length === 0) return;
    
    const lastMessage = messages[messages.length - 1];
    
    // Only position user messages (AI messages position themselves)
    if (lastMessage.role !== 'user') return;
    
    debugLog('🎯 Positioning user message:', lastMessage.content.substring(0, 30) + '...');
    
    // Target position: MESSAGE_TARGET_OFFSET pixels below header
    const targetFromTop = MESSAGE_TARGET_OFFSET;
    
    // Get reference to the user message element
    const lastMessageRef = messageRefs.current[lastMessage.id];
    
    if (lastMessageRef) {
      // Wait for layout stabilization before measuring
      setTimeout(() => {
        lastMessageRef.measureLayout(
          scrollViewRef.current as any,
          (msgX: number, msgY: number, msgWidth: number, msgHeight: number) => {
            // Determine if this is a long message requiring special handling
            const isLongMessage = msgHeight > 100; // Messages taller than 100px are considered long
            
            let targetScrollY;
            if (isLongMessage) {
              // LONG MESSAGE STRATEGY: Position the END of the message at target position
              targetScrollY = Math.max(0, (msgY + msgHeight) - targetFromTop - 60); // 60px buffer for AI response
            } else {
              // SHORT MESSAGE STRATEGY: Position the START of the message at target position  
              targetScrollY = Math.max(0, msgY - targetFromTop);
            }
            
            debugLog('📐 Measurement results:', {
              messageY: msgY,
              messageHeight: msgHeight,
              isLongMessage,
              targetFromTop,
              targetScrollY
            });
            
            // Execute the scroll animation
            scrollViewRef.current?.scrollTo({
              y: targetScrollY,
              animated: true
            });
            
            // Store position for maintaining scroll during AI response
            targetScrollPosition.current = targetScrollY;
            hasUserScrolled.current = false;
            
            debugLog('✅ User message positioned at scroll:', targetScrollY);
          },
          () => {
            debugLog('❌ Measurement failed, using estimation fallback');
            
            // FALLBACK STRATEGY: Estimate message position when measurement fails
            let estimatedY = 12; // paddingTop
            
            // Calculate cumulative height of all previous messages
            for (let i = 0; i < messages.length - 1; i++) {
              const msg = messages[i];
              const lines = Math.max(1, Math.ceil(msg.content.length / 40));
              const msgHeight = lines * 22 + 48; // text + padding
              estimatedY += msgHeight + 16; // marginBottom
            }
            
            // Estimate height of the last message
            const lastMsg = messages[messages.length - 1];
            const lastMsgLines = Math.max(1, Math.ceil(lastMsg.content.length / 40));
            const lastMsgHeight = lastMsgLines * 22 + 48;
            const isLongMessage = lastMsgHeight > 100;
            
            let targetScrollY;
            if (isLongMessage) {
              // For long messages: position the END of the message
              targetScrollY = Math.max(0, (estimatedY + lastMsgHeight) - targetFromTop - 60);
            } else {
              // For short messages: position the START of the message
              targetScrollY = Math.max(0, estimatedY - targetFromTop);
            }
            
            // Execute fallback scroll
            scrollViewRef.current?.scrollTo({
              y: targetScrollY,
              animated: true
            });
            
            // Store fallback position
            targetScrollPosition.current = targetScrollY;
            hasUserScrolled.current = false;
          }
        );
      }, 200); // Increased timeout for better reliability on initial messages
    }
  }, [messages]);

  // ========================================================================
  // SCROLL-TO-BOTTOM FUNCTIONALITY
  // ========================================================================
  const handleScrollToBottom = useCallback((animated: boolean = true) => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      const lastMessageRef = messageRefs.current[lastMessage.id];
      
      if (lastMessageRef) {
        // PRECISE POSITIONING: Use actual message dimensions
        lastMessageRef.measureLayout(
          scrollViewRef.current as any,
          (x, y, width, height) => {
            // Determine scroll strategy based on message characteristics
            const isLongResponse = lastMessage.role === 'assistant' && lastMessage.content.length >= 200;
            
            if (isLongResponse) {
              // LONG MESSAGE STRATEGY: Show the end of the message
              const targetY = Math.max(0, y + height - 300); // Show end with 100px buffer
              scrollViewRef.current?.scrollTo({
                y: targetY,
                animated
              });
            } else {
              // SHORT MESSAGE STRATEGY: Show the entire message with minimal offset
              const targetY = Math.max(0, y - 20); // Small offset from top
              scrollViewRef.current?.scrollTo({
                y: targetY,
                animated
              });
            }
          },
          () => {
            // FALLBACK STRATEGY: Estimation-based positioning
            const estimatedPosition = Math.max(0, (messages.length - 1) * 80 - 30);
            scrollViewRef.current?.scrollTo({
              y: estimatedPosition,
              animated
            });
          }
        );
      } else {
        // SECONDARY FALLBACK: When message ref is not available
        const estimatedPosition = Math.max(0, (messages.length - 1) * 80 - 30);
        scrollViewRef.current?.scrollTo({
          y: estimatedPosition,
          animated
        });
      }
    } else {
      // EMPTY STATE: Basic scroll to end when no messages
      scrollViewRef.current?.scrollToEnd({ animated });
    }
  }, [messages]);

  // ========================================================================
  // SCROLL EVENT HANDLER - MAIN SCROLL LOGIC
  // ========================================================================
  const handleScroll = useCallback((event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const scrollY = contentOffset.y;
    
    // Manual scroll detection
    if (targetScrollPosition.current !== null) {
      const savedPosition = targetScrollPosition.current;
      const scrollDifference = Math.abs(scrollY - savedPosition);
      
      // If user scrolled more than 50px from saved position, consider it manual
      if (scrollDifference > 50) {
        debugLog('👆 User scrolled manually, clearing positioning');
        hasUserScrolled.current = true;
        targetScrollPosition.current = null;
      }
    }
    
    // Scroll-to-bottom button visibility
    const hasMessages = messages.length > 0;
    const lastMessage = hasMessages ? messages[messages.length - 1] : null;
    const isAIResponseComplete = !isLoading && lastMessage?.role === 'assistant';
    const isPositioningActive = targetScrollPosition.current !== null;
    
    if (isAIResponseComplete && !isPositioningActive) {
      const contentHeight = contentSize.height;
      const screenHeight = layoutMeasurement.height;
      const distanceFromBottom = contentHeight - screenHeight - scrollY;
      
      // Show button when user is more than 200px from bottom
      setShowScrollToBottom(distanceFromBottom > 200);
    } else {
      // Hide button during AI responses, positioning, or when no messages
      setShowScrollToBottom(false);
    }
  }, [messages, isLoading]);

  // ========================================================================
  // POSITION MAINTENANCE DURING AI RESPONSE
  // ========================================================================
  useEffect(() => {
    if (isLoading && targetScrollPosition.current !== null && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      
      // Only maintain position for user messages, not during AI response expansion
      if (lastMessage?.role === 'user') {
        const lastMessageRef = messageRefs.current[lastMessage.id];
        
        if (lastMessageRef) {
          setTimeout(() => {
            if (scrollViewRef.current && !hasUserScrolled.current) {
              // Re-measure and recalculate position to maintain exact offset
              lastMessageRef.measureLayout(
                scrollViewRef.current as any,
                (msgX: number, msgY: number, msgWidth: number, msgHeight: number) => {
                  // Calculate exact position to maintain MESSAGE_TARGET_OFFSET
                  const isLongMessage = msgHeight > 100;
                  let correctPosition: number;
                  
                  if (isLongMessage) {
                    // For long messages: maintain END position at target offset
                    correctPosition = Math.max(0, (msgY + msgHeight) - MESSAGE_TARGET_OFFSET - 60);
                  } else {
                    // For short messages: maintain START position at target offset
                    correctPosition = Math.max(0, msgY - MESSAGE_TARGET_OFFSET);
                  }
                  
                  scrollViewRef.current?.scrollTo({
                    y: correctPosition,
                    animated: false // No animation to prevent jarring
                  });
                  
                  // Update stored position
                  targetScrollPosition.current = correctPosition;
                  
                  debugLog('🔧 Position maintained during AI response:', correctPosition);
                },
                () => {
                  // Fallback: use stored position
                  const maintainedPosition = targetScrollPosition.current;
                  if (maintainedPosition !== null) {
                    scrollViewRef.current?.scrollTo({
                      y: maintainedPosition,
                      animated: false
                    });
                  }
                }
              );
            }
          }, 100); // Shorter timeout for responsiveness
        }
      }
    }
  }, [isLoading, messages]);

  // ========================================================================
  // POSITIONING CLEANUP AND AI RESPONSE COMPLETE SCROLL
  // ========================================================================
  useEffect(() => {
    if (progress === 100) {
      debugLog('🎯 AI response complete (progress 100%), cleaning up and scrolling to show response');
      setTimeout(() => {
        // Clear positioning system
        targetScrollPosition.current = null;
        hasUserScrolled.current = false;
        debugLog('🧹 Positioning cleared after AI response completion');
        
        // Scroll to show the complete AI response
        handleScrollToBottom(true);
      }, 500); // Reduced timeout for more responsive scroll
    }
  }, [progress, handleScrollToBottom]);

  // Auto-scroll to position new messages below header - DIRECT EXECUTION
  const lastExecutedMessageCount = useRef(0);
  
  useEffect(() => {
    // Only execute on new messages and when flag is set
    const hasNewMessage = messages.length > lastExecutedMessageCount.current;
    
    if (scrollToNewMessageRef.current && 
        scrollViewRef.current && 
        messages.length > 0 && 
        hasNewMessage) {
      
      debugLog('🎯 ScrollToNewMessage flag detected, positioning new message');
      
      // Clear flag immediately
      scrollToNewMessageRef.current = false;
      lastExecutedMessageCount.current = messages.length;
      
      // Position the message
      setTimeout(() => {
        scrollToShowLastMessage();
        debugLog('🎯 ScrollToNewMessage positioning complete');
      }, 200);
    }
  }, [messages.length]); // Only depend on message count change

  // Initial auto-scroll to bottom once after messages initialize
  useEffect(() => {
    if (messages.length === 0) return;
    if (didInitialAutoScroll.current) return;
    if (!scrollViewRef.current) return;

    // Allow layout to settle, then scroll to last message precisely
    setTimeout(() => {
      if (!hasUserScrolled.current && scrollViewRef.current) {
        handleScrollToBottom(false);
        didInitialAutoScroll.current = true;
      }
    }, 300); // Increased timeout for initial auto-scroll reliability
  }, [messages.length, handleScrollToBottom]);

  return {
    // State
    contentHeight,
    scrollViewHeight,
    showScrollToBottom,
    
    // Refs
    scrollViewRef,
    messageRefs,
    scrollToNewMessageRef,
    targetScrollPosition,
    hasUserScrolled,
    didInitialAutoScroll,
    
    // Computed values
    dynamicContentHeight,
    dynamicBottomPadding,
    scrollLimits,
    
    // Functions
    setContentHeight,
    setScrollViewHeight,
    setShowScrollToBottom,
    scrollToShowLastMessage,
    handleScrollToBottom,
    handleScroll,
    
    // Debug function
    debugLog
  };
};
