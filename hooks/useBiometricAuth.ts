import { useCallback, useEffect, useState } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const BIOMETRIC_ENABLED_KEY = 'biometric_auth_enabled';

export interface BiometricAuthState {
  isSupported: boolean;
  isEnrolled: boolean;
  isEnabled: boolean;
  isLoading: boolean;
  supportedTypes: LocalAuthentication.AuthenticationType[];
}

export const useBiometricAuth = () => {
  const [state, setState] = useState<BiometricAuthState>({
    isSupported: false,
    isEnrolled: false,
    isEnabled: false,
    isLoading: true,
    supportedTypes: [],
  });

  // Check device biometric capabilities
  const checkBiometricCapabilities = useCallback(async () => {
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
      
      // Load saved preference
      const savedPreference = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
      const isEnabled = savedPreference === 'true' && compatible && enrolled;

      setState({
        isSupported: compatible,
        isEnrolled: enrolled,
        isEnabled,
        isLoading: false,
        supportedTypes,
      });

      return { compatible, enrolled, supportedTypes };
    } catch (error) {
      console.error('Error checking biometric capabilities:', error);
      setState(prev => ({ ...prev, isLoading: false }));
      return { compatible: false, enrolled: false, supportedTypes: [] };
    }
  }, []);

  // Enable/disable biometric authentication
  const setBiometricEnabled = useCallback(async (enabled: boolean): Promise<boolean> => {
    try {
      if (enabled && !state.isSupported) {
        throw new Error('Biometric authentication is not supported on this device');
      }

      if (enabled && !state.isEnrolled) {
        throw new Error('No biometric credentials are enrolled on this device');
      }

      // Test authentication before enabling
      if (enabled) {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Authenticate to enable Face ID protection',
          fallbackLabel: 'Use Passcode',
          cancelLabel: 'Cancel',
        });

        if (!result.success) {
          return false;
        }
      }

      // Save preference
      await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, enabled.toString());
      
      setState(prev => ({ ...prev, isEnabled: enabled }));
      return true;
    } catch (error) {
      console.error('Error setting biometric preference:', error);
      throw error;
    }
  }, [state.isSupported, state.isEnrolled]);

  // Authenticate with biometrics
  const authenticate = useCallback(async (
    promptMessage: string = 'Authenticate with Face ID'
  ): Promise<LocalAuthentication.LocalAuthenticationResult> => {
    try {
      if (!state.isEnabled) {
        throw new Error('Biometric authentication is not enabled');
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage,
        fallbackLabel: 'Use Passcode',
        cancelLabel: 'Cancel',
      });

      return result;
    } catch (error) {
      console.error('Error during biometric authentication:', error);
      throw error;
    }
  }, [state.isEnabled]);

  // Get authentication type label
  const getAuthTypeLabel = useCallback((): string => {
    if (state.supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      return 'Face ID';
    }
    if (state.supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      return 'Touch ID';
    }
    if (state.supportedTypes.includes(LocalAuthentication.AuthenticationType.IRIS)) {
      return 'Iris Scan';
    }
    return 'Biometric Authentication';
  }, [state.supportedTypes]);

  // Initialize on mount
  useEffect(() => {
    checkBiometricCapabilities();
  }, [checkBiometricCapabilities]);

  return {
    ...state,
    setBiometricEnabled,
    authenticate,
    checkBiometricCapabilities,
    getAuthTypeLabel,
  };
};
