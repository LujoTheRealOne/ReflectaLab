interface LogLevel {
  ERROR: 'error';
  WARN: 'warn';
  INFO: 'info';
  DEBUG: 'debug';
}

interface LogEntry {
  dt: string;
  message: string;
  level?: string;
  context?: string;
  userId?: string;
  sessionId?: string;
  errorType?: string;
  stackTrace?: string;
  metadata?: Record<string, any>;
}

class BetterStackLogger {
  private baseUrl: string;
  private authToken: string;
  private isEnabled: boolean;

  constructor() {
    // BetterStack configuration from environment variables
    this.baseUrl = process.env.EXPO_PUBLIC_BETTERSTACK_URL || 'https://s1514125.eu-nbg-2.betterstackdata.com';
    this.authToken = process.env.EXPO_PUBLIC_BETTERSTACK_TOKEN || 'ggLirjUPJ7CMSZSUwS3yuwJQ';
    
    // Enable in production or when explicitly enabled via env var
    const forceEnabled = process.env.EXPO_PUBLIC_BETTERSTACK_ENABLED === 'true';
    this.isEnabled = forceEnabled || !__DEV__;
    
    if (__DEV__ && this.isEnabled) {
      console.log('📊 [BetterStack] Logging enabled in development mode');
    }
  }

  private getCurrentTimestamp(): string {
    return new Date().toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC');
  }

  private async sendLog(logEntry: LogEntry): Promise<void> {
    if (!this.isEnabled) {
      // In development, just console log
      console.log('📊 [BetterStack Dev]', logEntry);
      return;
    }

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authToken}`,
        },
        body: JSON.stringify({
          dt: logEntry.dt,
          message: logEntry.message,
          level: logEntry.level || 'info',
          context: logEntry.context,
          userId: logEntry.userId,
          sessionId: logEntry.sessionId,
          errorType: logEntry.errorType,
          stackTrace: logEntry.stackTrace,
          metadata: logEntry.metadata,
        }),
      });

      if (!response.ok) {
        console.error('❌ [BetterStack] Failed to send log:', response.status, response.statusText);
      } else {
        console.log('✅ [BetterStack] Log sent successfully');
      }
    } catch (error) {
      console.error('❌ [BetterStack] Error sending log:', error);
    }
  }

  // Log coaching-specific errors
  async logCoachingError(error: Error, context: {
    userId?: string;
    sessionId?: string;
    messageId?: string;
    errorType?: 'network' | 'auth' | 'server' | 'unknown' | 'retry_failed';
    userMessage?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    const logEntry: LogEntry = {
      dt: this.getCurrentTimestamp(),
      message: `[COACHING ERROR] ${error.message}`,
      level: 'error',
      context: 'CoachingScreen',
      userId: context.userId,
      sessionId: context.sessionId,
      errorType: context.errorType || 'unknown',
      stackTrace: error.stack,
      metadata: {
        messageId: context.messageId,
        userMessage: context.userMessage?.substring(0, 100), // Limit user message length
        errorName: error.name,
        timestamp: new Date().toISOString(),
        ...context.metadata,
      },
    };

    await this.sendLog(logEntry);
  }

  // Log coaching session events
  async logCoachingSession(event: 'started' | 'completed' | 'error', context: {
    userId?: string;
    sessionId?: string;
    duration?: number;
    messageCount?: number;
    wordsWritten?: number;
    metadata?: Record<string, any>;
  }): Promise<void> {
    const logEntry: LogEntry = {
      dt: this.getCurrentTimestamp(),
      message: `[COACHING SESSION] Session ${event}`,
      level: event === 'error' ? 'error' : 'info',
      context: 'CoachingSession',
      userId: context.userId,
      sessionId: context.sessionId,
      metadata: {
        event,
        duration: context.duration,
        messageCount: context.messageCount,
        wordsWritten: context.wordsWritten,
        timestamp: new Date().toISOString(),
        ...context.metadata,
      },
    };

    await this.sendLog(logEntry);
  }

  // Log AI response errors
  async logAIResponseError(error: Error, context: {
    userId?: string;
    sessionId?: string;
    userMessage?: string;
    responseTime?: number;
    retryAttempt?: number;
    metadata?: Record<string, any>;
  }): Promise<void> {
    const logEntry: LogEntry = {
      dt: this.getCurrentTimestamp(),
      message: `[AI RESPONSE ERROR] ${error.message}`,
      level: 'error',
      context: 'AIResponse',
      userId: context.userId,
      sessionId: context.sessionId,
      errorType: this.determineErrorType(error.message),
      stackTrace: error.stack,
      metadata: {
        userMessage: context.userMessage?.substring(0, 100),
        responseTime: context.responseTime,
        retryAttempt: context.retryAttempt,
        errorName: error.name,
        timestamp: new Date().toISOString(),
        ...context.metadata,
      },
    };

    await this.sendLog(logEntry);
  }

  // Log error boundary catches
  async logErrorBoundary(error: Error, errorInfo: any, context: {
    userId?: string;
    sessionId?: string;
    componentStack?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    const logEntry: LogEntry = {
      dt: this.getCurrentTimestamp(),
      message: `[ERROR BOUNDARY] ${error.message}`,
      level: 'error',
      context: 'ErrorBoundary',
      userId: context.userId,
      sessionId: context.sessionId,
      stackTrace: error.stack,
      metadata: {
        componentStack: errorInfo.componentStack,
        errorName: error.name,
        timestamp: new Date().toISOString(),
        ...context.metadata,
      },
    };

    await this.sendLog(logEntry);
  }

  // Log general info events
  async logInfo(message: string, context: {
    userId?: string;
    sessionId?: string;
    category?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    const logEntry: LogEntry = {
      dt: this.getCurrentTimestamp(),
      message: `[INFO] ${message}`,
      level: 'info',
      context: context.category || 'General',
      userId: context.userId,
      sessionId: context.sessionId,
      metadata: {
        timestamp: new Date().toISOString(),
        ...context.metadata,
      },
    };

    await this.sendLog(logEntry);
  }

  // Determine error type from error message
  private determineErrorType(errorMessage: string): string {
    const lowerMessage = errorMessage.toLowerCase();
    
    if (lowerMessage.includes('auth') || lowerMessage.includes('unauthorized') || lowerMessage.includes('401')) {
      return 'auth';
    }
    if (lowerMessage.includes('network') || lowerMessage.includes('fetch') || lowerMessage.includes('connection')) {
      return 'network';
    }
    if (lowerMessage.includes('server') || lowerMessage.includes('500') || lowerMessage.includes('502') || lowerMessage.includes('503')) {
      return 'server';
    }
    if (lowerMessage.includes('timeout') || lowerMessage.includes('408')) {
      return 'timeout';
    }
    if (lowerMessage.includes('rate limit') || lowerMessage.includes('429')) {
      return 'rate_limit';
    }
    
    return 'unknown';
  }

  // Enable/disable logging (useful for testing)
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  // Check if logging is enabled
  isLoggingEnabled(): boolean {
    return this.isEnabled;
  }
}

// Export singleton instance
export const betterStackLogger = new BetterStackLogger();

// Export types for use in other files
export type { LogEntry };
