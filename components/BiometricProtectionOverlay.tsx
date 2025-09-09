import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { Colors } from '@/constants/Colors';
import { useBiometricAuth } from '@/hooks/useBiometricAuth';
import { useBiometricProtection } from '@/hooks/useBiometricProtection';
import { Fingerprint, ScanFace,Shield } from 'lucide-react-native';

export const BiometricProtectionOverlay: React.FC = () => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { getAuthTypeLabel } = useBiometricAuth();
  const { isProtected, isAuthenticated, isAuthenticating, shouldAuthenticate, requestAuthentication } = useBiometricProtection();
  const hasAutoTriggered = useRef(false);

  // Auto-trigger authentication when overlay first appears
  useEffect(() => {
    if (shouldAuthenticate && !isAuthenticating && !hasAutoTriggered.current) {
      hasAutoTriggered.current = true;
      // Small delay to ensure overlay is rendered
      setTimeout(() => {
        requestAuthentication().catch(console.error);
      }, 300);
    }
    
    // Reset flag when overlay is hidden
    if (!shouldAuthenticate) {
      hasAutoTriggered.current = false;
    }
  }, [shouldAuthenticate, isAuthenticating, requestAuthentication]);

  // Don't show overlay if protection is disabled or user is already authenticated
  if (!isProtected || isAuthenticated || !shouldAuthenticate) {
    return null;
  }

  const handleAuthenticatePress = async () => {
    try {
      await requestAuthentication();
    } catch (error) {
      console.error('Authentication failed:', error);
    }
  };

  return (
    <View style={[styles.overlay, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <View style={[styles.iconContainer, { backgroundColor: colors.tint + '20' }]}>
          <Shield size={48} color={colors.tint} />
        </View>
        
        <Text style={[styles.title, { color: colors.text }]}>
          App Protected
        </Text>
        
        <Text style={[styles.subtitle, { color: colors.text }]}>
          Use {getAuthTypeLabel()} to unlock Reflecta
        </Text>
        
        {isAuthenticating ? (
          <View style={styles.authenticatingContainer}>
            <ActivityIndicator size="large" color={colors.tint} />
            <Text style={[styles.authenticatingText, { color: colors.text }]}>
              Authenticating...
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.authenticateButton, { backgroundColor: colors.tint }]}
            onPress={handleAuthenticatePress}
            activeOpacity={0.8}
          >
            {getAuthTypeLabel() === 'Face ID' ? (
              <ScanFace size={32} color={colors.background} />
            ) : (
              <Fingerprint size={32} color={colors.background} />
            )}
            <Text style={[styles.authenticateButtonText, { color: colors.background }]}>
              Authenticate with {getAuthTypeLabel()}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 40,
    maxWidth: 300,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 32,
    textAlign: 'center',
    opacity: 0.8,
  },
  authenticateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 16,
  },
  authenticateButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  authenticatingContainer: {
    alignItems: 'center',
    gap: 16,
  },
  authenticatingText: {
    fontSize: 16,
    opacity: 0.8,
  },
});
