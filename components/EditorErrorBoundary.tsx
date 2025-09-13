import React, { Component, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useColorScheme } from 'react-native';
import { AlertTriangle, RefreshCw } from 'lucide-react-native';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: any) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: any;
  retryCount: number;
}

class EditorErrorBoundaryClass extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): State {
    // Only log critical errors in development
    if (__DEV__) {
      console.error('Editor Error Boundary caught error:', error);
    }
    return { hasError: true, error, retryCount: 0, errorInfo: undefined };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    // Enhanced error logging and reporting
    const errorDetails = {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      retryCount: this.state.retryCount
    };

    if (__DEV__) {
      console.error('Editor Error Boundary details:', errorDetails);
    }

    // Call optional error handler for production error reporting
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    this.setState({ errorInfo });
  }

  handleRetry = () => {
    const newRetryCount = this.state.retryCount + 1;
    
    // Limit retry attempts to prevent infinite loops
    if (newRetryCount > 3) {
      Alert.alert(
        'Editor Error',
        'The editor has failed multiple times. Please restart the app or contact support if the problem persists.',
        [{ text: 'OK' }]
      );
      return;
    }

    this.setState({ 
      hasError: false, 
      error: undefined, 
      errorInfo: undefined,
      retryCount: newRetryCount 
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View style={styles.errorContainer}>
          <AlertTriangle size={48} color="#FF6B6B" style={styles.errorIcon} />
          <Text style={styles.errorTitle}>Editor Error</Text>
          <Text style={styles.errorMessage}>
            {this.state.retryCount > 0 
              ? `The editor encountered an error (Attempt ${this.state.retryCount + 1}/4). Please try again.`
              : 'The editor encountered an unexpected error. This might be due to a temporary issue.'
            }
          </Text>
          {this.state.retryCount < 3 && (
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={this.handleRetry}
            >
              <RefreshCw size={16} color="#ffffff" style={styles.buttonIcon} />
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          )}
          {__DEV__ && this.state.error && (
            <View style={styles.debugContainer}>
              <Text style={styles.debugTitle}>Debug Info:</Text>
              <Text style={styles.debugText}>{this.state.error.message}</Text>
            </View>
          )}
        </View>
      );
    }

    return this.props.children;
  }
}

export default function EditorErrorBoundary({ children, fallback, onError }: Props) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  return (
    <EditorErrorBoundaryClass 
      onError={onError}
      fallback={fallback || (
        <View style={[styles.errorContainer, { backgroundColor: isDark ? '#111111' : '#ffffff' }]}>
          <AlertTriangle size={48} color={isDark ? '#FF8A8A' : '#FF6B6B'} style={styles.errorIcon} />
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
  errorIcon: {
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    maxWidth: 300,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonIcon: {
    marginRight: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  debugContainer: {
    marginTop: 20,
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    maxWidth: 300,
  },
  debugTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    color: '#666666',
  },
  debugText: {
    fontSize: 11,
    color: '#999999',
    fontFamily: 'monospace',
  },
});