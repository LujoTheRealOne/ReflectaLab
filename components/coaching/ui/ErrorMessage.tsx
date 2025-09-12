import React from 'react';
import { View, TouchableOpacity, StyleSheet, ColorSchemeName } from 'react-native';
import { RefreshCw } from 'lucide-react-native';

interface ErrorMessageProps {
  onRetry: () => void;
  colorScheme: ColorSchemeName;
  isRetrying?: boolean;
}

export function ErrorMessage({ 
  onRetry, 
  colorScheme, 
  isRetrying = false
}: ErrorMessageProps) {

  return (
    <View style={styles.errorContainer}>
      <TouchableOpacity
        style={[
          styles.retryButton,
          {
            backgroundColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
            opacity: isRetrying ? 0.6 : 1,
          }
        ]}
        onPress={onRetry}
        disabled={isRetrying}
      >
        <RefreshCw 
          size={16} 
          color={colorScheme === 'dark' ? '#FFFFFF' : '#666666'} 
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    alignItems: 'flex-start',
    marginTop: 6,
  },
  retryButton: {
    borderRadius: 18,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
  },
});
