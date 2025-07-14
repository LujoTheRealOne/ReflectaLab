import { Colors } from '@/constants/Colors';
import { WifiOff } from 'lucide-react-native';
import React from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  useColorScheme,
  View
} from 'react-native';

interface NetworkStatusModalProps {
  visible: boolean;
}

export const NetworkStatusModal: React.FC<NetworkStatusModalProps> = ({
  visible,
}) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent={true}
    >
      <View style={[styles.overlay, { backgroundColor: colors.background }]}>
        <View style={[styles.container]}>
          <View style={styles.iconContainer}>
            <WifiOff size={64} color={colors.text} strokeWidth={2} />
          </View>
          
          <Text style={[styles.title, { color: colors.text }]}>
            No Internet Connection
          </Text>
          
          <Text style={[styles.message, { color: colors.text }]}>
            Reflecta requires an active internet connection to sync your thoughts and access all features. 
            Please check your connection and try again.
          </Text>
          
          <Text style={[styles.helpText, { color: colors.text }]}>
            Make sure you're connected to Wi-Fi or mobile data.
          </Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  container: {
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    maxWidth: 350,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  iconContainer: {
    marginBottom: 20,
    opacity: 0.8,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 15,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 30,
    opacity: 0.8,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 20,
    gap: 8,
  },
  retryText: {
    fontSize: 16,
    fontWeight: '600',
  },
  helpText: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.6,
  },
}); 