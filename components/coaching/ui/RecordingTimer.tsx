import React, { useState, useEffect } from 'react';
import { Text, ColorSchemeName, StyleSheet } from 'react-native';

interface RecordingTimerProps {
  startTime: Date | null;
  colorScheme: ColorSchemeName;
}

export const RecordingTimer = ({ startTime, colorScheme }: RecordingTimerProps) => {
  const [elapsed, setElapsed] = useState('00:00');
  
  useEffect(() => {
    if (!startTime) return;
    
    const interval = setInterval(() => {
      const now = new Date();
      const diffMs = now.getTime() - startTime.getTime();
      const diffSec = Math.floor(diffMs / 1000);
      const minutes = Math.floor(diffSec / 60).toString().padStart(2, '0');
      const seconds = (diffSec % 60).toString().padStart(2, '0');
      setElapsed(`${minutes}:${seconds}`);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [startTime]);
  
  return (
    <Text style={[styles.recordingTimer, { color: colorScheme === 'dark' ? '#FFFFFF' : '#333333' }]}>
      {elapsed}
    </Text>
  );
};

const styles = StyleSheet.create({
  recordingTimer: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginVertical: 8,
  },
});
