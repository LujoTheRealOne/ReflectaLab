import React, { Component, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useColorScheme } from 'react-native';
import { AlertTriangle, RefreshCw } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: any) => void;
  onRetry?: () => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: any;
  retryCount: number;
}

class CoachingErrorBoundaryClass extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return { 
      hasError: true, 
      error, 
      retryCount: 0,
      errorInfo: undefined 
    };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    // Enhanced error logging for coaching-specific errors
    const errorDetails = {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      retryCount: this.state.retryCount,
      context: 'CoachingScreen'
    };

    console.error('🚨 [COACHING ERROR BOUNDARY] Error caught:', errorDetails);

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
      console.error('🚨 [COACHING ERROR BOUNDARY] Max retry attempts reached');
      return;
    }

    console.log(`🔄 [COACHING ERROR BOUNDARY] Retry attempt ${newRetryCount}/3`);

    // Call parent retry function if provided
    if (this.props.onRetry) {
      this.props.onRetry();
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

      // Default error UI will be rendered by the wrapper component
      return null;
    }

    return this.props.children;
  }
}

interface CoachingErrorBoundaryProps extends Props {
  colorScheme?: 'light' | 'dark';
}

const CoachingErrorBoundary = React.memo(function CoachingErrorBoundary({ 
  children, 
  fallback, 
  onError, 
  onRetry,
  colorScheme: propColorScheme 
}: CoachingErrorBoundaryProps) {
  const systemColorScheme = useColorScheme();
  const colorScheme = propColorScheme || systemColorScheme || 'light';
  const colors = Colors[colorScheme];
  
  // Memoize the error fallback to prevent unnecessary re-renders
  const errorFallback = React.useMemo(() => (
    <View style={[styles.errorContainer, { backgroundColor: colors.background }]}>
      <AlertTriangle 
        size={48} 
        color={colorScheme === 'dark' ? '#FF8A8A' : '#FF6B6B'} 
        style={styles.errorIcon} 
      />
      <Text style={[styles.errorTitle, { color: colors.text }]}>
        Coaching Session Error
      </Text>
      <Text style={[styles.errorMessage, { color: `${colors.text}80` }]}>
        Something went wrong with the coaching session. This might be a temporary network issue or server problem.
      </Text>
      <TouchableOpacity 
        style={[styles.retryButton, { backgroundColor: colors.tint }]}
        onPress={onRetry}
      >
        <RefreshCw size={16} color="#ffffff" style={styles.buttonIcon} />
        <Text style={styles.retryButtonText}>Restart Session</Text>
      </TouchableOpacity>
    </View>
  ), [colors, colorScheme, onRetry]);
  
  return (
    <CoachingErrorBoundaryClass 
      onError={onError}
      onRetry={onRetry}
      fallback={fallback || errorFallback}
    >
      {children}
    </CoachingErrorBoundaryClass>
  );
});

export default CoachingErrorBoundary;

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorIcon: {
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  buttonIcon: {
    marginRight: 4,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
});
