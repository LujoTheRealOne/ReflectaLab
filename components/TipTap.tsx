"use dom";

import React from "react";
import styles from "@/styles/tiptap.css";
import Link from "@tiptap/extension-link";
import Typography from "@tiptap/extension-typography";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useCallback, useEffect, useRef, useState } from "react";
import { Linking, useColorScheme, Modal, View, StyleSheet, Alert } from "react-native";
import Highlight from "@tiptap/extension-highlight";
import { CoachingBlockExtension } from "./CoachingBlockExtension";
import AIChatInterface from "./AIChatInterface";
import { AIMode, CoachingInteractionRequest } from "@/types/coaching";

interface EditorProps {
  content: string;
  onUpdate: (content: string) => void;
  isLoaded: (content: boolean) => void;
  getAuthToken?: () => Promise<string | null>;
  apiBaseUrl?: string;
}

export default function Editor({ content, onUpdate, isLoaded, getAuthToken, apiBaseUrl }: EditorProps) {
  const colorScheme = useColorScheme();
  const editorRef = useRef<HTMLDivElement>(null);
  const [showAIChat, setShowAIChat] = useState(false);
  const [aiMode, setAiMode] = useState<AIMode>('dive-deeper');
  const [entryId, setEntryId] = useState<string>('');
  const [isGeneratingCoaching, setIsGeneratingCoaching] = useState(false);
  
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Start writing... (Press space on a new line to get AI coaching)',
      }),
      Link.configure({
        openOnClick: false,
      }),
      Typography,
      Highlight,
      CoachingBlockExtension.configure({
        HTMLAttributes: {
          class: 'coaching-block',
        },
      }),
    ],
    content: content,
    editorProps: {
      attributes: {
        style: `
          width: 100%;
          margin: 0 auto;
          padding: 0;
          outline: none;
          border: none;
          height: 100%;
          min-height: 300px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 16px;
          color: ${colorScheme === 'dark' ? '#ffffff' : '#000000'};
          background: transparent;
        `
      },
      handleClick: (view, pos, event) => {
        const target = event.target as HTMLElement;
        if (target.tagName === 'A' && target.getAttribute('href')) {
          event.preventDefault();
          const href = target.getAttribute('href');
          if (href) {
            Linking.openURL(href);
          }
          return true;
        }
        return false;
      },
      handleKeyDown: (view, event) => {
        // Handle spacebar press to insert coaching block
        if (event.key === ' ') {
          const { state } = view;
          const { selection } = state;
          const { $from } = selection;
          
          // Check if cursor is at the start of a new line (empty paragraph)
          const currentNode = $from.parent;
          const isEmptyParagraph = currentNode.type.name === 'paragraph' && currentNode.textContent.trim() === '';
          const isAtStartOfLine = $from.parentOffset === 0;
          
          if (isEmptyParagraph && isAtStartOfLine) {
            // Generate AI coaching block
            generateCoachingBlock();
            return true; // Prevent default spacebar behavior
          }
        }

        // Handle Cmd/Ctrl + K to open AI chat
        if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
          event.preventDefault();
          setShowAIChat(true);
          return true;
        }

        return false;
      },
    },
    onUpdate: ({ editor }) => {
      const newContent = editor.getHTML();
      onUpdate(newContent);
    }
  });

  // Generate coaching block with AI using real API
  const generateCoachingBlock = useCallback(async () => {
    if (!editor || isGeneratingCoaching) return;

    setIsGeneratingCoaching(true);

    try {
      // Insert a loading coaching block first
      const success = editor.commands.insertCoachingBlock(
        "Generating coaching prompt...",
        "text",
        undefined,
        "I'm analyzing your journal entry to provide personalized coaching."
      );

      if (!success) {
        throw new Error('Failed to insert coaching block');
      }

      // Get current content for context
      const currentContent = editor.getHTML().replace(/<[^>]*>/g, ''); // Strip HTML tags
      
      // Get authentication token
      if (!getAuthToken) {
        throw new Error('Authentication not available - AI coaching is disabled');
      }
      
      const token = await getAuthToken();
      if (!token) {
        throw new Error('Authentication token not available');
      }

      // Call the real API endpoint
      if (!apiBaseUrl) {
        throw new Error('API base URL not available - coaching is disabled');
      }
      
      const apiUrl = `${apiBaseUrl}api/coaching/chat`;
      console.log('🔗 Calling API:', { 
        apiUrl,
        apiBaseUrl,
        hasToken: !!token,
        contentLength: currentContent.length 
      });

      const requestBody = {
        message: currentContent.trim() || "I'm writing in my journal.",
        sessionType: 'default-session',
        // Generate a temporary session ID for this coaching block
        sessionId: `coaching-block-${Date.now()}`
      };

      console.log('📤 Request body:', requestBody);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      console.log('📥 Response status:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`API Error: ${response.status} - ${errorText}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      // Handle streaming response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let streamedContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));
              if (data.type === 'content' && data.content) {
                streamedContent += data.content;
              } else if (data.type === 'done') {
                // Parse the XML response to extract coaching block data
                const coachingData = parseCoachingResponse(streamedContent);
                
                // Find and replace the loading coaching block
                const { state } = editor;
                const { doc } = state;
                
                let coachingBlockPos = -1;
                doc.descendants((node, pos) => {
                  if (node.type.name === 'coachingBlock' && 
                      node.attrs.data?.content === "Generating coaching prompt...") {
                    coachingBlockPos = pos;
                    return false; // Stop iteration
                  }
                });

                if (coachingBlockPos !== -1) {
                  const newCoachingBlock = state.schema.nodes.coachingBlock.create({ 
                    data: { 
                      content: coachingData.content,
                      variant: coachingData.variant,
                      options: coachingData.options,
                      thinking: coachingData.thinking
                    }
                  });
                  
                  const tr = state.tr.replaceWith(
                    coachingBlockPos, 
                    coachingBlockPos + 1, 
                    newCoachingBlock
                  );
                  
                  editor.view.dispatch(tr);
                }
                return; // Exit the function
              } else if (data.type === 'error') {
                throw new Error(data.error || 'Stream error');
              }
            } catch (parseError) {
              // Ignore invalid JSON lines
            }
          }
        }
      }

    } catch (error) {
      console.error('Error generating coaching block:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : 'Unknown',
        apiUrl: apiBaseUrl ? `${apiBaseUrl}api/coaching/chat` : 'API URL not available',
        apiBaseUrl: apiBaseUrl
      });
      
      // Replace loading block with error message
      const { state } = editor;
      const { doc } = state;
      
      let coachingBlockPos = -1;
      doc.descendants((node, pos) => {
        if (node.type.name === 'coachingBlock' && 
            node.attrs.data?.content === "Generating coaching prompt...") {
          coachingBlockPos = pos;
          return false; // Stop iteration
        }
      });

      if (coachingBlockPos !== -1) {
        const errorBlock = state.schema.nodes.coachingBlock.create({ 
          data: { 
            content: "I'm having trouble generating a coaching prompt right now. Please try again.",
            variant: "text",
            thinking: "There was an error connecting to the AI service."
          }
        });
        
        const tr = state.tr.replaceWith(
          coachingBlockPos, 
          coachingBlockPos + 1, 
          errorBlock
        );
        
        editor.view.dispatch(tr);
      }

      Alert.alert(
        'AI Coaching Error',
        'There was an error generating your coaching prompt. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsGeneratingCoaching(false);
    }
  }, [editor, getAuthToken, isGeneratingCoaching]);

  // Helper function to parse XML coaching response
  const parseCoachingResponse = (xmlContent: string) => {
    // Default values
    let content = "What stands out to you most about what you've just written?";
    let variant: 'text' | 'buttons' | 'multi-select' = 'text';
    let options: string[] | undefined;
    let thinking = "Generated coaching response";

    try {
      // Extract content
      const contentMatch = xmlContent.match(/<content>([\s\S]*?)<\/content>/);
      if (contentMatch) {
        content = contentMatch[1].trim();
      }

      // Extract variant
      const variantMatch = xmlContent.match(/<variant>([\s\S]*?)<\/variant>/);
      if (variantMatch) {
        const variantValue = variantMatch[1].trim();
        if (variantValue === 'buttons' || variantValue === 'multi-select') {
          variant = variantValue;
        }
      }

      // Extract options if variant is buttons or multi-select
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

      // Extract thinking
      const thinkingMatch = xmlContent.match(/<thinking>([\s\S]*?)<\/thinking>/);
      if (thinkingMatch) {
        thinking = thinkingMatch[1].trim();
      }
    } catch (parseError) {
      console.error('Error parsing coaching response:', parseError);
      // Use default values
    }

    return { content, variant, options, thinking };
  };

  // Insert coaching block from AI chat
  const insertCoachingBlockFromChat = useCallback((content: string, variant: 'text' | 'buttons' | 'multi-select', options?: string[], thinking?: string) => {
    if (!editor) return;

    const success = editor.commands.insertCoachingBlock(
      content,
      variant,
      options,
      thinking
    );

    if (success) {
      setShowAIChat(false);
      Alert.alert(
        'Coaching Block Inserted',
        'The coaching block has been added to your journal.',
        [{ text: 'OK' }]
      );
    }
  }, [editor]);

  // Update editor content when content prop changes
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [editor, content]);

  // Signal that editor is loaded
  useEffect(() => {
    if (editor) {
      isLoaded(true);
    }
  }, [editor, isLoaded]);

  const handleEditorClick = useCallback((event: React.MouseEvent) => {
    if (!editor) return;

    const editorElement = editor.view.dom;
    if (!editorElement) return;

    // Get the ProseMirror editor view element
    const proseMirrorElement = editorRef.current;
    if (!proseMirrorElement) return;

    // Check if click was below the ProseMirror content
    const proseMirrorRect = proseMirrorElement.getBoundingClientRect();
    const clickY = event.clientY;

    const { doc } = editor.state;
    const lastNode = doc.lastChild;

    // Always ensure there's an empty paragraph at the end for continued writing
    if (!lastNode || lastNode.type.name !== 'paragraph' || lastNode.textContent.trim() !== '') {
      editor.chain()
        .focus('end')
        .insertContent('<p></p>')
        .focus('end')
        .run();
    } else {
      // If last node is already an empty paragraph, just focus it
      editor.commands.focus('end');
    }
  }, [editor]);

  const editorStyles = {
    flex: 1,
    height: '100%',
    border: 'none',
    outline: 'none',
    background: 'transparent',
    overflow: 'auto',
  };

  return (
    <>
      <div style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column' }} ref={editorRef}>
        <style dangerouslySetInnerHTML={{ __html: styles }} />
        <EditorContent editor={editor} style={editorStyles} />
        <div
          onClick={handleEditorClick}
          style={{ flex: 1, width: '100%', minHeight: '100px' }}
        />
      </div>

      {/* AI Chat Modal */}
      <Modal
        visible={showAIChat}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAIChat(false)}
      >
        <View style={modalStyles.container}>
          <AIChatInterface
            isVisible={showAIChat}
            mode={aiMode}
            context={editor?.getHTML()?.replace(/<[^>]*>/g, '') || ''}
            entryId={entryId || `entry-${Date.now()}`}
            onClose={() => setShowAIChat(false)}
            onInsertCoachingBlock={insertCoachingBlockFromChat}
          />
        </View>
      </Modal>
    </>
  );
}

const modalStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});