import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { StyleSheet, Text, View, useColorScheme } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/hooks/useAuth';
import { AuthStackParamList } from '@/navigation/AuthNavigator';
import { Ionicons } from '@expo/vector-icons';
import { Alert } from 'react-native';

type LoginScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

type Props = {
  navigation: LoginScreenNavigationProp;
};

export default function LoginScreen({ navigation }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const { signInWithGoogle, signInWithApple, isLoading } = useAuth();

  const handleGoogleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error('Sign in error:', error);
      Alert.alert(
        'Sign In Error',
        'There was a problem signing you in. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleAppleLogin = async () => {
    try {
      await signInWithApple();
    } catch (error) {
      console.error('Apple sign in error:', error);
      Alert.alert(
        'Sign In Error',
        'There was a problem signing you in with Apple. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.logoContainer}>
        <Text allowFontScaling={false} style={[styles.title, { color: colors.text }]}>Reflecta.</Text>
        <Text style={[styles.subtitle, { color: colors.icon }]}>Your Journal & Mentor for your journey</Text>
      </View>

      {/* Buttons */}
      <View style={styles.buttonContainer}>
        <Button
          size="lg"
          variant="secondary"
          iconLeft={<Image source={require('@/assets/google-logo.svg')} style={{ width: 20, height: 20 }} />}
          onPress={handleGoogleLogin}
          disabled={isLoading}
          textStyle={{ color: colors.text }}
        >
          {isLoading ? 'Signing in...' : 'Continue with Google'}
        </Button>

        <Button
          variant="primary"
          iconLeft={<Ionicons name="logo-apple" size={24} color={colors.background} />}
          onPress={handleAppleLogin}
          size="lg"
          style={[styles.button]}
          textStyle={{ color: colors.background }}
          disabled={isLoading}
        >
          {isLoading ? 'Signing in...' : 'Continue with Apple'}
        </Button>

        <Text style={[styles.termsText, { color: colors.text }]}>
          By continuing you agree to our Terms of Service and Privacy Policies.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingBottom: 10,
  },
  logoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 48,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 5,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
    paddingBottom: 20,
    paddingTop: 50,
    paddingHorizontal: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  termsText: {
    textAlign: 'center',
    fontSize: 12,
    marginTop: 6,
    opacity: 0.3,
  },
}); 