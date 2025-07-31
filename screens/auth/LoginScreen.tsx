import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, Text, View, useColorScheme, Platform, Animated } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/hooks/useAuth';
import { AuthStackParamList } from '@/navigation/AuthNavigator';
import { Ionicons } from '@expo/vector-icons';
import { Alert } from 'react-native';
import * as Application from 'expo-application';
import Svg, { Path } from 'react-native-svg';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';

type LoginScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

type Props = {
  navigation: LoginScreenNavigationProp;
};

export default function LoginScreen({ navigation }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const { signInWithGoogle, signInWithApple, isLoading } = useAuth();
  
  // ========== ANIMATION CODE (COMMENTED OUT) ==========
  // // Animation states
  // const [showAnimation, setShowAnimation] = useState(true);
  // const [showTransition, setShowTransition] = useState(false);
  // const loginFadeAnim = useRef(new Animated.Value(0)).current;

  // // Split text into words and create animation values for each
  // const words = ["Most", "people", "never", "take", "the", "first", "step.", "You", "just", "did."];
  // const wordAnimations = useRef(
  //   words.map(() => ({
  //     opacity: new Animated.Value(0),
  //     scale: new Animated.Value(0.3),
  //   }))
  // ).current;

  // useEffect(() => {
  //   if (showAnimation && !showTransition) {
  //     // Wait 2 seconds before starting animation to sync with splash screen
  //     const initialDelay = setTimeout(() => {
  //       // Animate each word appearing one by one
  //       const animations = wordAnimations.map((anim, index) => {
  //         // Add extra delay after the first sentence (after "step.")
  //         const extraDelay = index >= 7 ? 800 : 0; // 800ms extra pause before "You just did."
          
  //         return Animated.sequence([
  //           Animated.delay((index * 200) + extraDelay), // Stagger each word by 200ms + extra delay for second sentence
  //           Animated.parallel([
  //             Animated.timing(anim.opacity, {
  //               toValue: 1,
  //               duration: 500,
  //               useNativeDriver: true,
  //             }),
  //             Animated.timing(anim.scale, {
  //               toValue: 1,
  //               duration: 500,
  //               useNativeDriver: true,
  //             }),
  //           ])
  //         ]);
  //       });

  //       // Start all word animations
  //       Animated.parallel(animations).start();

  //       // Wait for all words to appear + 1.5 seconds, then start transition
  //       const totalAnimationTime = (words.length * 200) + 800 + 500; // stagger time + extra pause + last word duration
  //       const timer = setTimeout(() => {
  //         // First: fade out all words
  //         Animated.parallel(
  //           wordAnimations.map(anim => 
  //             Animated.timing(anim.opacity, {
  //               toValue: 0,
  //               duration: 600,
  //               useNativeDriver: true,
  //             })
  //           )
  //         ).start(() => {
  //           // After text fades out, start login screen fade in
  //           setShowTransition(true);
            
  //           Animated.timing(loginFadeAnim, {
  //             toValue: 1,
  //             duration: 800,
  //             useNativeDriver: true,
  //           }).start(() => {
  //             // Animation complete, hide the animation screen
  //             setShowAnimation(false);
  //           });
  //         });
  //       }, totalAnimationTime + 1500); // animation time + 1.5s wait

  //       return () => clearTimeout(timer);
  //     }, 2000); // 2 second delay before animation starts

  //     return () => clearTimeout(initialDelay);
  //   }
  // }, [showAnimation, showTransition, loginFadeAnim]);
  // ========== END ANIMATION CODE ==========

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

  // Show animation screen first
  if (false) { // showAnimation
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* ========== ANIMATION SCREEN (COMMENTED OUT) ========== */}
        {/* <View style={styles.animationContainer}>
          <View style={styles.textLinesContainer}>
            <View style={styles.wordsContainer}>
              {words.slice(0, 4).map((word, index) => (
                <Animated.Text
                  key={index}
                  style={[
                    styles.animationWord,
                    { 
                      color: colors.text,
                      opacity: wordAnimations[index].opacity,
                      transform: [{ scale: wordAnimations[index].scale }],
                      marginRight: index < 3 ? 8 : 0,
                    }
                  ]}
                >
                  {word}
                </Animated.Text>
              ))}
            </View>
            <View style={styles.wordsContainer}>
              {words.slice(4, 7).map((word, index) => (
                <Animated.Text
                  key={index + 4}
                  style={[
                    styles.animationWord,
                    { 
                      color: colors.text,
                      opacity: wordAnimations[index + 4].opacity,
                      transform: [{ scale: wordAnimations[index + 4].scale }],
                      marginRight: index < 2 ? 8 : 0,
                    }
                  ]}
                >
                  {word}
                </Animated.Text>
              ))}
            </View>
            <View style={styles.wordsContainer}>
              {words.slice(7).map((word, index) => (
                <Animated.Text
                  key={index + 7}
                  style={[
                    styles.animationWord,
                    { 
                      color: colors.text,
                      opacity: wordAnimations[index + 7].opacity,
                      transform: [{ scale: wordAnimations[index + 7].scale }],
                      marginRight: index < words.slice(7).length - 1 ? 8 : 0,
                    }
                  ]}
                >
                  {word}
                </Animated.Text>
              ))}
            </View>
          </View>
        </View> */}
        
        {/* ========== LOGIN SCREEN OVERLAY (COMMENTED OUT) ========== */}
        {/* {false && ( // showTransition
          <Animated.View style={[
            StyleSheet.absoluteFillObject,
            { 
              backgroundColor: colors.background,
              opacity: loginFadeAnim,
            }
          ]}>
            <View style={styles.header}>
              <Text style={[styles.versionText, { color: colors.text, opacity: 0.6 }]}>
                Early Access  v.{Application.nativeApplicationVersion}
              </Text>
            </View>

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
                textStyle={{ color: colors.background }}
                disabled={isLoading}
              >
                {isLoading ? 'Signing in...' : 'Continue with Apple'}
              </Button>

              <Text style={[styles.termsText, { color: colors.text }]}>
                By continuing you agree to our Terms of Service and Privacy Policies.
              </Text>
            </View>
          </Animated.View>
        )} */}
        {/* ========== END COMMENTED SECTIONS ========== */}
      </View>
    );
  }

  // Show actual login screen
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
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
          textStyle={{ color: colors.background }}
          disabled={isLoading}
        >
          {isLoading ? 'Signing in...' : 'Continue with Apple'}
        </Button>

        <Text style={[styles.termsText, { color: colors.text }]}>
          By continuing you agree to our Terms of Service and Privacy Policies.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  animationContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  textLinesContainer: {
    flexDirection: 'column',
    gap: 8,
    alignItems: 'center',
  },
  wordsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  animationWord: {
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 32,
  },
  header: {
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