import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, useColorScheme } from 'react-native';
import { Target } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';

interface FocusCardProps {
  focus: string;
  context?: string;
  onUpdate?: (data: { focus: string; context: string }) => void;
  editable?: boolean;
}

export default function FocusCard({ 
  focus, 
  context = "", 
  onUpdate,
  editable = true 
}: FocusCardProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editData, setEditData] = useState({
    focus,
    context
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
        borderColor: colorScheme === 'dark' ? '#333' : '#0000001A',
      }
    ]}>
      <View style={styles.aiPopupContent}>
        <View style={styles.headerRow}>
          <Target 
            size={16} 
            color={colorScheme === 'dark' ? '#60A5FA' : '#2563EB'} 
          />
          <Text style={[styles.aiPopupHeader, { color: colorScheme === 'dark' ? '#60A5FA' : '#2563EB' }]}>
            Main Focus
          </Text>
        </View>
        
        {/* Main Focus Text */}
        <Text style={[styles.aiPopupText, { color: colors.text, fontWeight: '500', marginBottom: 4 }]}>
          {editData.focus}
        </Text>
        
        {/* Context */}
        {editData.context && (
          <Text style={[styles.aiPopupText, { color: `${colors.text}80`, fontSize: 12 }]}>
            {editData.context}
          </Text>
        )}
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
});
