import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react';
import { useState } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, useColorScheme } from 'react-native';
import Markdown from 'react-native-markdown-display';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    coachingBlock: {
      insertCoachingBlock: (content: string, variant?: 'text' | 'buttons' | 'multi-select', options?: string[], thinking?: string) => ReturnType;
    };
  }
}

interface CoachingBlockData {
  content: string;
  variant: 'text' | 'buttons' | 'multi-select';
  options?: string[];
  thinking?: string;
}

const CoachingBlockNodeView = ({ node }: ReactNodeViewProps) => {
  const colorScheme = useColorScheme();
  const data = node.attrs.data as CoachingBlockData || { 
    content: 'No content provided', 
    variant: 'text' 
  };
  
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [showThinking, setShowThinking] = useState(false);

  const isDark = colorScheme === 'dark';
  const styles = createStyles(isDark);

  const handleOptionSelect = (option: string) => {
    setSelectedOption(option);
    // TODO: Here you could trigger additional actions like inserting text
    // or calling an API based on the selected option
  };

  const handleMultiOptionToggle = (option: string) => {
    setSelectedOptions(prev => 
      prev.includes(option) 
        ? prev.filter(o => o !== option)
        : [...prev, option]
    );
  };

  const renderTextVariant = () => (
    <View style={styles.textContainer}>
      <Markdown style={createMarkdownStyles(isDark)}>
        {data.content}
      </Markdown>
    </View>
  );

  const renderButtonVariant = () => (
    <View style={styles.buttonContainer}>
      <Markdown style={createMarkdownStyles(isDark)}>
        {data.content}
      </Markdown>
      <View style={styles.buttonWrapper}>
        {data.options?.map((option, index) => (
          <TouchableOpacity
            key={index}
            onPress={() => handleOptionSelect(option)}
            style={[
              styles.button,
              selectedOption === option ? styles.selectedButton : styles.unselectedButton
            ]}
          >
            <Text style={[
              styles.buttonText,
              selectedOption === option ? styles.selectedButtonText : styles.unselectedButtonText
            ]}>
              {option}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderMultiSelectVariant = () => (
    <View style={styles.multiSelectContainer}>
      <Markdown style={createMarkdownStyles(isDark)}>
        {data.content}
      </Markdown>
      <View style={styles.multiSelectWrapper}>
        {data.options?.map((option, index) => (
          <TouchableOpacity
            key={index}
            onPress={() => handleMultiOptionToggle(option)}
            style={[
              styles.multiSelectButton,
              selectedOptions.includes(option) ? styles.selectedMultiSelectButton : styles.unselectedMultiSelectButton
            ]}
          >
            <View style={styles.multiSelectRow}>
              <View style={[
                styles.checkbox,
                selectedOptions.includes(option) ? styles.selectedCheckbox : styles.unselectedCheckbox
              ]}>
                {selectedOptions.includes(option) && (
                  <Text style={styles.checkmark}>✓</Text>
                )}
              </View>
              <Text style={[
                styles.multiSelectText,
                selectedOptions.includes(option) ? styles.selectedMultiSelectText : styles.unselectedMultiSelectText
              ]}>
                {option}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <NodeViewWrapper className="coaching-block-wrapper">
      <View style={styles.container}>
        {/* Sage icon */}
        <View style={styles.iconContainer}>
          <Image 
            source={require('@/assets/images/icon-sage.png')} 
            style={styles.sageIcon}
            resizeMode="contain"
          />
        </View>
        
        {/* Content based on variant */}
        {data.variant === 'text' ? renderTextVariant() : 
         data.variant === 'buttons' ? renderButtonVariant() : 
         renderMultiSelectVariant()}
        
        {/* Thinking toggle button */}
        {data.thinking && (
          <TouchableOpacity
            onPress={() => setShowThinking(!showThinking)}
            style={styles.thinkingButton}
          >
            <Text style={styles.thinkingButtonText}>?</Text>
          </TouchableOpacity>
        )}
      </View>
      
      {/* Thinking content */}
      {showThinking && data.thinking && (
        <View style={styles.thinkingContainer}>
          <View style={styles.thinkingHeader}>
            <Text style={styles.thinkingTitle}>AI Thinking</Text>
          </View>
          <Markdown style={createMarkdownStyles(isDark)}>
            {data.thinking}
          </Markdown>
        </View>
      )}
    </NodeViewWrapper>
  );
};

const createStyles = (isDark: boolean) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    gap: 12,
  },
  iconContainer: {
    marginTop: 4,
  },
  sageIcon: {
    width: 24,
    height: 24,
    opacity: 0.6,
  },
  textContainer: {
    flex: 1,
  },
  contentText: {
    fontSize: 16,
    lineHeight: 24,
    color: isDark ? '#ededed' : '#000000',
  },
  buttonContainer: {
    flex: 1,
  },
  buttonWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  button: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  selectedButton: {
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)',
    borderColor: isDark ? 'rgba(59, 130, 246, 0.7)' : 'rgba(59, 130, 246, 0.3)',
  },
  unselectedButton: {
    backgroundColor: isDark ? 'rgba(107, 114, 128, 0.5)' : 'rgba(249, 250, 251, 1)',
    borderColor: isDark ? 'rgba(107, 114, 128, 0.7)' : 'rgba(229, 231, 235, 1)',
  },
  buttonText: {
    fontSize: 14,
    textAlign: 'center',
  },
  selectedButtonText: {
    color: isDark ? 'rgba(147, 197, 253, 1)' : 'rgba(30, 64, 175, 1)',
  },
  unselectedButtonText: {
    color: isDark ? 'rgba(156, 163, 175, 1)' : 'rgba(75, 85, 99, 1)',
  },
  multiSelectContainer: {
    flex: 1,
  },
  multiSelectWrapper: {
    marginTop: 16,
    gap: 8,
  },
  multiSelectButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
  },
  selectedMultiSelectButton: {
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)',
    borderColor: isDark ? 'rgba(59, 130, 246, 0.7)' : 'rgba(59, 130, 246, 0.3)',
  },
  unselectedMultiSelectButton: {
    backgroundColor: isDark ? 'rgba(107, 114, 128, 0.5)' : 'rgba(249, 250, 251, 1)',
    borderColor: isDark ? 'rgba(107, 114, 128, 0.7)' : 'rgba(229, 231, 235, 1)',
  },
  multiSelectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedCheckbox: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  unselectedCheckbox: {
    backgroundColor: 'transparent',
    borderColor: isDark ? '#6B7280' : '#D1D5DB',
  },
  checkmark: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  multiSelectText: {
    fontSize: 14,
    flex: 1,
  },
  selectedMultiSelectText: {
    color: isDark ? 'rgba(147, 197, 253, 1)' : 'rgba(30, 64, 175, 1)',
  },
  unselectedMultiSelectText: {
    color: isDark ? 'rgba(156, 163, 175, 1)' : 'rgba(75, 85, 99, 1)',
  },
  thinkingButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: isDark ? 'rgba(107, 114, 128, 1)' : 'rgba(243, 244, 246, 1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  thinkingButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: isDark ? 'rgba(156, 163, 175, 1)' : 'rgba(75, 85, 99, 1)',
  },
  thinkingContainer: {
    marginLeft: 32,
    marginBottom: 12,
    padding: 12,
    backgroundColor: isDark ? 'rgba(107, 114, 128, 0.5)' : 'rgba(249, 250, 251, 1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(107, 114, 128, 0.7)' : 'rgba(229, 231, 235, 1)',
  },
  thinkingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  thinkingTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: isDark ? 'rgba(209, 213, 219, 1)' : 'rgba(55, 65, 81, 1)',
  },
  thinkingContent: {
    fontSize: 14,
    lineHeight: 20,
    color: isDark ? 'rgba(156, 163, 175, 1)' : 'rgba(75, 85, 99, 1)',
  },
});

const createMarkdownStyles = (isDark: boolean) => {
  return {
    body: {
      fontSize: 16,
      lineHeight: 24,
      color: isDark ? '#ededed' : '#000000',
      marginBottom: 0,
    },
    heading1: {
      fontSize: 20,
      fontWeight: '600',
      color: isDark ? '#ffffff' : '#000000',
      marginBottom: 8,
      marginTop: 0,
    },
    heading2: {
      fontSize: 18,
      fontWeight: '600',
      color: isDark ? '#ffffff' : '#000000',
      marginBottom: 6,
      marginTop: 0,
    },
    heading3: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? '#ffffff' : '#000000',
      marginBottom: 4,
      marginTop: 0,
    },
    paragraph: {
      fontSize: 16,
      lineHeight: 24,
      color: isDark ? '#ededed' : '#000000',
      marginBottom: 8,
      marginTop: 0,
    },
    strong: {
      fontWeight: '600',
      color: isDark ? '#ffffff' : '#000000',
    },
    em: {
      fontStyle: 'italic',
      color: isDark ? '#ededed' : '#000000',
    },
    code_inline: {
      backgroundColor: isDark ? '#374151' : '#F3F4F6',
      color: isDark ? '#ededed' : '#000000',
      paddingHorizontal: 4,
      paddingVertical: 2,
      borderRadius: 4,
      fontSize: 14,
      fontFamily: 'monospace',
    },
    code_block: {
      backgroundColor: isDark ? '#374151' : '#F3F4F6',
      color: isDark ? '#ededed' : '#000000',
      padding: 12,
      borderRadius: 8,
      fontSize: 14,
      fontFamily: 'monospace',
      marginBottom: 8,
    },
    bullet_list: {
      marginBottom: 8,
      marginTop: 0,
    },
    ordered_list: {
      marginBottom: 8,
      marginTop: 0,
    },
    list_item: {
      fontSize: 16,
      lineHeight: 24,
      color: isDark ? '#ededed' : '#000000',
      marginBottom: 4,
    },
    blockquote: {
      backgroundColor: isDark ? '#374151' : '#F9FAFB',
      borderLeftWidth: 4,
      borderLeftColor: isDark ? '#6B7280' : '#D1D5DB',
      paddingLeft: 12,
      paddingVertical: 8,
      marginBottom: 8,
      fontStyle: 'italic',
    },
    link: {
      color: isDark ? '#60A5FA' : '#2563EB',
      textDecorationLine: 'underline',
    },
    hr: {
      backgroundColor: isDark ? '#4B5563' : '#E5E7EB',
      height: 1,
      marginVertical: 16,
    },
  } as any;
};

export const CoachingBlockExtension = Node.create({
  name: 'coachingBlock',
  
  group: 'block',
  
  content: '',
  
  atom: true,
  
  isolating: true,
  
  addAttributes() {
    return {
      data: {
        default: { content: '', variant: 'text' },
        parseHTML: element => {
          const dataAttr = element.getAttribute('data-coaching-block');
          return dataAttr ? JSON.parse(dataAttr) : { content: '', variant: 'text' };
        },
        renderHTML: attributes => {
          if (!attributes.data) {
            return {};
          }
          return {
            'data-coaching-block': JSON.stringify(attributes.data),
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="coaching-block"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 
        'data-type': 'coaching-block',
        'data-coaching-block': JSON.stringify(node.attrs.data)
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CoachingBlockNodeView);
  },

  addCommands() {
    return {
      insertCoachingBlock:
        (content: string, variant: 'text' | 'buttons' | 'multi-select' = 'text', options?: string[], thinking?: string) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { 
              data: { 
                content, 
                variant, 
                options: (variant === 'buttons' || variant === 'multi-select') ? options : undefined,
                thinking
              } 
            },
          });
        },
    };
  },
});