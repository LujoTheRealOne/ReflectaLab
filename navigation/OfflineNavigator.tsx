import React, { createContext, useContext, useState } from 'react';
import { View, Text, StyleSheet, useColorScheme } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Wifi, WifiOff } from 'lucide-react-native';

import { Colors } from '@/constants/Colors';
import { CurrentEntryContextType } from '@/types';
import HomeContent from '@/screens/HomeContent';

const CurrentEntryContext = createContext<CurrentEntryContextType | undefined>(undefined);

export const useCurrentEntry = () => {
  const context = useContext(CurrentEntryContext);
  if (!context) {
    throw new Error('useCurrentEntry must be used within a CurrentEntryProvider');
  }
  return context;
};

export default function OfflineNavigator() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [currentEntryId, setCurrentEntryId] = useState<string | null>(null);

  return (
    <SafeAreaProvider>
      <CurrentEntryContext.Provider value={{ currentEntryId, setCurrentEntryId }}>
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
          {/* Offline Mode Header */}
          <View style={[styles.offlineHeader, { backgroundColor: colors.background, borderBottomColor: colors.text + '20' }]}>
            <View style={styles.offlineIndicator}>
              <WifiOff size={20} color="#FFA500" />
              <Text style={[styles.offlineText, { color: colors.text }]}>
                Offline Mode
              </Text>
            </View>
            <Text style={[styles.offlineSubtext, { color: colors.text }]}>
              Internet yok - Sadece journal kullanılabilir
            </Text>
          </View>

          {/* Journal Content */}
          <View style={styles.content}>
            <HomeContent />
          </View>

          {/* Bottom Info Bar */}
          <View style={[styles.bottomBar, { backgroundColor: colors.background, borderTopColor: colors.text + '20' }]}>
            <View style={styles.infoRow}>
              <View style={styles.statusDot} />
              <Text style={[styles.bottomText, { color: colors.text }]}>
                Yazılarınız offline kaydediliyor. İnternet bağlantısı geldiğinde otomatik senkronize edilecek.
              </Text>
            </View>
          </View>
        </SafeAreaView>
      </CurrentEntryContext.Provider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  offlineHeader: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  offlineIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  offlineText: {
    fontSize: 16,
    fontWeight: '600',
  },
  offlineSubtext: {
    fontSize: 14,
    opacity: 0.7,
  },
  content: {
    flex: 1,
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFA500',
  },
  bottomText: {
    fontSize: 12,
    opacity: 0.8,
    flex: 1,
  },
});
