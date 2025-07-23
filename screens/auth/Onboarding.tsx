import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState, useEffect, useRef } from 'react';
import { Platform, StyleSheet, Text, TextInput, View, useColorScheme, Keyboard, Animated, TouchableOpacity, Alert } from 'react-native';
import Slider from '@react-native-community/slider';

import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/hooks/useAuth';
import { Ionicons } from '@expo/vector-icons';
import * as Application from 'expo-application';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { AuthStackParamList } from '@/navigation/AuthNavigator';

type OnboardingScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Onboarding'>;

export default function OnboardingScreen() {
  const navigation = useNavigation<OnboardingScreenNavigationProp>();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [currentStep, setCurrentStep] = useState(1);
  const [name, setName] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedSelfReflection, setSelectedSelfReflection] = useState<string[]>([]);
  const [clarityLevel, setClarityLevel] = useState(0.7);
  const [stressLevel, setStressLevel] = useState(0.2);
  const [hasInteractedWithClaritySlider, setHasInteractedWithClaritySlider] = useState(false);
  const [hasInteractedWithStressSlider, setHasInteractedWithStressSlider] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isNameInputFocused, setIsNameInputFocused] = useState(false);

  const keyboardOffset = useRef(new Animated.Value(0)).current;

  const roleOptions = [
    'Founder', 'Designer', 'Academic',
    'Investor', 'Developer', 'Consultant', 'Healthcare',
    'Writer', 'Student', 'Creative / Artist',
    'Entrepreneur', 'Other'
  ];

  const selfReflectionOptions = [
    'Journaling', 'Meditation', 'Mindfulness', 'Breathing', 'Exercise', 'Other'
  ];

  const toggleSelfReflection = (selfReflection: string) => {
    setSelectedSelfReflection(prev =>
      prev.includes(selfReflection)
        ? prev.filter(r => r !== selfReflection)
        : [...prev, selfReflection]
    );
  };

  const toggleRole = (role: string) => {
    setSelectedRoles(prev =>
      prev.includes(role)
        ? prev.filter(r => r !== role)
        : [...prev, role]
    );
  };

  useEffect(() => {
    const keyboardWillShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (event) => {
        Animated.timing(keyboardOffset, {
          toValue: -event.endCoordinates.height, // Move up by 20% of keyboard height
          duration: Platform.OS === 'ios' ? event.duration || 250 : 250,
          useNativeDriver: true,
        }).start();
      }
    );

    const keyboardWillHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      (event) => {
        Animated.timing(keyboardOffset, {
          toValue: 0,
          duration: Platform.OS === 'ios' ? event.duration || 250 : 250,
          useNativeDriver: true,
        }).start();
      }
    );

    return () => {
      keyboardWillShowListener?.remove();
      keyboardWillHideListener?.remove();
    };
  }, [keyboardOffset]);

  const handleContinue = () => {
    if (currentStep < 7) {
      // Reset interaction states when moving to slider steps
      if (currentStep === 3) {
        setHasInteractedWithClaritySlider(false);
      } else if (currentStep === 4) {
        setHasInteractedWithStressSlider(false);
      }
      setCurrentStep(currentStep + 1);
    } else {
      // Handle final submission
      console.log('Name:', name);
      console.log('Selected Roles:', selectedRoles);
      console.log('Selected Self Reflection:', selectedSelfReflection);
      console.log('Clarity Level:', clarityLevel);
      console.log('Stress Level:', stressLevel);
    }
  };

  const handleBack = () => {
    if (currentStep === 1) {
      // Go back to login screen
      Alert.alert('Go back?', 'Are you sure you want to cancel this onboarding? You will lose all your progress.', [
        { text: 'Continue', style: 'cancel' },
        { text: 'Go back', style: 'destructive', onPress: () => navigation.goBack() }
      ]);
    } else {
      // Reset interaction states when going back from slider steps
      if (currentStep === 5) {
        setHasInteractedWithStressSlider(false);
      } else if (currentStep === 4) {
        setHasInteractedWithClaritySlider(false);
      }
      // Go to previous step
      setCurrentStep(currentStep - 1);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <>
            <View style={styles.headerContainer}>
              <Text style={styles.headerText}>
                Step 1
              </Text>
              <Text style={[styles.mainText, { color: colors.text }]}>
                What's your name?
              </Text>
            </View>
            <TextInput
              style={[
                styles.input,
                isNameInputFocused && styles.inputFocused,
                { backgroundColor: `${colors.tint}11`, color: colors.text }
              ]}
              value={name}
              onChangeText={setName}
              onFocus={() => setIsNameInputFocused(true)}
              onBlur={() => setIsNameInputFocused(false)}
              cursorColor={'#2563EB'}
              placeholder="e.g. Max"
              placeholderTextColor={`${colors.text}66`}
              returnKeyType="next"
              onSubmitEditing={handleContinue}
            />
          </>
        );
      case 2:
        return (
          <>
            <View style={styles.headerContainer}>
              <Text style={styles.headerText}>
                Step 2
              </Text>
              <Text style={[styles.mainText, { color: colors.text }]}>
                {name}, what do you do in life?
              </Text>
            </View>
            <View style={styles.rolesContainer}>
              {roleOptions.map((role, index) => (
                <TouchableOpacity
                  key={`${role}-${index}`}
                  style={[
                    styles.multiselectButton,
                    { backgroundColor: `${colors.tint}0A` },
                    selectedRoles.includes(role) && { backgroundColor: colors.tint }
                  ]}
                  onPress={() => toggleRole(role)}
                >
                  <Text style={[
                    styles.roleText,
                    selectedRoles.includes(role) && { color: colors.background }
                  ]}>
                    {role}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        );
      case 3:
        return (
          <>
            <View style={styles.headerContainer}>
              <Text style={styles.headerText}>
                Step 3
              </Text>
              <Text style={[styles.mainText, { color: colors.text }]}>
                Which of these self reflection practices have you tried?
              </Text>
            </View>
            <View style={styles.rolesContainer}>
              {selfReflectionOptions.map((role, index) => (
                <TouchableOpacity
                  key={`${role}-${index}`}
                  style={[
                    styles.multiselectButton,
                    { backgroundColor: `${colors.tint}0A` },
                    selectedSelfReflection.includes(role) && { backgroundColor: colors.tint }
                  ]}
                  onPress={() => toggleSelfReflection(role)}
                >
                  <Text style={[
                    styles.roleText,
                    selectedSelfReflection.includes(role) && { color: colors.background }
                  ]}>
                    {role}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        );
      case 4:
        return (
          <>
            <View style={styles.headerContainer}>
              <Text style={styles.headerText}>
                Step 4
              </Text>
              <Text style={[styles.mainText, { color: colors.text }]}>
                How clear do you feel about your life & goals right now?
              </Text>
            </View>
            <View style={styles.sliderContainer}>
              <View style={styles.sliderLabels}>
                <Text style={[
                  styles.sliderLabelText,
                  {
                    fontSize: 14 + (1 - clarityLevel) * 4, // Larger when closer to 0
                  }
                ]}>
                  Totally Unclear
                </Text>
                <Text style={[
                  styles.sliderLabelText,
                  {
                    fontSize: 14 + clarityLevel * 4, // Larger when closer to 1
                  }
                ]}>
                  Very Clear
                </Text>
              </View>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={1}
                value={clarityLevel}
                onValueChange={(value) => setClarityLevel(Math.round(value * 10) / 10)}
                onSlidingStart={() => setHasInteractedWithClaritySlider(true)}
                minimumTrackTintColor="#2563EB"
                maximumTrackTintColor="#E5E5E7"
                thumbTintColor="white"
              />
            </View>
          </>
        );
      case 5:
        return (
          <>
            <View style={styles.headerContainer}>
              <Text style={styles.headerText}>
                Step 5
              </Text>
              <Text style={[styles.mainText, { color: colors.text }]}>
                {name}, honestly, how stressful is your life currently?              </Text>
            </View>
            <View style={styles.sliderContainer}>
              <View style={styles.sliderLabels}>
                <Text style={[
                  styles.sliderLabelText,
                  {
                    fontSize: 14 + (1 - stressLevel) * 4, // Larger when closer to 0
                  }
                ]}>
                  Not at all
                </Text>
                <Text style={[
                  styles.sliderLabelText,
                  {
                    fontSize: 14 + stressLevel * 4, // Larger when closer to 1
                  }
                ]}>
                  Extremely stressful
                </Text>
              </View>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={1}
                value={stressLevel}
                onValueChange={(value) => setStressLevel(Math.round(value * 10) / 10)}
                onSlidingStart={() => setHasInteractedWithStressSlider(true)}
                minimumTrackTintColor="#2563EB"
                maximumTrackTintColor="#E5E5E7"
                thumbTintColor="white"
              />
            </View>
          </>
        );
      case 6:
        return (
          <>
            <View style={[styles.headerContainer, { gap: 30, flex: 1, justifyContent: 'center' }]}>
              <Text style={[styles.headerText, { color: colors.text, textAlign: 'center', fontSize: 16 }]}>
                Most people stay stuck in the noise.
              </Text>
              <Text style={[styles.headerText, { color: colors.text, textAlign: 'center', fontSize: 16 }]}>
                You just pressed pause—and that changes everything.
              </Text>
            </View>
          </>
        );
      case 7:
        return (
          <>
            <View style={[styles.headerContainer, { gap: 30, flex: 1, justifyContent: 'center', width: '100%' }]}>
              <Text style={[styles.mainText, { color: colors.background, textAlign: 'center' }]}>
                The unfair advantage nobody talks about.
              </Text>
              <Text style={[styles.mainText, { color: colors.background, textAlign: 'center' }]}>
                Studying yourself.
              </Text>
            </View>
          </>
        );
      default:
        return null;
    }
  };

  const isStepValid = () => {
    if (currentStep === 1) return name.length > 0;
    if (currentStep === 2) return selectedRoles.length > 0;
    if (currentStep === 3) return selectedSelfReflection.length > 0;
    if (currentStep === 4) return hasInteractedWithClaritySlider;
    if (currentStep === 5) return hasInteractedWithStressSlider;
    if (currentStep === 6) return true;
    if (currentStep === 7) return true;
    return false;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: currentStep === 7 ? colors.tint : colors.background }]}>
      <Animated.View
        style={[
          styles.contentContainer,
          {
            transform: [{ translateY: keyboardOffset }]
          }
        ]}
      >
        {renderStepContent()}
      </Animated.View>

      <Animated.View
        style={[
          styles.buttonContainer,
          {
            transform: [{ translateY: keyboardOffset }]
          }
        ]}
      >
        <View style={styles.buttonRow}>
          <Button
            variant="secondary"
            onPress={handleBack}
            style={[styles.backButton, { borderColor: 'transparent', backgroundColor: currentStep === 7 ? `${colors.background}1A` : `${colors.tint}11` }]}
          >
            <Ionicons name="chevron-back" size={24} color={currentStep === 7 ? colors.background : colors.text} />
          </Button>
          <Button
            variant="primary"
            onPress={handleContinue}
            size="lg"
            style={[styles.continueButtonWithBack, { backgroundColor: currentStep === 7 ? colors.background : colors.text, borderColor: 'transparent' }]}
            textStyle={{ color: currentStep === 7 ? colors.text : colors.background }}
            disabled={isLoading || !isStepValid()}
          >
            {isLoading ? 'Loading...' : 'Continue'}
          </Button>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'space-between',
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
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
    padding: 20,
    gap: 24,
  },
  headerText: {
    fontSize: 18,
    fontWeight: '500',
    textAlign: 'left',
    color: '#2563EB',
  },
  mainText: {
    fontSize: 32,
    fontWeight: '600',
    textAlign: 'left',
    lineHeight: 40,
  },
  buttonContainer: {
    paddingHorizontal: 20,
    gap: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    width: 64,
    height: 64,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  continueButtonWithBack: {
    flex: 1,
  },
  headerContainer: {
    gap: 4,
  },
  input: {
    borderWidth: 1.5,
    borderColor: 'transparent',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 20,
    fontSize: 18,
    fontWeight: '500',
    width: '100%',
  },
  inputFocused: {
    borderColor: '#2563EB',
  },
  rolesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    width: '100%',
  },
  multiselectButton: {
    borderRadius: 32,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderWidth: 0,
    minWidth: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666666',
    textAlign: 'center',
  },
  sliderContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: 20,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 10,
  },
  sliderLabelText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666666',
  },
  slider: {
    width: '100%',
    height: 64,
  },
}); 