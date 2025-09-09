import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, useColorScheme } from 'react-native';
import { Lightbulb, X } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import * as Haptics from 'expo-haptics';

interface InsightToken {
  type: 'insight';
  title: string;
  preview: string;
  fullContent: string;
}

interface InsightCardProps {
  insight: InsightToken;
  onDiscuss?: (fullInsight: string) => void;
}

export default function InsightCard({ insight, onDiscuss }: InsightCardProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [showModal, setShowModal] = useState(false);

  const handleCardPress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowModal(true);
  };

  const handleCloseModal = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowModal(false);
  };

  const handleDiscuss = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowModal(false);
    onDiscuss?.(insight.fullContent);
  };

  return (
    <>
      {/* Main Card */}
      <TouchableOpacity
        style={[
          styles.card,
          {
            backgroundColor: colorScheme === 'dark' ? '#1C1C1E' : '#FFFFFF',
          }
        ]}
        onPress={handleCardPress}
        activeOpacity={0.7}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.badgeContainer}>
            <Lightbulb 
              size={12} 
              color={colorScheme === 'dark' ? '#FFD60A' : '#F59E0B'} 
            />
            <Text style={[styles.badge, { 
              color: colorScheme === 'dark' ? '#FFD60A' : '#F59E0B' 
            }]}>
              Insight
            </Text>
          </View>
        </View>

        {/* Content */}
        <View style={styles.content}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
            {insight.title}
          </Text>
          
          <Text style={[styles.preview, { 
            color: colorScheme === 'dark' ? '#8E8E93' : '#6B7280' 
          }]} numberOfLines={3}>
            {insight.preview}
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, { 
            color: colorScheme === 'dark' ? '#8E8E93' : '#9CA3AF' 
          }]}>
            Tap to read full insight
          </Text>
        </View>
      </TouchableOpacity>

      {/* Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCloseModal}
      >
        <View style={[
          styles.modalContainer,
          { backgroundColor: colorScheme === 'dark' ? '#000000' : '#FFFFFF' }
        ]}>
          {/* Modal Header */}
          <View style={[
            styles.modalHeader,
            { borderBottomColor: colorScheme === 'dark' ? '#2C2C2E' : '#E5E7EB' }
          ]}>
            <View style={styles.modalHeaderLeft}>
              <View style={styles.badgeContainer}>
                <Lightbulb 
                  size={14} 
                  color={colorScheme === 'dark' ? '#FFD60A' : '#F59E0B'} 
                />
                <Text style={[styles.modalBadge, { 
                  color: colorScheme === 'dark' ? '#FFD60A' : '#F59E0B' 
                }]}>
                  Insight
                </Text>
              </View>
            </View>
            
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleCloseModal}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X 
                size={20} 
                color={colorScheme === 'dark' ? '#8E8E93' : '#6B7280'} 
              />
            </TouchableOpacity>
          </View>

          {/* Modal Content */}
          <ScrollView 
            style={styles.modalContent}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.modalContentContainer}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {insight.title}
            </Text>
            
            <Text style={[styles.modalText, { 
              color: colorScheme === 'dark' ? '#E5E5E7' : '#374151' 
            }]}>
              {insight.fullContent}
            </Text>
          </ScrollView>

          {/* Modal Footer */}
          {onDiscuss && (
            <View style={[
              styles.modalFooter,
              { borderTopColor: colorScheme === 'dark' ? '#2C2C2E' : '#E5E7EB' }
            ]}>
              <TouchableOpacity
                style={[styles.discussButton, {
                  backgroundColor: colorScheme === 'dark' ? '#FFFFFF' : '#000000'
                }]}
                onPress={handleDiscuss}
              >
                <Text style={[styles.discussButtonText, {
                  color: colorScheme === 'dark' ? '#000000' : '#FFFFFF'
                }]}>
                  Discuss This Insight
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 20,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 2,
  },
  header: {
    marginBottom: 12,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badge: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  content: {
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 24,
    marginBottom: 8,
  },
  preview: {
    fontSize: 15,
    lineHeight: 22,
  },
  footer: {
    borderTopWidth: 0,
    paddingTop: 0,
  },
  footerText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalHeaderLeft: {
    flex: 1,
  },
  modalBadge: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    flex: 1,
  },
  modalContentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 32,
    marginBottom: 20,
  },
  modalText: {
    fontSize: 16,
    lineHeight: 24,
  },
  modalFooter: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
  },
  discussButton: {
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  discussButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
