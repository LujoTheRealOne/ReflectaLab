import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNetworkConnectivity } from '@/hooks/useNetworkConnectivity';
import { Wifi, WifiOff } from 'lucide-react-native';

interface NetworkStatusIndicatorProps {
  showWhenOnline?: boolean;
  style?: any;
}

export function NetworkStatusIndicator({ 
  showWhenOnline = false, 
  style 
}: NetworkStatusIndicatorProps) {
  const { isConnected, isInternetReachable } = useNetworkConnectivity();
  
  const isOffline = !isConnected || !isInternetReachable;
  
  // Only show when offline by default, unless showWhenOnline is true
  if (!isOffline && !showWhenOnline) {
    return null;
  }
  
  return (
    <View style={[styles.container, style, isOffline ? styles.offline : styles.online]}>
      {isOffline ? (
        <>
          <WifiOff size={16} color="#fff" />
          <Text style={styles.text}>Offline</Text>
        </>
      ) : (
        <>
          <Wifi size={16} color="#fff" />
          <Text style={styles.text}>Online</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  offline: {
    backgroundColor: '#FF6B6B',
  },
  online: {
    backgroundColor: '#4CAF50',
  },
  text: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
});
