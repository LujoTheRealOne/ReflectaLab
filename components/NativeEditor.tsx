import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  NativeSyntheticEvent,
  TextInputSelectionChangeEventData,
  Platform,
} from 'react-native';
import { Bold, Italic, AlignLeft, AlignCenter, AlignRight, List } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from 'react-native';

// Define format types
type FormatType = 'bold' | 'italic' | 'align-left' | 'align-center' | 'align-right' | 'list';

// Define the format state for tracking
interface FormatState {
  bold: boolean;
  italic: boolean;
  'align-left': boolean;
  'align-center': boolean;
  'align-right': boolean;
  list: boolean;
}

interface NativeEditorProps {
  content: string;
  onUpdate: (content: string) => void;
  isLoaded: (loaded: boolean) => void;
}

const NativeEditor: React.FC<NativeEditorProps> = ({ content, onUpdate, isLoaded }) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  
  // State for the raw text content
  const [text, setText] = useState('');
  // State for the current selection
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  // State for tracking active formats
  const [activeFormats, setActiveFormats] = useState<FormatState>({
    bold: false,
    italic: false,
    'align-left': true,
    'align-center': false,
    'align-right': false,
    list: false,
  });

  // Reference to the TextInput
  const inputRef = useRef<TextInput>(null);

  // Parse HTML content on initial load
  useEffect(() => {
    // Simple HTML parser to extract text
    if (content) {
      // Remove HTML tags for now - in a real implementation you'd parse this properly
      const plainText = content.replace(/<[^>]*>/g, '');
      setText(plainText);
    }
    
    // Signal that the editor is loaded
    isLoaded(true);
  }, [content]);

  // Handle content changes
  const handleChangeText = (newText: string) => {
    setText(newText);
    
    // Convert to HTML-like format for storage
    // This is simplified - a real implementation would track formatting per character
    let htmlContent = newText;
    
    if (activeFormats.bold) {
      htmlContent = `<strong>${htmlContent}</strong>`;
    }
    
    if (activeFormats.italic) {
      htmlContent = `<em>${htmlContent}</em>`;
    }
    
    if (activeFormats['align-center']) {
      htmlContent = `<div style="text-align: center">${htmlContent}</div>`;
    } else if (activeFormats['align-right']) {
      htmlContent = `<div style="text-align: right">${htmlContent}</div>`;
    }
    
    if (activeFormats.list) {
      // Convert lines to list items
      const lines = htmlContent.split('\n');
      const listItems = lines.map(line => `<li>${line}</li>`).join('');
      htmlContent = `<ul>${listItems}</ul>`;
    }
    
    // Wrap in paragraph if not already formatted
    if (!activeFormats.bold && !activeFormats.italic && 
        !activeFormats['align-center'] && !activeFormats['align-right'] && 
        !activeFormats.list) {
      htmlContent = `<p>${htmlContent}</p>`;
    }
    
    // Notify parent of update
    onUpdate(htmlContent);
  };

  // Handle selection change
  const handleSelectionChange = (event: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
    setSelection(event.nativeEvent.selection);
    
    // In a real implementation, you would check what formats apply at the current selection
  };

  // Toggle format
  const toggleFormat = (format: FormatType) => {
    if (format === 'align-left' || format === 'align-center' || format === 'align-right') {
      // For alignment, only one can be active at a time
      setActiveFormats(prev => ({
        ...prev,
        'align-left': format === 'align-left',
        'align-center': format === 'align-center',
        'align-right': format === 'align-right',
      }));
    } else {
      // For other formats, just toggle the current state
      setActiveFormats(prev => ({
        ...prev,
        [format]: !prev[format],
      }));
    }
    
    // Focus back on the input
    inputRef.current?.focus();
  };

  // Render format button
  const FormatButton = ({ format, icon }: { format: FormatType; icon: React.ReactNode }) => (
    <TouchableOpacity
      style={[
        styles.formatButton,
        activeFormats[format] ? { backgroundColor: colors.tint + '20' } : null,
      ]}
      onPress={() => toggleFormat(format)}
    >
      {icon}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Formatting toolbar */}
      <View style={[styles.toolbar, { borderBottomColor: colors.text + '20' }]}>
        <FormatButton
          format="bold"
          icon={<Bold size={18} color={activeFormats.bold ? colors.tint : colors.text} />}
        />
        <FormatButton
          format="italic"
          icon={<Italic size={18} color={activeFormats.italic ? colors.tint : colors.text} />}
        />
        <FormatButton
          format="align-left"
          icon={<AlignLeft size={18} color={activeFormats['align-left'] ? colors.tint : colors.text} />}
        />
        <FormatButton
          format="align-center"
          icon={<AlignCenter size={18} color={activeFormats['align-center'] ? colors.tint : colors.text} />}
        />
        <FormatButton
          format="align-right"
          icon={<AlignRight size={18} color={activeFormats['align-right'] ? colors.tint : colors.text} />}
        />
        <FormatButton
          format="list"
          icon={<List size={18} color={activeFormats.list ? colors.tint : colors.text} />}
        />
      </View>

      {/* Text input area */}
      <ScrollView style={styles.editorContainer}>
        <TextInput
          ref={inputRef}
          style={[
            styles.input,
            {
              color: colors.text,
              textAlign: activeFormats['align-center'] 
                ? 'center' 
                : activeFormats['align-right'] 
                  ? 'right' 
                  : 'left',
              fontWeight: activeFormats.bold ? 'bold' : 'normal',
              fontStyle: activeFormats.italic ? 'italic' : 'normal',
            },
          ]}
          multiline
          value={text}
          onChangeText={handleChangeText}
          onSelectionChange={handleSelectionChange}
          placeholder="Start writing..."
          placeholderTextColor={colors.text + '50'}
          autoCapitalize="sentences"
          autoCorrect={true}
          spellCheck={true}
          keyboardType="default"
          returnKeyType="default"
          textAlignVertical="top"
        />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  toolbar: {
    flexDirection: 'row',
    padding: 8,
    borderBottomWidth: 1,
    marginBottom: 10,
  },
  formatButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  editorContainer: {
    flex: 1,
  },
  input: {
    flex: 1,
    padding: 10,
    fontSize: 16,
    lineHeight: 24,
    minHeight: 200,
    textAlignVertical: 'top',
  },
});

export default NativeEditor;