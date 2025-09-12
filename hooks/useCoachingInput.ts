import { useState, useRef, useCallback } from 'react';
import { TextInput, Keyboard } from 'react-native';

// Dynamic input constants
const LINE_HEIGHT = 24;
const MIN_LINES = 1;
const MAX_LINES = 10;
const EXPANDED_MAX_LINES = 18; // Maximum lines when expanded
const INPUT_PADDING_VERTICAL = 8;
const CONTAINER_BASE_HEIGHT = 90; // Minimum container height
const CONTAINER_PADDING = 40; // Total container padding (8+20+12)

interface UseCoachingInputProps {
  onSendMessage: (message: string) => void;
  onTextChange?: (text: string) => void;
}

interface UseCoachingInputReturn {
  // State
  chatInput: string;
  isChatInputFocused: boolean;
  keyboardHeight: number;
  inputHeight: number;
  containerHeight: number;
  isInputExpanded: boolean;
  currentLineCount: number;
  
  // Refs
  textInputRef: React.RefObject<TextInput>;
  
  // Functions
  setChatInput: (text: string) => void;
  setIsChatInputFocused: (focused: boolean) => void;
  setKeyboardHeight: (height: number) => void;
  setInputHeight: (height: number) => void;
  setContainerHeight: (height: number) => void;
  setIsInputExpanded: (expanded: boolean) => void;
  setCurrentLineCount: (count: number) => void;
  handleTextChange: (text: string) => void;
  handleContentSizeChange: (event: any) => void;
  handleSendMessage: () => void;
  handleExpandToggle: () => void;
  
  // Constants
  LINE_HEIGHT: number;
  MIN_LINES: number;
  MAX_LINES: number;
  EXPANDED_MAX_LINES: number;
  INPUT_PADDING_VERTICAL: number;
  CONTAINER_BASE_HEIGHT: number;
  CONTAINER_PADDING: number;
}

export const useCoachingInput = ({
  onSendMessage,
  onTextChange
}: UseCoachingInputProps): UseCoachingInputReturn => {
  
  // State
  const [chatInput, setChatInput] = useState('');
  const [isChatInputFocused, setIsChatInputFocused] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [inputHeight, setInputHeight] = useState(24); // Initial height for minimum 1 line
  const [containerHeight, setContainerHeight] = useState(90); // Dynamic container height
  const [isInputExpanded, setIsInputExpanded] = useState(false); // Expand durumu
  const [currentLineCount, setCurrentLineCount] = useState(1); // Current line count
  
  // Refs
  const textInputRef = useRef<TextInput>(null);
  
  // ========================================================================
  // TEXT INPUT HANDLING
  // ========================================================================
  const handleTextChange = useCallback((text: string) => {
    setChatInput(text);
    
    // Call optional callback
    if (onTextChange) {
      onTextChange(text);
    }
    
    // More precise calculation - word-based line wrapping
    const containerWidth = 380; // chatInputWrapper width
    const containerPadding = 16; // 8px left + 8px right padding
    const textInputPadding = 8; // 4px left + 4px right padding
    
    // First estimate the line count
    const estimatedLines = Math.max(1, text.split('\n').length);
    const isMultiLine = estimatedLines > 1 || text.length > 30; // Earlier multi-line detection
    const expandButtonSpace = isMultiLine ? 36 : 0; // Space for expand button
    const availableWidth = containerWidth - containerPadding - textInputPadding - expandButtonSpace;
    
    // Character width based on font size (fontSize: 15, fontWeight: 400)
    // More conservative calculation - extra margin for words
    const baseCharsPerLine = isMultiLine ? 36 : 42; // Fewer characters in multi-line
    const charsPerLine = baseCharsPerLine;
    
    // Line calculation - including word wrapping
    const textLines = text.split('\n');
    let totalLines = 0;
    
    textLines.forEach(line => {
      if (line.length === 0) {
        totalLines += 1; // Empty line
      } else {
        // Word-based calculation - for risk of long words wrapping
        const words = line.split(' ');
        let currentLineLength = 0;
        let linesForThisTextLine = 1;
        
        words.forEach((word, index) => {
          const wordLength = word.length;
          const spaceNeeded = index > 0 ? 1 : 0; // Space before word (except first)
          
          // If this word won't fit on current line, new line
          if (currentLineLength + spaceNeeded + wordLength > charsPerLine && currentLineLength > 0) {
            linesForThisTextLine++;
            currentLineLength = wordLength;
          } else {
            currentLineLength += spaceNeeded + wordLength;
          }
        });
        
        totalLines += linesForThisTextLine;
      }
    });
    
    // Save line count
    setCurrentLineCount(totalLines);
    
    // Min/Max limits - based on expand state
    const maxLines = isInputExpanded ? EXPANDED_MAX_LINES : MAX_LINES;
    const actualLines = Math.max(MIN_LINES, Math.min(maxLines, totalLines));
    
    // Height calculation
    const newInputHeight = actualLines * LINE_HEIGHT;
    
    // Container height - optimized for real layout
    const topPadding = 12; // TextInput top padding increased
    const bottomPadding = 8;
    const buttonHeight = 32; // Voice/Send button height
    const buttonTopPadding = 8; // Button container padding top
    
    const totalContainerHeight = topPadding + newInputHeight + buttonTopPadding + buttonHeight + bottomPadding;
    const newContainerHeight = Math.max(CONTAINER_BASE_HEIGHT, totalContainerHeight);
    
    setInputHeight(newInputHeight);
    setContainerHeight(newContainerHeight);
  }, [isInputExpanded, onTextChange]);
  
  // ========================================================================
  // CONTENT SIZE CHANGE HANDLING
  // ========================================================================
  const handleContentSizeChange = useCallback((event: any) => {
    const { height } = event.nativeEvent.contentSize;
    
    // Calculate Min/Max heights
    const minHeight = MIN_LINES * LINE_HEIGHT; // 24px
    const maxHeight = MAX_LINES * LINE_HEIGHT; // 240px
    
    // Use real content height but round to LINE_HEIGHT
    const rawHeight = Math.max(minHeight, Math.min(maxHeight, height));
    
    // Round to nearest LINE_HEIGHT multiple (multiples of 24px)
    const roundedLines = Math.round(rawHeight / LINE_HEIGHT);
    const newInputHeight = Math.max(MIN_LINES, Math.min(MAX_LINES, roundedLines)) * LINE_HEIGHT;
    
    // Container height - same calculation as handleTextChange
    const topPadding = 12; // TextInput top padding increased
    const bottomPadding = 8;
    const buttonHeight = 32; // Voice/Send button height
    const buttonTopPadding = 8; // Button container padding top
    
    const totalContainerHeight = topPadding + newInputHeight + buttonTopPadding + buttonHeight + bottomPadding;
    const newContainerHeight = Math.max(CONTAINER_BASE_HEIGHT, totalContainerHeight);
    
    setInputHeight(newInputHeight);
    setContainerHeight(newContainerHeight);
  }, []);
  
  // ========================================================================
  // SEND MESSAGE HANDLING
  // ========================================================================
  const handleSendMessage = useCallback(() => {
    const trimmedInput = chatInput.trim();
    if (trimmedInput.length === 0) return;
    
    // Send the message
    onSendMessage(trimmedInput);
    
    // Clear input
    setChatInput('');
    
    // Reset input dimensions
    setInputHeight(24);
    setContainerHeight(90);
    setCurrentLineCount(1);
    setIsInputExpanded(false);
    
    // Dismiss keyboard
    Keyboard.dismiss();
  }, [chatInput, onSendMessage]);
  
  // ========================================================================
  // EXPAND/COLLAPSE TOGGLE
  // ========================================================================
  const handleExpandToggle = useCallback(() => {
    const newExpandedState = !isInputExpanded;
    setIsInputExpanded(newExpandedState);
    
    // Recalculate height with new expand state
    handleTextChange(chatInput);
  }, [isInputExpanded, chatInput, handleTextChange]);
  
  return {
    // State
    chatInput,
    isChatInputFocused,
    keyboardHeight,
    inputHeight,
    containerHeight,
    isInputExpanded,
    currentLineCount,
    
    // Refs
    textInputRef,
    
    // Functions
    setChatInput,
    setIsChatInputFocused,
    setKeyboardHeight,
    setInputHeight,
    setContainerHeight,
    setIsInputExpanded,
    setCurrentLineCount,
    handleTextChange,
    handleContentSizeChange,
    handleSendMessage,
    handleExpandToggle,
    
    // Constants
    LINE_HEIGHT,
    MIN_LINES,
    MAX_LINES,
    EXPANDED_MAX_LINES,
    INPUT_PADDING_VERTICAL,
    CONTAINER_BASE_HEIGHT,
    CONTAINER_PADDING,
  };
};
