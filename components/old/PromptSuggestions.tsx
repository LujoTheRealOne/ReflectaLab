import React from 'react';
import { View, ScrollView, TouchableOpacity, Text, StyleSheet } from 'react-native';

interface PromptSuggestionsProps {
  chatInput: string;
  keyboardHeight: number;
  colorScheme: 'light' | 'dark';
  onSuggestionPress: (suggestion: string) => void;
}

export default function PromptSuggestions({ 
  chatInput, 
  keyboardHeight, 
  colorScheme, 
  onSuggestionPress 
}: PromptSuggestionsProps) {
  const suggestions = [
    { label: 'Start Custom\nMeditation', value: 'Start Custom Meditation' },
    { label: 'Ask me hard\nquestions', value: 'Ask me hard questions' },
    { label: 'Help me find\nmy goal', value: 'Help me find my goal' },
    { label: 'Work through\nuncertainty', value: 'Work through uncertainty' },
  ];

  // Only show when input is empty and keyboard is closed
  if (chatInput.trim().length > 0 || keyboardHeight > 0) {
    return null;
  }

  return (
    <View style={styles.suggestionContainer}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.suggestionScrollContent}
        style={styles.suggestionScrollView}
        nestedScrollEnabled={true}
        directionalLockEnabled={true}
        alwaysBounceVertical={false}
        bounces={false}
      >
        {suggestions.map((suggestion, index) => (
          <TouchableOpacity 
            key={index}
            style={[
              styles.suggestionButton, 
              { backgroundColor: colorScheme === 'dark' ? '#333333' : '#EFEFEF' }
            ]}
            onPress={() => onSuggestionPress(suggestion.value)}
          >
            <Text style={[
              styles.suggestionButtonText, 
              { color: colorScheme === 'dark' ? '#FFFFFF' : '#000000' }
            ]}>
              {suggestion.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  suggestionContainer: {
    position: 'absolute',
    bottom: 210, // Above input
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 12,
    zIndex: 1001, // Higher than input
  },
  suggestionScrollView: {
    flexGrow: 0,
  },
  suggestionScrollContent: {
    paddingHorizontal: 0,
    gap: 8,
    alignItems: 'center',
  },
  suggestionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F2F2F2',
    borderRadius: 12,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 80,
  },
  suggestionButtonText: {
    opacity: 0.6,
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    textAlign: 'center',
  },
});
