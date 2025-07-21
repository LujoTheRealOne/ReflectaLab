import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { StyleSheet, Text, View, useColorScheme, Platform } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/hooks/useAuth';
import { AuthStackParamList } from '@/navigation/AuthNavigator';
import { Ionicons } from '@expo/vector-icons';
import { Alert } from 'react-native';
import * as Application from 'expo-application';
import Svg, { Path } from 'react-native-svg';
import { Image } from 'expo-image';

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
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.versionText, { color: colors.text, opacity: 0.6 }]}>
          Early Access  v.{Application.nativeApplicationVersion}
        </Text>
      </View>

      {/* Content */}
      <View style={styles.contentContainer}>
        <View style={[styles.artworkContainer]}>
          <View style={{ backgroundColor: colorScheme == 'light' ? '#EEE' : '#222', padding: 10, boxShadow: `0 5px 20px 0 rgba(50, 50, 50, 0.3)` }}>
            <Image source={require('@/assets/images/artwork.png')} style={{ width: 180, height: 250 }} />
          </View>
        </View>

        <View style={styles.textContainer}>
          <Text style={[styles.welcomeText, { color: colors.text, opacity: 0.7 }]}>
            Welcome to Reflecta.
          </Text>
          <Text style={[styles.mainText, { color: colors.text }]}>
            The world's loud.{'\n'}This is where you{'\n'}hear yourself.
          </Text>
        </View>
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
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  header: {
    paddingTop: 60,
    alignItems: 'center',
  },
  versionText: {
    fontSize: 14,
    fontWeight: '400',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  welcomeText: {
    fontSize: 18,
    fontWeight: '400',
    textAlign: 'center',
    marginBottom: 10,
  },
  mainText: {
    fontSize: 32,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 40,
  },
  buttonContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 12,
  },
  termsText: {
    textAlign: 'center',
    fontSize: 12,
    marginTop: 6,
    opacity: 0.3,
  },
  button: {
    borderRadius: 24,
    height: 70,
    paddingVertical: 16,
  },
  bottomIndicator: {
    alignItems: 'center',
    paddingBottom: 10,
  },
  artworkContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  textContainer: {
    alignItems: 'center',
  },
}); 