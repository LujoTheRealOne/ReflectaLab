import React, { memo } from 'react';
import { View, Text, ColorSchemeName } from 'react-native';

interface DateSeparatorProps {
  date: Date;
  colorScheme: ColorSchemeName;
}

export const DateSeparator = memo(({ date, colorScheme }: DateSeparatorProps) => {
  const formatDate = (date: Date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const isToday = date.toDateString() === today.toDateString();
    const isYesterday = date.toDateString() === yesterday.toDateString();
    
    if (isToday) {
      return 'Today';
    } else if (isYesterday) {
      return 'Yesterday';
    } else {
      // Format as "Monday, Jan 15" for recent dates
      const daysDiff = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff <= 7) {
        return date.toLocaleDateString('en-US', { weekday: 'long' });
      } else {
        // Format as "Monday, Jan 15" for older dates
        return date.toLocaleDateString('en-US', { 
          weekday: 'long', 
          month: 'short', 
          day: 'numeric' 
        });
      }
    }
  };
  
  return (
    <View style={{
      alignItems: 'center',
      marginVertical: 20,
    }}>
      <View style={{
        backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
      }}>
        <Text style={{
          fontSize: 12,
          fontWeight: '500',
          color: colorScheme === 'dark' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}>
          {formatDate(date)}
        </Text>
      </View>
    </View>
  );
});
