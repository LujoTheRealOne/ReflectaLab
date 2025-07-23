import { JournalEntry } from './journal';

/**
 * Coaching interaction request and response types
 */
export type CoachingInteractionRequest = {
  entryId: string;
  entryContent: string;
};

export type CoachingInteractionResponse = {
  success: boolean;
  coachingBlock?: {
    content: string;
    variant: 'text' | 'buttons' | 'multi-select';
    options?: string[];
    thinking?: string;
  };
  error?: string;
};

/**
 * Extended context for coaching interactions
 */
export type CoachingContext = {
  entryId: string;
  entryContent: string;
  userId: string;
  entryCount: number;
  userAlignment?: string;
  recentEntries?: JournalEntry[];
  formattedRecentEntries?: string;
};

/**
 * Model identification and metadata
 */
export type ModelInfo = {
  id: string;
  name: string;
  description: string;
  version: string;
};

/**
 * Base interface for all coaching models
 */
export interface CoachingModel {
  getInfo(): ModelInfo;
  canHandle(context: CoachingContext): boolean;
  generateSystemPrompt(): string;
  generateContextMessage(context: CoachingContext): string;
  processResponse?(response: string): unknown;
}

/**
 * Model routing decision
 */
export type ModelRoutingDecision = {
  modelId: string;
  reason: string;
  confidence: number; // 0-1 score
};

/**
 * AI Chat types
 */
export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
};

export type AIMode = 'dive-deeper' | 'reflect-back' | 'scrutinize-thinking';

/**
 * Streaming response events
 */
export type StreamingEventType = 'content' | 'thinking' | 'metadata' | 'done' | 'error';

export interface StreamingEvent {
  type: StreamingEventType;
  content?: string;
  thinking?: string;
  metadata?: Record<string, unknown>;
  model?: string;
} 