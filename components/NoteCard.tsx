import React from 'react';
import { View, Text, StyleSheet, useColorScheme } from 'react-native';

interface NoteCardProps {
  title: string;
  subtitle: string;
  preview: string;
  date?: string;
}

export default function NoteCard({ title, subtitle, preview, date }: NoteCardProps) {
  const colorScheme = useColorScheme();
  const isDark = (colorScheme === 'dark');

  return (
    <View style={[
      styles.cardContainer,
      { 
        backgroundColor: isDark ? '#1F1F1F' : '#FFFFFF',
        borderColor: isDark ? '#374151' : '#D9D9D9',
      }
    ]}>
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
          borderColor: isDark ? 'rgba(107, 114, 128, 0.3)' : 'rgba(168, 162, 158, 0.3)',
          overflow: 'hidden',
          shadowColor: isDark ? 'rgba(198, 184, 61, 0.6)' : '#000',
        }
      ]}> 
        <Text 
          style={[styles.cardPreview, { color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }]} 
          numberOfLines={3}
        >
          {preview}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    height: 120,
    backgroundColor: '#FAFAFA',
    borderRadius: 24,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 0.5,
  },
  cardHeaderRow: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    gap: 2,
    zIndex: 10,
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
    zIndex: 1,
    // Enhanced shadow for content area
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.20,
    shadowRadius: 8,
    elevation: 4,
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
