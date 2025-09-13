import { useState, useRef, useEffect } from 'react';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

interface UseAudioTranscriptionOptions {
  onTranscriptionComplete?: (text: string) => void;
  onTranscriptionError?: (error: string) => void;
  isPro?: boolean;
  onProRequired?: () => Promise<void>;
}

export const useAudioTranscriptionAv = (options: UseAudioTranscriptionOptions = {}) => {
  const { onTranscriptionComplete, onTranscriptionError, isPro = true, onProRequired } = options;
  
  // Recording object reference
  const recordingRef = useRef<Audio.Recording | null>(null);
  
  // State
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingStartTime, setRecordingStartTime] = useState<Date | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  
  // Interval for simulating audio levels (expo-av doesn't provide metering)
  const audioLevelIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up resources when component unmounts
  useEffect(() => {
    return () => {
      // Clean up recording if it exists
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync();
        recordingRef.current = null;
      }
      
      // Clear any intervals
      if (audioLevelIntervalRef.current) {
        clearInterval(audioLevelIntervalRef.current);
        audioLevelIntervalRef.current = null;
      }
      
      // Delete temporary audio file if it exists
      if (audioUri) {
        FileSystem.deleteAsync(audioUri, { idempotent: true }).catch(console.error);
      }
    };
  }, [audioUri]);

  // Simulate audio levels since expo-av doesn't provide metering
  const startAudioLevelSimulation = () => {
    // Clear any existing interval
    if (audioLevelIntervalRef.current) {
      clearInterval(audioLevelIntervalRef.current);
    }
    
    // Start time for simulation
    const startTime = Date.now();
    
    audioLevelIntervalRef.current = setInterval(() => {
      if (!isRecording) {
        clearInterval(audioLevelIntervalRef.current!);
        audioLevelIntervalRef.current = null;
        setAudioLevel(0);
        return;
      }
      
      const elapsed = Date.now() - startTime;
      const cycle = Math.sin(elapsed / 200) + Math.sin(elapsed / 300);
      const simulatedLevel = Math.max(0.1, Math.min(0.8, 0.4 + cycle * 0.2 + Math.random() * 0.1));
      setAudioLevel(simulatedLevel);
    }, 100);
  };

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

      console.log('transcribe starting');
          
      // Use fetch API directly
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.EXPO_PUBLIC_OPENAI_API_KEY}`,
        },
        body: formData,
      });

      console.log('transcribe response done');
      console.log('response', response);
      
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
    // Check Pro access first
    if (!isPro && onProRequired) {
      await onProRequired();
      return;
    }
    
    try {
      // Clean up any existing recording
      if (recordingRef.current) {
        await recordingRef.current.stopAndUnloadAsync();
        recordingRef.current = null;
      }
      
      // Clear any existing audio URI
      if (audioUri) {
        await FileSystem.deleteAsync(audioUri, { idempotent: true });
        setAudioUri(null);
      }
      
      // Request permissions
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        console.error('Permission to record was denied');
        onTranscriptionError?.('Permission to record was denied');
        return;
      }
      
      // Set audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        // Fix for invalid interruptionModeIOS value
        interruptionModeIOS: 1,
        interruptionModeAndroid: 1,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      
      // Prepare recording
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      
      recordingRef.current = recording;
      setRecordingStartTime(new Date());
      setIsRecording(true);
      
      // Start simulating audio levels
      startAudioLevelSimulation();
      
    } catch (err) {
      console.log('Failed to start recording here', err);
      console.error('Failed to start recording', err);
      onTranscriptionError?.('Failed to start recording');
    }
  };

  // Stop recording and transcribe
  const stopRecordingAndTranscribe = async () => {
    if (!recordingRef.current || !isRecording) return;
    
    try {
      // Stop recording
      await recordingRef.current.stopAndUnloadAsync();
      
      // Get recording URI
      const uri = recordingRef.current.getURI();
      setAudioUri(uri);
      
      // Reset recording state
      setIsRecording(false);
      setRecordingStartTime(null);
      setAudioLevel(0);
      
      // Clear audio level interval
      if (audioLevelIntervalRef.current) {
        clearInterval(audioLevelIntervalRef.current);
        audioLevelIntervalRef.current = null;
      }
      
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
        
        // Clean up recording reference
        recordingRef.current = null;
        
        // Delete the audio file to free up memory
        try {
          await FileSystem.deleteAsync(uri, { idempotent: true });
          setAudioUri(null);
        } catch (e) {
          console.error('Failed to delete audio file', e);
        }
      }
    } catch (err) {
      console.error('Failed to stop recording', err);
      setIsTranscribing(false);
      onTranscriptionError?.('Failed to stop recording');
      
      // Clean up recording reference even on error
      recordingRef.current = null;
    }
  };

  // Cancel recording
  const cancelRecording = async () => {
    try {
      if (recordingRef.current && isRecording) {
        await recordingRef.current.stopAndUnloadAsync();
        
        // Get URI to delete the file
        const uri = recordingRef.current.getURI();
        if (uri) {
          await FileSystem.deleteAsync(uri, { idempotent: true });
        }
        
        recordingRef.current = null;
      }
      
      // Clear audio level interval
      if (audioLevelIntervalRef.current) {
        clearInterval(audioLevelIntervalRef.current);
        audioLevelIntervalRef.current = null;
      }
      
      setIsRecording(false);
      setRecordingStartTime(null);
      setAudioLevel(0);
      setAudioUri(null);
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