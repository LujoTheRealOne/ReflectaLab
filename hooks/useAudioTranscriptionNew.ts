import { useState, useRef, useEffect } from 'react';
import {
  useAudioRecorder,
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorderState,
} from 'expo-audio';
import * as FileSystem from 'expo-file-system';

interface UseAudioTranscriptionHybridOptions {
  onTranscriptionComplete?: (text: string) => void;
  onTranscriptionError?: (error: string) => void;
  isPro?: boolean;
  onProRequired?: () => void;
}

export const useAudioTranscriptionHybrid = (options: UseAudioTranscriptionHybridOptions = {}) => {
  const { onTranscriptionComplete, onTranscriptionError, isPro = true, onProRequired } = options;
  
  // expo-audio for both recording and metering
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
  const [audioUri, setAudioUri] = useState<string | null>(null);

  // Monitor real audio level from expo-audio
  useEffect(() => {
    if (recorderState.isRecording && isRecording) {
      if (recorderState.metering !== undefined && recorderState.metering !== null) {
        // expo-audio metering values typically range from -160 (silence) to 0 (max volume)
        const dB = recorderState.metering;
        
        // Normalize the dB value to 0-1 range for visualization with better sensitivity
        const minDb = -90; // Even lower threshold for better sensitivity
        const maxDb = -5; // Higher threshold to capture more range
        const clampedDb = Math.max(minDb, Math.min(maxDb, dB));
        const normalized = (clampedDb - minDb) / (maxDb - minDb);
        
        // Apply more conservative curve - sessizlikte düşük, yüksek seste yüksek
        const curvedLevel = Math.pow(normalized, 1.5); // More conservative curve
        
        setAudioLevel(curvedLevel);
      } else {
        // Fallback: simulate audio levels when metering is not available
        const duration = recorderState.durationMillis || 0;
        const cycle = Math.sin(duration / 150) + Math.sin(duration / 250);
        const simulatedLevel = Math.max(0.0, Math.min(1.0, 0.1 + cycle * 0.2 + Math.random() * 0.1));
        setAudioLevel(simulatedLevel);
      }
    } else {
      setAudioLevel(0);
    }
  }, [recorderState.metering, recorderState.isRecording, recorderState.durationMillis, isRecording]);

  // Clean up resources when component unmounts
  useEffect(() => {
    return () => {
      // Clean up expo-audio recording
      if (recorderState.isRecording) {
        audioRecorder.stop();
      }
      
      // Delete temporary audio file if it exists
      if (audioUri) {
        FileSystem.deleteAsync(audioUri, { idempotent: true }).catch(console.error);
      }
    };
  }, [audioUri, recorderState.isRecording, audioRecorder]);

  // Transcribe audio function using OpenAI API
  const transcribeAudio = async (audioUri: string): Promise<string | null> => {
    try {
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
          return retryResult.text;
        }
        
        throw new Error(errorText);
      }
      
      const result = await response.json();
      return result.text;
    } catch (error) {
      console.error('Error transcribing audio:', error);
      return null;
    }
  };

  // Start recording function
  const startRecording = async () => {
    // Check Pro status before starting recording
    if (!isPro) {
      console.log('🎤 Voice transcription requires Pro subscription');
      onProRequired?.();
      return;
    }
    
    // Immediately show recording state for instant UI feedback
    setIsRecording(true);
    setRecordingStartTime(new Date());
    
    try {
      // Clear any existing audio URI in background
      if (audioUri) {
        FileSystem.deleteAsync(audioUri, { idempotent: true }).catch(console.error);
        setAudioUri(null);
      }
      
      // Request permissions for expo-audio
      const { status } = await AudioModule.requestRecordingPermissionsAsync();
      
      if (status !== 'granted') {
        console.error('Permission to record was denied');
        onTranscriptionError?.('Permission to record was denied');
        setIsRecording(false);
        setRecordingStartTime(null);
        return;
      }
      
      // Set audio mode for expo-audio
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      
      // Start expo-audio recording with metering
      await audioRecorder.prepareToRecordAsync({
        ...RecordingPresets.HIGH_QUALITY,
        isMeteringEnabled: true,
      });
      audioRecorder.record();
      
    } catch (err) {
      console.error('Failed to start recording', err);
      onTranscriptionError?.('Failed to start recording');
      // Reset state on error
      setIsRecording(false);
      setRecordingStartTime(null);
    }
  };

  // Stop recording and transcribe
  const stopRecordingAndTranscribe = async () => {
    if (!recorderState.isRecording || !isRecording) return;
    
    // Double-check Pro status before transcription
    if (!isPro) {
      console.log('🎤 Voice transcription requires Pro subscription');
      onProRequired?.();
      await cancelRecording();
      return;
    }
    
    // Immediately show transcribing state and reset recording state
    setIsRecording(false);
    setRecordingStartTime(null);
    setAudioLevel(0);
    setIsTranscribing(true);
    
    try {
      // Stop expo-audio recording
      await audioRecorder.stop();
      
      // Get recording URI from expo-audio
      const uri = audioRecorder.uri;
      setAudioUri(uri);
      
      if (uri) {
        // Transcribe the audio
        const transcription = await transcribeAudio(uri);
        
        // End transcribing state regardless of outcome
        setIsTranscribing(false);
        
        if (transcription) {
          onTranscriptionComplete?.(transcription);
        } else {
          onTranscriptionError?.('Failed to transcribe audio');
        }
        
        // Delete the audio file in background
        FileSystem.deleteAsync(uri, { idempotent: true }).catch(console.error);
        setAudioUri(null);
      } else {
        setIsTranscribing(false);
        onTranscriptionError?.('No audio file recorded');
      }
    } catch (err) {
      console.error('Failed to stop recording', err);
      setIsTranscribing(false);
      onTranscriptionError?.('Failed to stop recording');
    }
  };

  // Cancel recording
  const cancelRecording = async () => {
    // Immediately update UI state for instant response
    setIsRecording(false);
    setRecordingStartTime(null);
    setAudioLevel(0);
    setAudioUri(null);
    
    // Cleanup in background
    try {
      // Stop expo-audio recording
      if (recorderState.isRecording) {
        await audioRecorder.stop();
        
        // Get URI to delete the file
        const uri = audioRecorder.uri;
        if (uri) {
          // Delete file in background without blocking UI
          FileSystem.deleteAsync(uri, { idempotent: true }).catch(console.error);
        }
      }
    } catch (err) {
      console.error('Failed to cancel recording', err);
    }
  };

  return {
    // State
    isRecording,
    isTranscribing,
    recordingStartTime,
    audioLevel,
    
    // Actions
    startRecording,
    stopRecordingAndTranscribe,
    cancelRecording,
  };
};
