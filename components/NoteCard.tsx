import React from 'react';
import { View, Text, StyleSheet, useColorScheme, TouchableOpacity, ActionSheetIOS, Platform } from 'react-native';

interface NoteCardProps {
  title: string;
  subtitle: string;
  preview: string;
  date?: string;
  onPress?: () => void;
  onLongPress?: () => void;
}

export default function NoteCard({ title, subtitle, preview, date, onPress, onLongPress }: NoteCardProps) {
  const colorScheme = useColorScheme();
  const isDark = (colorScheme === 'dark');

  const handleLongPress = () => {
    if (!onLongPress) return;
    
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: ['Cancel', 'Delete Note'],
        destructiveButtonIndex: 1,
        cancelButtonIndex: 0,
        title: 'Are you sure you want to delete this note? This action cannot be undone.',
      },
      (buttonIndex) => {
        if (buttonIndex === 1) {
          onLongPress();
        }
      }
    );
  };

  return (
    <TouchableOpacity 
      style={[
        styles.cardContainer,
        { 
          backgroundColor: isDark ? '#1F1F1F' : '#FFFFFF',
          borderColor: isDark ? '#374151' : '#D9D9D9',
          // Enhanced shadow for both light and dark modes
          shadowColor: isDark ? '#FFFFFF' : '#000000',
          shadowOffset: {
            width: 0,
            height: isDark ? 8 : 12,
          },
          shadowOpacity: isDark ? 0.15 : 0.25,
          shadowRadius: isDark ? 12 : 16,
          elevation: isDark ? 8 : 12,
        }
      ]}
      onPress={onPress}
      onLongPress={handleLongPress}
      activeOpacity={0.7}
    >
      <View style={[styles.cardHeaderRow, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}> 
        <Text style={{ 
          fontSize: 12,
          fontWeight: '600',
          color: isDark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.9)',
        }}>
          {title}
        </Text>
        <Text style={{ 
          fontSize: 12,
          fontWeight: '400',
          color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)',
        }}>
          {date || 'No date'}
        </Text>
      </View>
      <View style={[
        styles.cardBody, 
        { 
          backgroundColor: isDark ? '#1F1F1F' : '#FFFFFF',
          borderColor: isDark ? 'rgba(128, 128, 128, 0.2)' : 'rgba(196, 196, 196, 0.2)',
          overflow: 'hidden',
        }
      ]}> 
        <Text 
          style={[styles.cardPreview, { color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }]} 
          numberOfLines={3}
        >
          {preview}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    height: 120,
    backgroundColor: '#FAFAFA',
    borderRadius: 24,
    marginBottom: 16,
    borderWidth: 0.4,
    // Shadow properties are now set dynamically based on theme
  },
  cardHeaderRow: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    gap: 2,
    zIndex: 5,
    position: 'relative',
  },
  cardHeaderContent: {
    alignSelf: 'stretch',
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 12,
    justifyContent: 'flex-start',
    color: 'rgba(0,0,0,0.9)'
  },
  cardSubtitle: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 12,
    textAlign: 'right',
    justifyContent: 'flex-start',
    color: 'rgba(0,0,0,0.6)'
  },
  cardBody: {
    flex: 1,
    padding: 16,
    borderRadius: 24,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    gap: 4,
    zIndex: 10,
    borderWidth: 1,
  },
  cardPreview: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    color: 'rgba(0,0,0,0.5)',
    flexShrink: 1,
  }
});
