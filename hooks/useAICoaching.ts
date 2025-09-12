import { useState, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAnalytics } from '@/hooks/useAnalytics';

// Match the interface from the web app
export interface CoachingMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isError?: boolean;
  originalUserMessage?: string;
}

interface UseAICoachingReturn {
  messages: CoachingMessage[];
  isLoading: boolean;
  error: string | null;
  progress: number; // 0-100
  sendMessage: (content: string, sessionId: string, options?: { sessionType?: string; sessionDuration?: number }) => Promise<void>;
  resendMessage: (messageId: string, sessionId: string, options?: { sessionType?: string; sessionDuration?: number }) => Promise<void>;
  clearMessages: () => void;
  setMessages: (messages: CoachingMessage[]) => void;
  stopGeneration: () => void;
}

export function useAICoaching(): UseAICoachingReturn {
  const [messages, setMessages] = useState<CoachingMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(7);
  const { getToken } = useAuth();
  const { trackCoachingCompletion } = useAnalytics();
  const abortControllerRef = useRef<AbortController | null>(null);

  // Typewriter effect function for React Native
  const simulateTypewriter = async (content: string, messageId: string) => {
    const words = content.split(' ');
    let currentContent = '';
    
    for (let i = 0; i < words.length; i++) {
      currentContent += (i > 0 ? ' ' : '') + words[i];
      
      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, content: currentContent }
          : msg
      ));
      
      // Adjust speed based on word length - shorter delay for shorter words
      const delay = Math.min(Math.max(words[i].length * 10, 30), 100);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  };

  // Progress evaluation function
  const evaluateProgress = async (sessionId: string, conversationHistory: CoachingMessage[]) => {
    try {
      const token = await getToken();
      if (!token) return;

      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}api/coaching/progress`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          conversationHistory,
          previousProgress: progress,
          sessionId,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && typeof result.progress === 'number') {
          setProgress(result.progress);
        }
      }
    } catch (error) {
      console.error('Error evaluating progress:', error);
      // Fallback: increment progress slightly
      setProgress(prev => Math.min(prev + 5, 95));
    }
  };

  const sendMessage = useCallback(async (content: string, sessionId: string, options?: { sessionType?: string; sessionDuration?: number }) => {
    if (!content.trim()) return;
    if (!sessionId || !sessionId.trim()) {
      throw new Error('Session ID is required for coaching messages');
    }

    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();

    const userMessage: CoachingMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date()
    };

    // Add user message immediately
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    try {
      // Get Clerk token for authentication
      const token = await getToken();
      if (!token) {
        throw new Error('Authentication token not available');
      }

      // Call the web app API endpoint
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}api/coaching/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: content.trim(),
          sessionId: sessionId,
          sessionType: options?.sessionType || 'default-session',
          sessionDuration: options?.sessionDuration,
          conversationHistory: messages // Include conversation history for context
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error('❌ API Error Response:', errorText);
        throw new Error(`API Error: ${response.status} - ${errorText}`);
      }

      // Create AI message placeholder for streaming
      const aiMessageId = (Date.now() + 1).toString();
      const aiMessage: CoachingMessage = {
        id: aiMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date()
      };

      // Add AI message placeholder
      setMessages(prev => [...prev, aiMessage]);
      setIsLoading(false);

      // React Native streaming implementation
      if (!response.body) {
        const fullResponse = await response.text();
        
        // Parse the server-sent events format manually
        const lines = fullResponse.split('\n');
        let fullContent = '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'content') {
                fullContent += data.content;
              }
            } catch (parseError) {
              console.error('Error parsing line:', line, parseError);
            }
          }
        }
        
        // Log raw LLM response for inspection
        console.log('🤖 RAW LLM RESPONSE:', fullContent);
        console.log('🤖 LLM RESPONSE LENGTH:', fullContent.length);
        
        // Check for finish tokens
        const hasFinishToken = fullContent.includes('[finish-start]') || 
                              fullContent.includes('[finish-end]');
        
        if (hasFinishToken) {
          console.log('🎯 Finish token detected! Setting progress to 100%');
          setProgress(100);
        }
        
        // Show only clean content during typewriter effect (remove finish tokens)
        const finishStartIndex = fullContent.indexOf('[finish-start]');
        const displayContent = finishStartIndex === -1 ? fullContent : fullContent.slice(0, finishStartIndex).trim();
        await simulateTypewriter(displayContent, aiMessageId);
        
        // After typewriter is done, update with full content for parsing
        setMessages(prev => prev.map(msg => 
          msg.id === aiMessageId 
            ? { ...msg, content: fullContent }
            : msg
        ));
        
        // Evaluate progress after response is complete (unless finish token detected)
        if (!hasFinishToken) {
          const updatedMessages = [...messages, userMessage, { ...aiMessage, content: fullContent }];
          await evaluateProgress(sessionId, updatedMessages);
        }
        
        return;
      }

      // Browser streaming (if ReadableStream is available)
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'content') {
                fullContent += data.content;
                // Update the AI message content incrementally (UI will clean for display)
                setMessages(prev => prev.map(msg => 
                  msg.id === aiMessageId 
                    ? { ...msg, content: fullContent }
                    : msg
                ));
              } else if (data.type === 'done') {
                // Check for finish tokens
                const hasFinishToken = fullContent.includes('[finish-start]') || 
                                      fullContent.includes('[finish-end]');
                
                if (hasFinishToken) {
                  console.log('🎯 Finish token detected! Setting progress to 100%');
                  setProgress(100);
                } else {
                  // Evaluate progress after response is complete
                  const updatedMessages = [...messages, userMessage, { ...aiMessage, content: fullContent }];
                  await evaluateProgress(sessionId, updatedMessages);
                }
                break;
              } else if (data.type === 'error') {
                console.error('Streaming error:', data.error);
                throw new Error(data.error || 'Streaming error occurred');
              }
            } catch (parseError) {
              console.error('Error parsing streaming data:', parseError);
              // Continue processing other lines
            }
          }
        }
      }
    } catch (err) {
      console.error('AI coaching error:', err);
      
      // Don't show error if request was aborted
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }

      const errorMessage = err instanceof Error ? err.message : 'Failed to get AI response';
      setError(errorMessage);

      // Add error message to chat
      const errorChatMessage: CoachingMessage = {
        id: (Date.now() + 2).toString(),
        role: 'assistant',
        content: `Sorry, I encountered an error: ${errorMessage}.\nPlease try again.`,
        timestamp: new Date(),
        isError: true,
        originalUserMessage: content.trim()
      };

      setMessages(prev => [...prev, errorChatMessage]);
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [messages, getToken, progress]);

  const resendMessage = useCallback(async (messageId: string, sessionId: string, options?: { sessionType?: string; sessionDuration?: number }) => {
    // Find the error message to resend
    const errorMessage = messages.find(msg => msg.id === messageId && msg.isError);
    if (!errorMessage || !errorMessage.originalUserMessage) {
      console.error('Error message not found or missing original content');
      return;
    }

    // Remove the error message from the chat
    setMessages(prev => prev.filter(msg => msg.id !== messageId));

    // Resend the original user message
    await sendMessage(errorMessage.originalUserMessage, sessionId, options);
  }, [messages, sendMessage]);

  const clearMessages = useCallback(() => {
    // Track coaching completion
    if (messages.length > 0) {
      const userMessages = messages.filter(m => m.role === 'user');
      const totalContentLength = userMessages.reduce((total, msg) => total + msg.content.length, 0);
      
      trackCoachingCompletion({
        modelId: 'mobile-coaching',
        variant: 'text',
        contentLength: totalContentLength,
        hasOptions: false,
        optionCount: userMessages.length,
      });
    }
    
    setMessages([]);
    setError(null);
    setProgress(0);
  }, [messages, trackCoachingCompletion]);

  const setMessagesCallback = useCallback((newMessages: CoachingMessage[]) => {
    setMessages(newMessages);
  }, []);

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      console.log('🛑 Stopping AI generation...');
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  }, []);

  return {
    messages,
    isLoading,
    error,
    progress,
    sendMessage,
    resendMessage,
    clearMessages,
    setMessages: setMessagesCallback,
    stopGeneration
  };
} 