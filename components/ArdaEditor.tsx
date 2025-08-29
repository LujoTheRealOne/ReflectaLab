import React, { useCallback, useEffect, useRef, useState, useImperativeHandle, forwardRef, useMemo } from 'react';
import {
  View,
  StyleSheet,
  useColorScheme,
  Platform,
  Modal,
  Alert,
  TouchableOpacity,
  Text,
  ScrollView,
  Animated,
  KeyboardAvoidingView,
  Keyboard,
} from 'react-native';
import { RichEditor, actions } from 'react-native-pell-rich-editor';
import { Colors } from '@/constants/Colors';
import AIChatInterface from './AIChatInterface';
import { AIMode } from '@/types/coaching';
import * as Crypto from 'expo-crypto';
import { useAuth } from '@/hooks/useAuth';

interface CoachingBlock {
  id: string;
  content: string;
  thinking: string;
  variant: 'text' | 'buttons' | 'multi-select';
  options?: string[];
  timestamp: number;
}

interface EditorProps {
  content: string;
  onUpdate: (content: string) => void;
  isLoaded: (loaded: boolean) => void;
  getAuthToken?: () => Promise<string | null>;
  apiBaseUrl?: string;
  keyboardHeight?: number;
  isKeyboardVisible?: boolean;
  onActiveFormatsChange?: (formats: string[]) => void;
}

export interface EditorRef {
  formatText: (formatType: string, prefix?: string, suffix?: string) => void;
  getActiveFormats: () => string[];
}

const Editor = forwardRef<EditorRef, EditorProps>(({
  content,
  onUpdate,
  isLoaded,
  getAuthToken,
  apiBaseUrl,
  keyboardHeight = 0,
  isKeyboardVisible = false,
  onActiveFormatsChange,
}, ref) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { user, userAccount } = useAuth();
  
  const [htmlContent, setHtmlContent] = useState(content || '');
  const [showAIChat, setShowAIChat] = useState(false);
  const [aiMode, setAiMode] = useState<AIMode>('dive-deeper');
  const [coachingBlocks, setCoachingBlocks] = useState<CoachingBlock[]>([]);
  const [isGeneratingCoaching, setIsGeneratingCoaching] = useState(false);
  const [activeFormats, setActiveFormats] = useState<string[]>([]);
  
  const richTextRef = useRef<RichEditor>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const formatTimeoutRef = useRef<{[key: string]: NodeJS.Timeout}>({});
  const isProcessingFormat = useRef<{[key: string]: boolean}>({});

  // Signal that editor is loaded immediately
  useEffect(() => {
    isLoaded(true);
  }, [isLoaded]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      Object.values(formatTimeoutRef.current).forEach(timeout => {
        if (timeout) clearTimeout(timeout);
      });
    };
  }, []);

  // Update HTML content when content prop changes
  useEffect(() => {
    if (content !== htmlContent) {
      setHtmlContent(content || '');
      richTextRef.current?.setContentHTML(content || '');
    }
  }, [content, htmlContent]);

  // Handle content changes from RichEditor
  const handleRichTextChange = useCallback((newHtml: string) => {
    setHtmlContent(newHtml);
    onUpdate(newHtml);
  }, [onUpdate]);

  // Manual format state tracking since RichEditor doesn't always provide it
  const [manualFormatState, setManualFormatState] = useState<{[key: string]: boolean}>({
    bold: false,
    italic: false,
    strike: false,
    heading1: false,
    bullet: false,
    number: false,
    quote: false,
  });

  // Update active formats when manual state changes
  useEffect(() => {
    const active = Object.keys(manualFormatState).filter(key => manualFormatState[key]);
    setActiveFormats(active);
    onActiveFormatsChange?.(active);
  }, [manualFormatState, onActiveFormatsChange]);

  // Reset format states when content changes (to sync with actual editor state)
  useEffect(() => {
    // Reset all manual states when content changes significantly
    // This helps sync with the actual RichEditor internal state
    if (htmlContent === '' || htmlContent === '<p></p>') {
      setManualFormatState({
        bold: false,
        italic: false,
        strike: false,
        heading1: false,
        bullet: false,
        number: false,
        quote: false,
      });
    }
  }, [htmlContent]);

  // We intentionally avoid forcing content resets here to prevent cursor jumps

  // Format text function for KeyboardToolbar
  const handleFormatText = useCallback((formatType: string, prefix?: string, suffix?: string) => {
    if (!richTextRef.current) {
      return;
    }

    // Prevent multiple rapid clicks on the same format
    if (isProcessingFormat.current[formatType]) {
      return;
    }
    
    // Set processing flag
    isProcessingFormat.current[formatType] = true;

    // Clear any existing timeout for this format
    if (formatTimeoutRef.current[formatType]) {
      clearTimeout(formatTimeoutRef.current[formatType]);
    }

    // Handle clear formatting specially
    if (formatType === 'clear') {
      try {
        if (richTextRef.current.removeFormat) {
          richTextRef.current.removeFormat();
        } else if (richTextRef.current.sendAction) {
          richTextRef.current.sendAction(actions.removeFormat, 'result');
        }
        // Clear all manual states
        setManualFormatState({
          bold: false,
          italic: false,
          strike: false,
          heading1: false,
          bullet: false,
          number: false,
          quote: false,
        });
      } catch (error) {
        console.error('🚨 Clear formatting error:', error);
      }
      
      // Reset processing flag after a delay
      formatTimeoutRef.current[formatType] = setTimeout(() => {
        isProcessingFormat.current[formatType] = false;
      }, 300);
      return;
    }

    // Toggle the format state
    const isCurrentlyActive = manualFormatState[formatType] || false;
    
    // Update manual state immediately for UI feedback
    setManualFormatState(prev => ({
      ...prev,
      [formatType]: !isCurrentlyActive
    }));


    
    // Execute the formatting command
    try {
      switch (formatType) {
        case 'bold':
          if (richTextRef.current.setBold) {
            richTextRef.current.setBold();
          } else if (richTextRef.current.sendAction) {
            richTextRef.current.sendAction(actions.setBold, 'result');
          }
          break;
        case 'italic':
          if (richTextRef.current.setItalic) {
            richTextRef.current.setItalic();
          } else if (richTextRef.current.sendAction) {
            richTextRef.current.sendAction(actions.setItalic, 'result');
          }
          break;
        case 'strike':
          if (richTextRef.current.setStrikethrough) {
            richTextRef.current.setStrikethrough();
          } else if (richTextRef.current.sendAction) {
            richTextRef.current.sendAction(actions.setStrikethrough, 'result');
          }
          break;
        case 'heading1':
          if (richTextRef.current.setHeading) {
            richTextRef.current.setHeading('h1');
          } else if (richTextRef.current.sendAction) {
            richTextRef.current.sendAction(actions.heading1, 'result');
          }
          break;
        case 'bullet':
          if (richTextRef.current.setBullets) {
            richTextRef.current.setBullets();
          } else if (richTextRef.current.sendAction) {
            richTextRef.current.sendAction(actions.insertBulletsList, 'result');
          }
          break;
        case 'number':
          if (richTextRef.current.setOrderedList) {
            richTextRef.current.setOrderedList();
          } else if (richTextRef.current.sendAction) {
            richTextRef.current.sendAction(actions.insertOrderedList, 'result');
          }
          break;
        case 'quote':
          if (richTextRef.current.setBlockquote) {
            richTextRef.current.setBlockquote();
          } else if (richTextRef.current.sendAction) {
            richTextRef.current.sendAction(actions.blockquote, 'result');
          }
          break;
      }
    } catch (error) {
      console.error('🚨 Formatting error:', error);
      // Revert the manual state if command failed
      setManualFormatState(prev => ({
        ...prev,
        [formatType]: isCurrentlyActive
      }));
    }

    // Reset processing flag after a short delay
    formatTimeoutRef.current[formatType] = setTimeout(() => {
      isProcessingFormat.current[formatType] = false;
    }, 300);
  }, [manualFormatState]);

  // Expose formatting function to parent via ref
  useImperativeHandle(ref, () => ({
    formatText: handleFormatText,
    getActiveFormats: () => activeFormats
  }));

  // Generate placeholder text
  const placeholderText = useMemo(() => {
    return `What's on your mind${
      user?.fullName ? ` ${user.fullName.split(' ')[0]}` : 
      userAccount?.firstName ? ` ${userAccount.firstName}` : 
      ''
    }?`;
  }, [user?.fullName, userAccount?.firstName]);

  // Handle coaching generation
  const generateCoachingBlock = useCallback(async () => {
    if (isGeneratingCoaching || !getAuthToken || !apiBaseUrl) return;
    
    try {
      setIsGeneratingCoaching(true);
      
      // Add loading block
      const loadingBlock: CoachingBlock = {
        id: Crypto.randomUUID(),
        content: "Thinking...",
        thinking: "Generating coaching prompt",
        variant: 'text',
        timestamp: Date.now(),
      };
      
      setCoachingBlocks(prev => [...prev, loadingBlock]);

      const token = await getAuthToken();
      if (!token) throw new Error('No auth token');

      const response = await fetch(`${apiBaseUrl}/api/ai-coaching`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          context: htmlContent,
          mode: aiMode,
        }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response reader');

      let streamedContent = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));
              if (data.type === 'content' && data.content) {
                streamedContent += data.content;
              } else if (data.type === 'done') {
                const coachingData = parseCoachingResponse(streamedContent);
                
                setCoachingBlocks(prev => 
                  prev.map(block => 
                    block.id === loadingBlock.id 
                      ? { ...block, ...coachingData }
                      : block
                  )
                );
                return;
              }
            } catch (parseError) {
              // Ignore invalid JSON lines
            }
          }
        }
      }
    } catch (error) {
      console.error('Error generating coaching block:', error);
      
      setCoachingBlocks(prev => 
        prev.map(block => 
          block.id === loadingBlock.id 
            ? {
                ...block,
                content: "I'm having trouble generating a coaching prompt right now. Please try again.",
                thinking: "There was an error connecting to the AI service.",
                variant: 'text' as const
              }
            : block
        )
      );

      Alert.alert(
        'AI Coaching Error',
        'There was an error generating your coaching prompt. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsGeneratingCoaching(false);
    }
  }, [htmlContent, getAuthToken, apiBaseUrl, isGeneratingCoaching, aiMode]);

  // Parse coaching response
  const parseCoachingResponse = (xmlContent: string) => {
    let content = "What stands out to you most about what you've just written?";
    let variant: 'text' | 'buttons' | 'multi-select' = 'text';
    let options: string[] | undefined;
    let thinking = "Generated coaching response";

    try {
      const contentMatch = xmlContent.match(/<content>([\s\S]*?)<\/content>/);
      if (contentMatch) content = contentMatch[1].trim();

      const variantMatch = xmlContent.match(/<variant>([\s\S]*?)<\/variant>/);
      if (variantMatch) {
        const variantValue = variantMatch[1].trim();
        if (variantValue === 'buttons' || variantValue === 'multi-select') {
          variant = variantValue;
        }
      }

      if (variant === 'buttons' || variant === 'multi-select') {
        const optionsMatch = xmlContent.match(/<options>([\s\S]*?)<\/options>/);
        if (optionsMatch) {
          const optionMatches = optionsMatch[1].match(/<option>([\s\S]*?)<\/option>/g);
          if (optionMatches) {
            options = optionMatches.map(match => 
              match.replace(/<\/?option>/g, '').trim()
            );
          }
        }
      }

      const thinkingMatch = xmlContent.match(/<thinking>([\s\S]*?)<\/thinking>/);
      if (thinkingMatch) thinking = thinkingMatch[1].trim();
    } catch (parseError) {
      console.error('Error parsing coaching response:', parseError);
    }

    return { content, variant, options, thinking };
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <ScrollView 
        ref={scrollViewRef}
        style={styles.scrollContainer} 
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        contentContainerStyle={{ paddingBottom: isKeyboardVisible ? 100 : 40 }}
        // Native keyboard dismiss behavior
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      >
        <View style={styles.editorStack}>
          <RichEditor
            ref={richTextRef}
            style={[styles.richEditor, { backgroundColor: colors.background }]}
            initialContentHTML={htmlContent}
            onChange={handleRichTextChange}
            // Avoid cursor-based resets that can cause jumps
            placeholder={placeholderText}
            editorStyle={{
              backgroundColor: colors.background,
              color: colors.text,
              placeholderColor: colors.tabIconDefault,
              fontSize: '16px',
              lineHeight: '24px',
              fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
              paddingLeft: '0px',
              paddingRight: '0px',
              paddingTop: '20px',
              paddingBottom: '20px',
              // Remove any default margins/paddings applied inside the web content
              cssText: `body { margin:0; padding:0; } * { caret-color: ${colors.text} !important; }`,
              contentCSSText: `margin:0; padding:0; p{margin:0;padding:0;} div{margin:0;padding:0;} * { caret-color: ${colors.text} !important; }`,
            }}

            useContainer={true}
            initialHeight={200}
          />
        </View>

        {/* Render coaching blocks */}
        {coachingBlocks.map((block) => (
          <View key={block.id} style={styles.coachingBlock}>
            <Text style={[styles.coachingContent, { color: colors.text }]}>
              {block.content}
            </Text>
            {block.variant === 'buttons' && block.options && (
              <View style={styles.buttonContainer}>
                {block.options.map((option, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[styles.optionButton, { borderColor: colors.border }]}
                    onPress={() => {
                      // Handle button press
                      setShowAIChat(true);
                    }}
                  >
                    <Text style={[styles.optionText, { color: colors.text }]}>
                      {option}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      {/* AI Chat Modal */}
      <Modal
        visible={showAIChat}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAIChat(false)}
      >
        <AIChatInterface
          onClose={() => setShowAIChat(false)}
          initialContext={htmlContent}
          mode={aiMode}
          getAuthToken={getAuthToken}
          apiBaseUrl={apiBaseUrl}
        />
      </Modal>
    </KeyboardAvoidingView>
  );
});

Editor.displayName = 'Editor';

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    flex: 1,
  },
  editorStack: {
    minHeight: 200,
    position: 'relative',
  },
  richEditor: {
    minHeight: 200,
    flex: 1,
  },
  coachingBlock: {
    marginVertical: 20,
    marginHorizontal: 0,
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    borderLeftWidth: 3,
    borderLeftColor: '#007AFF',
  },
  coachingContent: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 12,
  },
  buttonContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  optionText: {
    fontSize: 14,
    fontWeight: '500',
  },
});

export default Editor;