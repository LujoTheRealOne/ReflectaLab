import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, useColorScheme } from 'react-native';
import { AlertTriangle, Plus, X } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';

interface BlockersCardProps {
  blockers: string[];
  title?: string;
  onUpdate?: (data: { blockers: string[]; title: string }) => void;
  editable?: boolean;
}

export default function BlockersCard({ 
  blockers, 
  title = "Key Blockers", 
  onUpdate,
  editable = true 
}: BlockersCardProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editData, setEditData] = useState({
    blockers: [...blockers],
    title
  });

  const handleSave = (field: string, value: string | string[]) => {
    const newData = { ...editData, [field]: value };
    // Filter out empty blockers if updating blockers
    if (field === 'blockers' && Array.isArray(value)) {
      newData.blockers = value.filter(blocker => blocker.trim() !== '');
    }
    setEditData(newData);
    onUpdate?.(newData);
    setEditingField(null);
    setEditingIndex(null);
  };

  const updateBlocker = (index: number, value: string) => {
    const newBlockers = editData.blockers.map((blocker, i) => i === index ? value : blocker);
    setEditData(prev => ({ ...prev, blockers: newBlockers }));
  };

  const removeBlocker = (index: number) => {
    const newBlockers = editData.blockers.filter((_, i) => i !== index);
    handleSave('blockers', newBlockers);
  };

  const addBlocker = () => {
    const newBlockers = [...editData.blockers, ''];
    setEditData(prev => ({ ...prev, blockers: newBlockers }));
    setEditingIndex(newBlockers.length - 1);
    setEditingField('blocker');
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
          <AlertTriangle 
            size={16} 
            color={colorScheme === 'dark' ? '#F59E0B' : '#D97706'} 
          />
          <Text style={[styles.aiPopupHeader, { color: colorScheme === 'dark' ? '#F59E0B' : '#D97706' }]}>
            {editData.title}
          </Text>
        </View>
        
        {/* Blockers List */}
        <View style={styles.blockersList}>
          {editData.blockers.map((blocker, index) => (
            <View key={index} style={styles.blockerRow}>
              <View style={[styles.bullet, { 
                backgroundColor: colorScheme === 'dark' ? '#F59E0B' : '#D97706' 
              }]} />
              <Text style={[styles.aiPopupText, { color: colors.text, flex: 1 }]}>
                {blocker}
              </Text>
            </View>
          ))}
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
  blockersList: {
    gap: 6,
  },
  blockerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bullet: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 8,
  },
});
