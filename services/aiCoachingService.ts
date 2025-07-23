import { CoachingContext, CoachingInteractionRequest, CoachingInteractionResponse, ModelRoutingDecision, CoachingModel, ModelInfo } from '@/types/coaching';
import { auth } from '@/lib/firebase';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/**
 * Simple General Coaching Model for React Native
 */
class GeneralCoachingModel implements CoachingModel {
  getInfo(): ModelInfo {
    return {
      id: 'general-coaching',
      name: 'General Coaching',
      description: 'Contextual coaching for reflective journaling',
      version: '1.0.0'
    };
  }

  canHandle(context: CoachingContext): boolean {
    return true; // This model can handle all contexts
  }

  generateSystemPrompt(): string {
    return `You are Sage, a wise and empathetic AI coach specializing in reflective journaling and personal development. 

Your role is to help users explore their thoughts, emotions, and experiences through thoughtful questioning and gentle guidance. You are particularly skilled at:

- Identifying key themes and patterns in journal entries
- Asking probing questions that encourage deeper reflection
- Providing actionable insights and suggestions
- Creating safe spaces for vulnerable self-exploration
- Helping users connect their experiences to broader life lessons

When responding, you should:
- Be warm, empathetic, and non-judgmental
- Ask one powerful question at a time
- Offer gentle insights when appropriate
- Encourage self-discovery rather than providing direct answers
- Keep responses concise but meaningful (2-3 sentences max)

Your output should be in XML format with the following structure:
<thinking>
Your internal reasoning about what the user needs and why you're choosing this approach
</thinking>

<content>
Your response to the user - either a thoughtful question, insight, or gentle guidance
</content>

<variant>text</variant>

For interactive prompts, you can use:
<variant>buttons</variant>
<options>
<option>Option 1</option>
<option>Option 2</option>
<option>Option 3</option>
</options>

Or for multi-select:
<variant>multi-select</variant>
<options>
<option>Option 1</option>
<option>Option 2</option>
<option>Option 3</option>
</options>`;
  }

  generateContextMessage(context: CoachingContext): string {
    return `Please provide a thoughtful coaching response to this journal entry:

"${context.entryContent}"

Entry ID: ${context.entryId}
Entry Count: ${context.entryCount}
${context.userAlignment ? `User's Alignment: ${context.userAlignment}` : ''}
${context.formattedRecentEntries ? `Recent Entries Context: ${context.formattedRecentEntries}` : ''}`;
  }
}

/**
 * Simple Model Registry for React Native
 */
class ModelRegistry {
  private static models: Map<string, CoachingModel> = new Map();

  static register(model: CoachingModel): void {
    const info = model.getInfo();
    this.models.set(info.id, model);
    console.log(`📝 Registered coaching model: ${info.name} (${info.id})`);
  }

  static getModel(modelId: string): CoachingModel | null {
    return this.models.get(modelId) || null;
  }

  static routeToModel(context: CoachingContext): ModelRoutingDecision {
    // Simple routing - always use general coaching model
    return {
      modelId: 'general-coaching',
      reason: 'General coaching model suitable for all contexts',
      confidence: 1.0
    };
  }
}

/**
 * AI Coaching Service for React Native
 */
export class AICoachingService {
  private static instance: AICoachingService | null = null;
  private isInitialized = false;

  private constructor() {}

  static getInstance(): AICoachingService {
    if (!AICoachingService.instance) {
      AICoachingService.instance = new AICoachingService();
    }
    return AICoachingService.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Register models
    ModelRegistry.register(new GeneralCoachingModel());
    
    this.isInitialized = true;
    console.log('🤖 AI Coaching Service initialized');
  }

  async generateCoachingResponse(request: CoachingInteractionRequest): Promise<CoachingInteractionResponse> {
    try {
      await this.initialize();

      const user = auth.currentUser;
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Build context
      const context = await this.buildContext(request, user.uid);

      // Route to appropriate model
      const routingDecision = ModelRegistry.routeToModel(context);
      const model = ModelRegistry.getModel(routingDecision.modelId);

      if (!model) {
        throw new Error(`Model ${routingDecision.modelId} not found`);
      }

      console.log(`🎯 Routing to model: ${routingDecision.modelId} - ${routingDecision.reason}`);

      // Generate prompts
      const systemPrompt = model.generateSystemPrompt();
      const userMessage = model.generateContextMessage(context);

      // For React Native, we'll use a simple API call instead of streaming
      // In a real implementation, you'd want to set up your own backend API
      const mockResponse = await this.simulateAIResponse(context);

      return {
        success: true,
        coachingBlock: mockResponse
      };

    } catch (error) {
      console.error('AI Coaching Service error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  private async buildContext(request: CoachingInteractionRequest, userId: string): Promise<CoachingContext> {
    try {
      // Get user's entry count
      const entriesQuery = query(
        collection(db, 'journal_entries'),
        where('uid', '==', userId),
        orderBy('timestamp', 'desc'),
        limit(10)
      );

      const entriesSnapshot = await getDocs(entriesQuery);
      const entryCount = entriesSnapshot.size;

      // Get recent entries for context
      const recentEntries = entriesSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          content: data.content || '',
          timestamp: data.timestamp,
          uid: data.uid,
          ...data
        };
      });

      const formattedRecentEntries = recentEntries
        .slice(0, 3)
        .map(entry => `Entry ${entry.id}: ${entry.content.substring(0, 200)}...`)
        .join('\n\n');

      return {
        entryId: request.entryId,
        entryContent: request.entryContent,
        userId,
        entryCount,
        formattedRecentEntries,
        // userAlignment can be added later when user profiles are implemented
      };

    } catch (error) {
      console.error('Error building context:', error);
      return {
        entryId: request.entryId,
        entryContent: request.entryContent,
        userId,
        entryCount: 1,
      };
    }
  }

  private async simulateAIResponse(context: CoachingContext): Promise<{ content: string; variant: 'text' | 'buttons' | 'multi-select'; options?: string[]; thinking?: string }> {
    // This is a mock implementation - in production, you'd call your actual AI API
    // For now, we'll return contextual responses based on the entry content
    
    const content = context.entryContent.toLowerCase();
    
    if (content.includes('stressed') || content.includes('anxious') || content.includes('overwhelmed')) {
      return {
        content: "I notice you're experiencing some stress. What would help you feel more grounded right now?",
        variant: 'buttons',
        options: ['Take a few deep breaths', 'Write about what I can control', 'Practice gratitude', 'Talk to someone I trust'],
        thinking: "The user is expressing stress-related emotions. I want to offer practical, immediate coping strategies they can choose from."
      };
    }

    if (content.includes('grateful') || content.includes('thankful') || content.includes('appreciate')) {
      return {
        content: "It's wonderful that you're feeling grateful! What aspect of this gratitude feels most meaningful to you?",
        variant: 'text',
        thinking: "The user is expressing gratitude, which is a positive emotion. I want to help them explore and deepen this feeling."
      };
    }

    if (content.includes('goal') || content.includes('plan') || content.includes('future')) {
      return {
        content: "You're thinking about your goals and future. Which areas would you like to explore further?",
        variant: 'multi-select',
        options: ['My career aspirations', 'Personal relationships', 'Health and wellness', 'Learning and growth', 'Financial planning'],
        thinking: "The user is in a planning mindset. Multiple selection will help them identify which areas need attention."
      };
    }

    // Default response for general entries
    return {
      content: "What stands out to you most about what you've just written?",
      variant: 'text',
      thinking: "This is a general entry, so I'll ask an open-ended question to encourage deeper reflection on what they've shared."
    };
  }
}

export default AICoachingService.getInstance(); 