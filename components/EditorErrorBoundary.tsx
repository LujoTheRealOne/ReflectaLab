import React, { Component, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useColorScheme } from 'react-native';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class EditorErrorBoundaryClass extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    console.error('Editor Error Boundary caught error:', error);
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Editor Error Boundary details:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Editor Error</Text>
          <Text style={styles.errorMessage}>
            The editor encountered an error. Please try restarting the app.
          </Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => this.setState({ hasError: false, error: undefined })}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

export default function EditorErrorBoundary({ children, fallback }: Props) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  return (
    <EditorErrorBoundaryClass 
      fallback={fallback || (
        <View style={[styles.errorContainer, { backgroundColor: isDark ? '#1f1f1f' : '#ffffff' }]}>
          <Text style={[styles.errorTitle, { color: isDark ? '#ffffff' : '#000000' }]}>
            Editor Loading Error
          </Text>
          <Text style={[styles.errorMessage, { color: isDark ? '#cccccc' : '#666666' }]}>
            The journal editor is temporarily unavailable. Please restart the app to continue writing.
          </Text>
        </View>
      )}
    >
      {children}
    </EditorErrorBoundaryClass>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    minHeight: 200,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
  },
  errorMessage: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
});
