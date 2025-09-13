import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
  SafeAreaView,
  Animated,
  Dimensions,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Mic, MicOff, X, Phone } from 'lucide-react-native';
import { Audio } from 'expo-av';
import * as Crypto from 'expo-crypto';

import { Colors } from '@/constants/Colors';
import { AppStackParamList } from '@/navigation/AppNavigator';
import { useAuth } from '@/hooks/useAuth';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { voiceApiService } from '@/services/voiceApiService';

type VoiceModeNavigationProp = NativeStackNavigationProp<AppStackParamList, 'VoiceMode'>;

interface VoiceMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  audioUrl?: string;
}

interface RealtimeAPIConnection {
  ws: WebSocket | null;
  isConnected: boolean;
  sessionId: string;
}

// Animated conversation bubble component
const ConversationBubble = ({ 
  isActive, 
  audioLevel, 
  colorScheme 
}: { 
  isActive: boolean; 
  audioLevel: number; 
  colorScheme: any; 
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isActive) {
      // Continuous pulse animation when active
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimation.start();

      return () => pulseAnimation.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isActive, pulseAnim]);

  useEffect(() => {
    // Scale based on audio level
    const targetScale = 1 + (audioLevel * 0.3);
    Animated.timing(scaleAnim, {
      toValue: targetScale,
      duration: 100,
      useNativeDriver: true,
    }).start();
  }, [audioLevel, scaleAnim]);

  const bubbleSize = 200;
  const innerBubbleSize = 150;

  return (
    <View style={styles.bubbleContainer}>
      {/* Outer pulse ring */}
      <Animated.View
        style={[
          styles.outerBubble,
          {
            width: bubbleSize,
            height: bubbleSize,
            borderRadius: bubbleSize / 2,
            backgroundColor: colorScheme === 'dark' 
              ? 'rgba(255, 255, 255, 0.1)' 
              : 'rgba(0, 0, 0, 0.05)',
            transform: [{ scale: pulseAnim }],
          },
        ]}
      />
      
      {/* Main conversation bubble */}
      <Animated.View
        style={[
          styles.mainBubble,
          {
            width: innerBubbleSize,
            height: innerBubbleSize,
            borderRadius: innerBubbleSize / 2,
            backgroundColor: colorScheme === 'dark' ? '#333333' : '#F0F0F0',
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <View style={styles.bubbleContent}>
          <IconSymbol
            name="waveform"
            size={40}
            color={colorScheme === 'dark' ? '#FFFFFF' : '#000000'}
          />
        </View>
      </Animated.View>
    </View>
  );
};

export default function VoiceModeScreen() {
  const navigation = useNavigation<VoiceModeNavigationProp>();
  const route = useRoute();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const { firebaseUser, getToken } = useAuth();

  // Voice mode state
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isAITalking, setIsAITalking] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');

  // Realtime API connection
  const connectionRef = useRef<RealtimeAPIConnection>({
    ws: null,
    isConnected: false,
    sessionId: '',
  });

  // Audio recording
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);

  // Initialize session ID
  useEffect(() => {
    const sessionId = Crypto.randomUUID();
    setCurrentSessionId(sessionId);
    connectionRef.current.sessionId = sessionId;
  }, []);

  // Initialize audio permissions
  useEffect(() => {
    const initializeAudio = async () => {
      try {
        const { status } = await Audio.requestPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Required', 'Microphone access is required for voice mode.');
          navigation.goBack();
          return;
        }

        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          playThroughEarpieceAndroid: false,
          staysActiveInBackground: false,
        });
      } catch (error) {
        console.error('Failed to initialize audio:', error);
        Alert.alert('Error', 'Failed to initialize audio. Please try again.');
        navigation.goBack();
      }
    };

    initializeAudio();
  }, [navigation]);

  // Connect to OpenAI Realtime API
  const connectToRealtimeAPI = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

      if (!firebaseUser?.uid) {
        throw new Error('No user ID available');
      }

      // Use the voice API service to get WebSocket URL
      const connectionResponse = await voiceApiService.requestVoiceConnection(
        {
          sessionId: currentSessionId,
          userId: firebaseUser.uid,
        },
        token
      );

      const { wsUrl } = connectionResponse;
      
      // Connect to WebSocket
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log('✅ Connected to OpenAI Realtime API');
        setIsConnected(true);
        connectionRef.current.ws = ws;
        connectionRef.current.isConnected = true;
        
        // Send initial session configuration
        ws.send(JSON.stringify({
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
        }));
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleRealtimeMessage(data);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsConnected(false);
      };

      ws.onclose = () => {
        console.log('WebSocket connection closed');
        setIsConnected(false);
        connectionRef.current.isConnected = false;
      };

    } catch (error) {
      console.error('Failed to connect to Realtime API:', error);
      Alert.alert('Connection Error', 'Failed to connect to voice service. Please try again.');
    }
  }, [currentSessionId, firebaseUser?.uid, getToken]);

  // Handle messages from Realtime API
  const handleRealtimeMessage = (data: any) => {
    switch (data.type) {
      case 'session.created':
        console.log('Session created:', data.session.id);
        break;
        
      case 'input_audio_buffer.speech_started':
        console.log('User started speaking');
        setIsRecording(true);
        break;
        
      case 'input_audio_buffer.speech_stopped':
        console.log('User stopped speaking');
        setIsRecording(false);
        break;
        
      case 'conversation.item.input_audio_transcription.completed':
        // User's speech was transcribed
        const userMessage: VoiceMessage = {
          id: Crypto.randomUUID(),
          role: 'user',
          content: data.transcript,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, userMessage]);
        break;
        
      case 'response.audio.delta':
        // AI is speaking - play audio chunk
        if (data.delta) {
          playAudioChunk(data.delta);
        }
        setIsAITalking(true);
        break;
        
      case 'response.audio.done':
        setIsAITalking(false);
        break;
        
      case 'response.text.delta':
        // AI text response (for display)
        // Update the last AI message or create new one
        setMessages(prev => {
          const lastMessage = prev[prev.length - 1];
          if (lastMessage && lastMessage.role === 'assistant') {
            return [
              ...prev.slice(0, -1),
              {
                ...lastMessage,
                content: lastMessage.content + data.delta,
              }
            ];
          } else {
            return [
              ...prev,
              {
                id: Crypto.randomUUID(),
                role: 'assistant',
                content: data.delta,
                timestamp: new Date(),
              }
            ];
          }
        });
        break;
        
      case 'error':
        console.error('Realtime API error:', data.error);
        break;
    }
  };

  // Play audio chunk from AI
  const playAudioChunk = async (audioData: string) => {
    try {
      // Convert base64 audio to playable format
      // This is a simplified implementation - you might need more sophisticated audio handling
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: `data:audio/wav;base64,${audioData}` },
        { shouldPlay: true }
      );
      
      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          newSound.unloadAsync();
        }
      });
    } catch (error) {
      console.error('Failed to play audio chunk:', error);
    }
  };

  // Start recording user audio
  const startRecording = async () => {
    try {
      if (!connectionRef.current.isConnected) {
        await connectToRealtimeAPI();
        return;
      }

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      
      setRecording(newRecording);
      setIsRecording(true);

      // Start sending audio to Realtime API
      newRecording.setOnRecordingStatusUpdate((status) => {
        if (status.isRecording && status.metering) {
          const normalizedLevel = Math.max(0, Math.min(1, (status.metering + 60) / 60));
          setAudioLevel(normalizedLevel);
        }
      });

    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };

  // Stop recording
  const stopRecording = async () => {
    if (!recording) return;

    try {
      await recording.stopAndUnloadAsync();
      setRecording(null);
      setIsRecording(false);
      setAudioLevel(0);

      // Get the recorded audio and send to Realtime API
      const uri = recording.getURI();
      if (uri && connectionRef.current.ws) {
        // Convert audio to base64 and send to WebSocket
        // This is simplified - you'd need proper audio encoding
        const response = await fetch(uri);
        const audioBlob = await response.blob();
        const reader = new FileReader();
        
        reader.onloadend = () => {
          const base64Audio = reader.result as string;
          const audioData = base64Audio.split(',')[1]; // Remove data:audio/wav;base64, prefix
          
          connectionRef.current.ws?.send(JSON.stringify({
            type: 'input_audio_buffer.append',
            audio: audioData
          }));
          
          // Commit the audio buffer
          connectionRef.current.ws?.send(JSON.stringify({
            type: 'input_audio_buffer.commit'
          }));
        };
        
        reader.readAsDataURL(audioBlob);
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
    }
  };

  // Toggle recording
  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // End voice session
  const endSession = async () => {
    try {
      // Save transcript if there are messages
      if (messages.length > 0) {
        const token = await getToken();
        if (token) {
          const transcriptMessages = messages.map(msg => ({
            role: msg.role,
            content: msg.content,
            timestamp: msg.timestamp.toISOString(),
          }));
          
          await voiceApiService.saveVoiceTranscript(
            currentSessionId,
            transcriptMessages,
            token
          );
        }
      }

      // End session on backend
      const token = await getToken();
      if (token) {
        await voiceApiService.endVoiceSession(currentSessionId, token);
      }
    } catch (error) {
      console.error('Error ending voice session:', error);
      // Continue with cleanup even if backend calls fail
    }

    // Cleanup local resources
    if (connectionRef.current.ws) {
      connectionRef.current.ws.close();
    }
    if (recording) {
      recording.stopAndUnloadAsync();
    }
    if (sound) {
      sound.unloadAsync();
    }
    
    navigation.goBack();
  };

  // Connect on mount
  useEffect(() => {
    connectToRealtimeAPI();
    
    return () => {
      if (connectionRef.current.ws) {
        connectionRef.current.ws.close();
      }
      if (recording) {
        recording.stopAndUnloadAsync();
      }
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [connectToRealtimeAPI]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={endSession} style={styles.closeButton}>
          <X size={24} color={colors.text} />
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Voice Coach
          </Text>
          <Text style={[styles.connectionStatus, { 
            color: isConnected ? '#10B981' : '#EF4444' 
          }]}>
            {isConnected ? 'Connected' : 'Connecting...'}
          </Text>
        </View>
        
        <View style={styles.headerRight} />
      </View>

      {/* Main conversation area */}
      <View style={styles.conversationArea}>
        <ConversationBubble
          isActive={isRecording || isAITalking}
          audioLevel={audioLevel}
          colorScheme={colorScheme}
        />
        
        {/* Status text */}
        <Text style={[styles.statusText, { color: colors.text }]}>
          {isAITalking 
            ? 'AI is speaking...' 
            : isRecording 
              ? 'Listening...' 
              : 'Tap to speak'
          }
        </Text>

        {/* Recent messages */}
        {messages.length > 0 && (
          <View style={styles.recentMessages}>
            {messages.slice(-3).map((message) => (
              <View key={message.id} style={[
                styles.messagePreview,
                { backgroundColor: colorScheme === 'dark' ? '#2A2A2A' : '#F5F5F5' }
              ]}>
                <Text style={[
                  styles.messageRole,
                  { color: message.role === 'user' ? colors.tint : colors.text }
                ]}>
                  {message.role === 'user' ? 'You' : 'Coach'}
                </Text>
                <Text 
                  style={[styles.messageContent, { color: colors.text }]}
                  numberOfLines={2}
                >
                  {message.content}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={[
            styles.micButton,
            {
              backgroundColor: isRecording 
                ? '#EF4444' 
                : colorScheme === 'dark' ? '#333333' : '#F0F0F0',
            }
          ]}
          onPress={toggleRecording}
          disabled={!isConnected}
        >
          {isRecording ? (
            <MicOff size={32} color="#FFFFFF" />
          ) : (
            <Mic size={32} color={colorScheme === 'dark' ? '#FFFFFF' : '#000000'} />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.endButton, { backgroundColor: '#EF4444' }]}
          onPress={endSession}
        >
          <Phone size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  connectionStatus: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  headerRight: {
    width: 40,
  },
  conversationArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  bubbleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  outerBubble: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainBubble: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  bubbleContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 30,
  },
  recentMessages: {
    width: '100%',
    maxHeight: 200,
  },
  messagePreview: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  messageRole: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  messageContent: {
    fontSize: 14,
    lineHeight: 18,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 30,
  },
  micButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  endButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
});
