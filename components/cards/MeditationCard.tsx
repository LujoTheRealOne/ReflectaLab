import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useColorScheme } from 'react-native';
import { Play, Pause, Wind, Brain, Sparkles } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { useAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

interface MeditationCardProps {
  title: string;
  duration: number; // in seconds
  description?: string;
  type?: 'breathing' | 'mindfulness' | 'body-scan';
}

export default function MeditationCard({ 
  title, 
  duration, 
  type = 'breathing' 
}: MeditationCardProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [actualDuration, setActualDuration] = useState(duration);
  const positionUpdateInterval = useRef<NodeJS.Timeout | null>(null);

  // Initialize audio player for meditation audio
  const meditationPlayer = useAudioPlayer(require('@/assets/5m_meditation.wav'));

  useEffect(() => {
    configureAudio();
    startPositionTracking();
    return () => {
      if (positionUpdateInterval.current) {
        clearInterval(positionUpdateInterval.current);
      }
      // Ensure keep awake is deactivated on component unmount
      deactivateKeepAwake();
    };
  }, []);

  const configureAudio = async () => {
    try {
      // Configure audio to play in silent mode
      await setAudioModeAsync({
        playsInSilentMode: true,
      });
      
      console.log('Meditation audio configured for silent mode playback');
    } catch (error) {
      console.error('Error configuring audio mode:', error);
    }
  };

  const startPositionTracking = () => {
    // Track audio position and playing state
    positionUpdateInterval.current = setInterval(() => {
      setIsPlaying(meditationPlayer.playing);
      
      if (meditationPlayer.isLoaded) {
        // expo-audio currentTime and duration are already in seconds
        const currentTimeSeconds = Math.floor(meditationPlayer.currentTime || 0);
        const durationSeconds = Math.floor(meditationPlayer.duration || duration);
        
        setCurrentTime(currentTimeSeconds);
        setActualDuration(durationSeconds || duration);
        
        // Check if audio finished playing
        if (currentTimeSeconds >= durationSeconds && meditationPlayer.playing === false && currentTimeSeconds > 0) {
          setIsPlaying(false);
          setCurrentTime(0);
          // Deactivate keep awake when audio finishes naturally
          deactivateKeepAwake();
        }
      }
    }, 100); // Update more frequently for smoother UI updates
  };

  const handlePlayPause = async () => {
    if (!meditationPlayer.isLoaded) return;

    try {
      if (isPlaying) {
        meditationPlayer.pause();
        // Deactivate keep awake when pausing
        deactivateKeepAwake();
        console.log('Meditation audio paused');
      } else {
        // If the meditation is complete, restart from beginning
        if (currentTime >= actualDuration) {
          meditationPlayer.seekTo(0);
        }
        meditationPlayer.play();
        // Activate keep awake when starting playback to prevent screen from sleeping
        await activateKeepAwakeAsync();
        console.log('Meditation audio started/resumed');
      }
    } catch (error) {
      console.error('Error controlling meditation audio:', error);
    }
  };

  const getTypeIcon = () => {
    const iconProps = { 
      size: 16, 
      color: colorScheme === 'dark' ? '#9CA3AF' : '#6B7280' 
    };
    
    switch (type) {
      case 'breathing': 
        return <Wind {...iconProps} />;
      case 'mindfulness': 
        return <Brain {...iconProps} />;
      case 'body-scan': 
        return <Sparkles {...iconProps} />;
      default: 
        return <Wind {...iconProps} />;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = actualDuration > 0 ? (currentTime / actualDuration) * 100 : 0;

  return (
    <View style={[
      styles.aiPopup,
      {
        backgroundColor: colorScheme === 'dark' ? '#2A2A2A' : '#FFFFFF',
        borderColor: colorScheme === 'dark' ? '#333' : '#0000001A',
      }
    ]}>
      <View style={styles.aiPopupContent}>
        <View style={styles.headerRow}>
          {getTypeIcon()}
          <Text style={[styles.aiPopupHeader, { color: colors.text }]}>
            {title}
          </Text>
        </View>

        <View style={styles.mediaControls}>
          <TouchableOpacity
            onPress={handlePlayPause}
            disabled={!meditationPlayer.isLoaded}
            style={[styles.playButton, {
              backgroundColor: colors.tint,
              opacity: meditationPlayer.isLoaded ? 1 : 0.6
            }]}
          >
            {isPlaying ? (
              <Pause size={16} color="#FFFFFF" />
            ) : (
              <Play size={16} color="#FFFFFF" />
            )}
          </TouchableOpacity>
          
          <Text style={[styles.aiPopupText, { color: `${colors.text}80`, fontSize: 12 }]}>
            {formatTime(currentTime)} / {formatTime(actualDuration)}
          </Text>
        </View>
        
        {/* Progress bar */}
        <View style={[styles.progressContainer, {
          backgroundColor: colorScheme === 'dark' ? '#374151' : '#F3F4F6'
        }]}>
          <View 
            style={[styles.progressBar, {
              width: `${progress}%`,
              backgroundColor: colors.tint
            }]} 
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  aiPopup: {
    width: '105%',
    alignSelf: 'center',
    gap: 4,
    borderRadius: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#0000001A',
  },
  aiPopupContent: {
    paddingTop: 16,
    paddingRight: 16,
    paddingBottom: 16,
    paddingLeft: 16,
    gap: 4,
  },
  aiPopupHeader: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 16,
  },
  aiPopupText: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  mediaControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  playButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  progressContainer: {
    height: 3,
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 1.5,
  },
});
