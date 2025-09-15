import React, { memo } from 'react';
import { View, ColorSchemeName, StyleSheet } from 'react-native';

interface AudioLevelIndicatorProps {
  audioLevel: number;
  colorScheme: ColorSchemeName;
}

export const AudioLevelIndicator = memo(({ audioLevel, colorScheme }: AudioLevelIndicatorProps) => {
  const totalDots = 6;
  
  const isDotActive = (index: number) => {
    const threshold = (index + 1) / totalDots;
    return audioLevel >= threshold;
  };
  
  return (
    <View style={styles.audioLevelContainer}>
      {Array.from({ length: totalDots }).map((_, index) => {
        const isActive = isDotActive(index);
        
        return (
          <View 
            key={index}
            style={[
              styles.audioLevelDot, 
              { 
                backgroundColor: isActive
                  ? (colorScheme === 'dark' ? '#888888' : '#111111')
                  : (colorScheme === 'dark' ? '#444444' : '#E5E5E5')
              }
            ]}
          />
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  audioLevelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  audioLevelDot: {
    width: 4,
    height: 16,
    borderRadius: 2,
    marginHorizontal: 1,
  },
});
