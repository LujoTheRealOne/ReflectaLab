/**
 * Voice API Service for OpenAI Realtime API integration
 * 
 * This service handles the backend communication for voice mode,
 * including WebSocket URL generation and session management.
 */

export interface VoiceSession {
  sessionId: string;
  userId: string;
  wsUrl: string;
  createdAt: Date;
  status: 'active' | 'ended';
}

export interface VoiceConnectionRequest {
  sessionId: string;
  userId: string;
}

export interface VoiceConnectionResponse {
  wsUrl: string;
  sessionId: string;
  expiresAt: string;
}

class VoiceApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.EXPO_PUBLIC_API_URL || '';
  }

  /**
   * Request a WebSocket URL for OpenAI Realtime API connection
   * This should be handled by your backend to keep the OpenAI API key secure
   */
  async requestVoiceConnection(
    request: VoiceConnectionRequest,
    authToken: string
  ): Promise<VoiceConnectionResponse> {
    try {
      const response = await fetch(`${this.baseUrl}api/voice/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Voice connection request failed: ${response.status} - ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to request voice connection:', error);
      throw error;
    }
  }

  /**
   * End a voice session
   */
  async endVoiceSession(
    sessionId: string,
    authToken: string
  ): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}api/voice/sessions/${sessionId}/end`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`Failed to end voice session: ${response.status} - ${errorText}`);
        // Don't throw error here as session might already be ended
      }
    } catch (error) {
      console.error('Failed to end voice session:', error);
      // Don't throw error here as it's not critical
    }
  }

  /**
   * Save voice conversation transcript
   */
  async saveVoiceTranscript(
    sessionId: string,
    messages: Array<{
      role: 'user' | 'assistant';
      content: string;
      timestamp: string;
    }>,
    authToken: string
  ): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}api/voice/sessions/${sessionId}/transcript`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ messages }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to save voice transcript: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      console.error('Failed to save voice transcript:', error);
      throw error;
    }
  }

  /**
   * Get voice session history
   */
  async getVoiceSessionHistory(
    userId: string,
    authToken: string,
    limit: number = 10
  ): Promise<VoiceSession[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}api/voice/sessions?userId=${userId}&limit=${limit}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get voice session history: ${response.status} - ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to get voice session history:', error);
      throw error;
    }
  }
}

export const voiceApiService = new VoiceApiService();

/**
 * Backend API Endpoints that need to be implemented:
 * 
 * POST /api/voice/connect
 * - Creates a secure WebSocket connection to OpenAI Realtime API
 * - Returns WebSocket URL with temporary authentication
 * - Body: { sessionId: string, userId: string }
 * - Response: { wsUrl: string, sessionId: string, expiresAt: string }
 * 
 * POST /api/voice/sessions/:sessionId/end
 * - Ends a voice session and cleans up resources
 * - Body: empty
 * - Response: { success: boolean }
 * 
 * POST /api/voice/sessions/:sessionId/transcript
 * - Saves the conversation transcript from voice session
 * - Body: { messages: Array<{ role, content, timestamp }> }
 * - Response: { success: boolean }
 * 
 * GET /api/voice/sessions?userId=:userId&limit=:limit
 * - Gets voice session history for a user
 * - Response: Array<VoiceSession>
 * 
 * Implementation Notes:
 * 1. The backend should use the OpenAI API key securely
 * 2. WebSocket URLs should have temporary authentication tokens
 * 3. Voice sessions should be linked to coaching sessions
 * 4. Transcripts should be saved for future reference
 * 5. Audio data should be handled securely and not stored permanently
 */

