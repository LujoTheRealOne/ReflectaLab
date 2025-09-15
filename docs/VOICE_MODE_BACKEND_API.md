# Voice Mode Backend API Implementation Guide

This document provides the backend API endpoints needed to support the Voice Mode feature using OpenAI's Realtime API.

## Required Environment Variables

```bash
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_REALTIME_API_URL=wss://api.openai.com/v1/realtime
```

## API Endpoints

### 1. POST /api/voice/connect

Creates a secure WebSocket connection to OpenAI Realtime API.

**Request:**
```json
{
  "sessionId": "uuid-string",
  "userId": "firebase-user-id"
}
```

**Response:**
```json
{
  "wsUrl": "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01",
  "sessionId": "uuid-string",
  "expiresAt": "2024-01-01T12:00:00Z"
}
```

**Implementation Example (Node.js/Express):**
```javascript
app.post('/api/voice/connect', authenticateUser, async (req, res) => {
  try {
    const { sessionId, userId } = req.body;
    
    // Validate user authentication
    if (req.user.uid !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Create WebSocket URL with OpenAI API key
    const wsUrl = `wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01`;
    
    // Store session in database
    await db.collection('voiceSessions').doc(sessionId).set({
      userId,
      status: 'active',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
    });

    res.json({
      wsUrl,
      sessionId,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
    });
  } catch (error) {
    console.error('Voice connect error:', error);
    res.status(500).json({ error: 'Failed to create voice connection' });
  }
});
```

### 2. POST /api/voice/sessions/:sessionId/end

Ends a voice session and cleans up resources.

**Request:** Empty body

**Response:**
```json
{
  "success": true
}
```

**Implementation Example:**
```javascript
app.post('/api/voice/sessions/:sessionId/end', authenticateUser, async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    // Update session status
    await db.collection('voiceSessions').doc(sessionId).update({
      status: 'ended',
      endedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Voice session end error:', error);
    res.status(500).json({ error: 'Failed to end voice session' });
  }
});
```

### 3. POST /api/voice/sessions/:sessionId/transcript

Saves the conversation transcript from voice session.

**Request:**
```json
{
  "messages": [
    {
      "role": "user",
      "content": "Hello, I need help with my goals",
      "timestamp": "2024-01-01T12:00:00Z"
    },
    {
      "role": "assistant", 
      "content": "I'd be happy to help you with your goals. What specific area would you like to focus on?",
      "timestamp": "2024-01-01T12:00:05Z"
    }
  ]
}
```

**Response:**
```json
{
  "success": true
}
```

**Implementation Example:**
```javascript
app.post('/api/voice/sessions/:sessionId/transcript', authenticateUser, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { messages } = req.body;
    
    // Validate session belongs to user
    const session = await db.collection('voiceSessions').doc(sessionId).get();
    if (!session.exists || session.data().userId !== req.user.uid) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Save transcript
    await db.collection('voiceTranscripts').doc(sessionId).set({
      sessionId,
      userId: req.user.uid,
      messages,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Voice transcript save error:', error);
    res.status(500).json({ error: 'Failed to save transcript' });
  }
});
```

### 4. GET /api/voice/sessions

Gets voice session history for a user.

**Query Parameters:**
- `userId`: Firebase user ID
- `limit`: Number of sessions to return (default: 10)

**Response:**
```json
[
  {
    "sessionId": "uuid-string",
    "userId": "firebase-user-id",
    "status": "ended",
    "createdAt": "2024-01-01T12:00:00Z",
    "endedAt": "2024-01-01T12:15:00Z"
  }
]
```

## WebSocket Connection Handling

The client will connect to the OpenAI Realtime API WebSocket directly using the URL provided by your backend. You need to ensure:

1. **Authentication**: The WebSocket URL should include proper authentication headers
2. **Rate Limiting**: Implement rate limiting for voice connections
3. **Session Management**: Track active sessions and clean up expired ones
4. **Error Handling**: Handle WebSocket connection errors gracefully

## OpenAI Realtime API Integration

### WebSocket Authentication

When creating the WebSocket connection, include the OpenAI API key in the headers:

```javascript
const headers = {
  'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
  'OpenAI-Beta': 'realtime=v1'
};
```

### Session Configuration

Send initial configuration when WebSocket opens:

```javascript
const sessionConfig = {
  type: 'session.update',
  session: {
    modalities: ['text', 'audio'],
    instructions: 'You are a helpful AI coach. Speak naturally and provide supportive guidance.',
    voice: 'alloy',
    input_audio_format: 'pcm16',
    output_audio_format: 'pcm16',
    input_audio_transcription: {
      model: 'whisper-1'
    }
  }
};
```

## Security Considerations

1. **API Key Protection**: Never expose OpenAI API keys to the client
2. **User Authentication**: Verify user identity for all voice operations
3. **Session Validation**: Ensure users can only access their own voice sessions
4. **Rate Limiting**: Implement rate limiting to prevent abuse
5. **Data Privacy**: Handle voice data according to privacy regulations
6. **Session Expiry**: Automatically clean up expired sessions

## Database Schema

### Voice Sessions Collection

```javascript
{
  sessionId: string,
  userId: string,
  status: 'active' | 'ended',
  createdAt: Timestamp,
  endedAt?: Timestamp,
  expiresAt: Timestamp
}
```

### Voice Transcripts Collection

```javascript
{
  sessionId: string,
  userId: string,
  messages: Array<{
    role: 'user' | 'assistant',
    content: string,
    timestamp: string
  }>,
  createdAt: Timestamp
}
```

## Testing

Use tools like Postman or curl to test the API endpoints:

```bash
# Test voice connection
curl -X POST http://localhost:3000/api/voice/connect \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"sessionId":"test-session","userId":"test-user"}'

# Test session end
curl -X POST http://localhost:3000/api/voice/sessions/test-session/end \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Deployment Notes

1. Ensure your server supports WebSocket connections
2. Configure CORS for your React Native app domain
3. Set up proper SSL certificates for production
4. Monitor OpenAI API usage and costs
5. Implement logging for debugging voice sessions

