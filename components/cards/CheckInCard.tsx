import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, useColorScheme } from 'react-native';
import { Calendar, Clock, ChevronDown } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';

interface CheckInCardProps {
  frequency: string;
  what?: string;
  notes?: string;
  onUpdate?: (data: { frequency: string; what: string; notes: string }) => void;
  editable?: boolean;
}

export default function CheckInCard({ 
  frequency, 
  what = "", 
  notes = "",
  onUpdate,
  editable = true
}: CheckInCardProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editData, setEditData] = useState({
    frequency,
    what,
    notes
  });

  const handleSave = (field: string, value: string) => {
    const newData = { ...editData, [field]: value };
    setEditData(newData);
    onUpdate?.(newData);
    setEditingField(null);
  };

  return (
    <View style={[
      styles.aiPopup,
      {
        backgroundColor: colorScheme === 'dark' ? '#2A2A2A' : '#FFFFFF',
        borderWidth: 0.5,
        borderColor: colorScheme === 'dark' ? '#333333' : '#F0F0F0',
        shadowColor: colorScheme === 'dark' ? '#FFFFFF' : '#000000',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: colorScheme === 'dark' ? 0.1 : 0.15,
        shadowRadius: colorScheme === 'dark' ? 8 : 10,
        elevation: colorScheme === 'dark' ? 8 : 12,
      }
    ]}>
      <View style={styles.aiPopupContent}>
        <View style={styles.headerRow}>
          <Calendar 
            size={16} 
            color={colorScheme === 'dark' ? '#A855F7' : '#7C3AED'} 
          />
          <Text style={[styles.aiPopupHeader, { color: colorScheme === 'dark' ? '#A855F7' : '#7C3AED' }]}>
            Check-in Agreement
          </Text>
        </View>
        
        <View style={styles.section}>
          {/* Frequency Display */}
          <View style={styles.frequencyRow}>
            <Clock 
              size={12} 
              color={colorScheme === 'dark' ? '#A855F7' : '#7C3AED'} 
            />
            <Text style={[styles.frequencyText, { color: colors.text }]}>
              {editData.frequency}
            </Text>
          </View>
          
          {/* What to check-in about */}
          {what && (
            <Text style={[styles.aiPopupText, { color: `${colors.text}80` }]}>
              Check-in about: {what}
            </Text>
          )}
          
          {/* Notes */}
          {notes && (
            <Text style={[styles.aiPopupText, { color: `${colors.text}66`, fontSize: 12 }]}>
              {notes}
            </Text>
          )}
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
  section: {
    gap: 6,
  },
  frequencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  frequencyText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
