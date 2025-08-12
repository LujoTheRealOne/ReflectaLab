import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, useColorScheme } from 'react-native';
import { CheckSquare, Plus, X } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';

interface ActionPlanCardProps {
  actions: string[];
  title?: string;
  onUpdate?: (data: { actions: string[]; title: string }) => void;
  editable?: boolean;
}

export default function ActionPlanCard({ 
  actions, 
  title = "Action Plan", 
  onUpdate,
  editable = true 
}: ActionPlanCardProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editData, setEditData] = useState({
    actions: [...actions],
    title
  });

  const handleSave = (field: string, value: string | string[]) => {
    const newData = { ...editData, [field]: value };
    // Filter out empty actions if updating actions
    if (field === 'actions' && Array.isArray(value)) {
      newData.actions = value.filter(action => action.trim() !== '');
    }
    setEditData(newData);
    onUpdate?.(newData);
    setEditingField(null);
    setEditingIndex(null);
  };

  const updateAction = (index: number, value: string) => {
    const newActions = editData.actions.map((action, i) => i === index ? value : action);
    setEditData(prev => ({ ...prev, actions: newActions }));
  };

  const removeAction = (index: number) => {
    const newActions = editData.actions.filter((_, i) => i !== index);
    handleSave('actions', newActions);
  };

  const addAction = () => {
    const newActions = [...editData.actions, ''];
    setEditData(prev => ({ ...prev, actions: newActions }));
    setEditingIndex(newActions.length - 1);
    setEditingField('action');
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
          <CheckSquare 
            size={16} 
            color={colorScheme === 'dark' ? '#4ADE80' : '#16A34A'} 
          />
          <Text style={[styles.aiPopupHeader, { color: colorScheme === 'dark' ? '#4ADE80' : '#16A34A' }]}>
            {editData.title}
          </Text>
        </View>
        
        {/* Actions List */}
        <View style={styles.actionsList}>
          {editData.actions.map((action, index) => (
            <View key={index} style={styles.actionRow}>
              <Text style={[styles.actionNumber, { color: colorScheme === 'dark' ? '#4ADE80' : '#16A34A' }]}>
                {index + 1}.
              </Text>
              <Text style={[styles.aiPopupText, { color: colors.text, flex: 1 }]}>
                {action}
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
  actionsList: {
    gap: 6,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  actionNumber: {
    fontSize: 14,
    fontWeight: '600',
    minWidth: 20,
    marginTop: 1,
  },
});
