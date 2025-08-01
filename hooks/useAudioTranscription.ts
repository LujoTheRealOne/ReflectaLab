import { useState, useRef, useEffect } from 'react';
import {
  useAudioRecorder,
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorderState,
} from 'expo-audio';
import * as FileSystem from 'expo-file-system';

interface UseAudioTranscriptionOptions {
  onTranscriptionComplete?: (text: string) => void;
  onTranscriptionError?: (error: string) => void;
}

export const useAudioTranscription = (options: UseAudioTranscriptionOptions = {}) => {
  const { onTranscriptionComplete, onTranscriptionError } = options;
  
  // Audio recording setup
  const audioRecorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    isMeteringEnabled: true,
  });
  const recorderState = useAudioRecorderState(audioRecorder, 100);
  
  // State
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingStartTime, setRecordingStartTime] = useState<Date | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);

  // Monitor audio level from recorder state
  useEffect(() => {
    if (recorderState.isRecording) {
      if (recorderState.metering !== undefined && recorderState.metering !== null) {
        // expo-audio metering values typically range from -160 (silence) to 0 (max volume)
        const dB = recorderState.metering;
        
        // Normalize the dB value to 0-1 range for visualization
        const minDb = -60;
        const maxDb = 0;
        const clampedDb = Math.max(minDb, Math.min(maxDb, dB));
        const normalized = (clampedDb - minDb) / (maxDb - minDb);
        
        setAudioLevel(normalized);
      } else {
        // Fallback: simulate audio levels when metering is not available
        const duration = recorderState.durationMillis || 0;
        const cycle = Math.sin(duration / 200) + Math.sin(duration / 300);
        const simulatedLevel = Math.max(0.1, Math.min(0.8, 0.4 + cycle * 0.2 + Math.random() * 0.1));
        setAudioLevel(simulatedLevel);
      }
    } else {
      setAudioLevel(0);
    }
  }, [recorderState.metering, recorderState.isRecording, recorderState.durationMillis]);

  // Transcribe audio function using OpenAI API
  const transcribeAudio = async (audioUri: string): Promise<string | null> => {
    try {
      // Get file info
      const fileInfo = await FileSystem.getInfoAsync(audioUri);
      console.log('File info:', fileInfo);
      
      // Create a FormData object to send the file
      const formData = new FormData();
      formData.append('file', {
        uri: audioUri,
        type: 'audio/m4a',
        name: `recording-${Date.now()}.m4a`,
      } as any);
      formData.append('model', 'whisper-1');
            
      // Use fetch API directly
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.EXPO_PUBLIC_OPENAI_API_KEY}`,
        },
        body: formData,
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ OpenAI API Error:', errorText);
        
        // Try with a different file format if there's an error
        if (errorText.includes('file format') || errorText.includes('Invalid file')) {
          const retryFormData = new FormData();
          retryFormData.append('file', {
            uri: audioUri,
            type: 'audio/mpeg',
            name: `recording-${Date.now()}.mp3`,
          } as any);
          retryFormData.append('model', 'whisper-1');
          
          const retryResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.EXPO_PUBLIC_OPENAI_API_KEY}`,
            },
            body: retryFormData,
          });
          
          if (!retryResponse.ok) {
            const retryErrorText = await retryResponse.text();
            console.error('❌ Retry failed:', retryErrorText);
            throw new Error(retryErrorText);
          }
          
          const retryResult = await retryResponse.json();
          console.log('✅ Transcription successful with alternative format:', retryResult.text);
          return retryResult.text;
        }
        
        throw new Error(errorText);
      }
      
      const result = await response.json();
      console.log('✅ Transcription successful:', result.text);
      return result.text;
    } catch (error) {
      console.error('Error transcribing audio:', error);
      return null;
    }
  };

  // Start recording function
  const startRecording = async () => {
    try {
      // Request permissions
      const { status } = await AudioModule.requestRecordingPermissionsAsync();
      if (status !== 'granted') {
        console.error('Permission to record was denied');
        onTranscriptionError?.('Permission to record was denied');
        return;
      }
      
      // Set audio mode with more compatible settings
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      
      await audioRecorder.prepareToRecordAsync({
        ...RecordingPresets.HIGH_QUALITY,
        isMeteringEnabled: true,
      });
      audioRecorder.record();
      
      setRecordingStartTime(new Date());
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start recording', err);
      onTranscriptionError?.('Failed to start recording');
    }
  };

  // Stop recording and transcribe
  const stopRecordingAndTranscribe = async () => {
    if (!recorderState.isRecording) return;
    
    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      setIsRecording(false);
      setRecordingStartTime(null);
      setAudioLevel(0);
      
      if (uri) {
        // Start transcribing
        setIsTranscribing(true);
        
        // Transcribe the audio
        const transcription = await transcribeAudio(uri);
        
        // End transcribing state regardless of outcome
        setIsTranscribing(false);
        
        if (transcription) {
          onTranscriptionComplete?.(transcription);
        } else {
          onTranscriptionError?.('Failed to transcribe audio');
        }
      }
    } catch (err) {
      console.error('Failed to stop recording', err);
      setIsTranscribing(false);
      onTranscriptionError?.('Failed to stop recording');
    }
  };

  // Cancel recording
  const cancelRecording = () => {
    if (recorderState.isRecording) {
      audioRecorder.stop();
    }
    setIsRecording(false);
    setRecordingStartTime(null);
    setAudioLevel(0);
  };

  return {
    // State
    isRecording,
    isTranscribing,
    recordingStartTime,
    audioLevel,
    recorderState,
    
    // Actions
    startRecording,
    stopRecordingAndTranscribe,
    cancelRecording,
  };
}; 