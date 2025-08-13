import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState, useEffect, useRef } from 'react';
import { Platform, StyleSheet, Text, TextInput, View, useColorScheme, Keyboard, Animated, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import Slider from '@react-native-community/slider';
import Svg, { Path, Rect, Circle, Defs, Pattern } from 'react-native-svg';
import { PanGestureHandler, State as GestureState, type PanGestureHandlerGestureEvent, type HandlerStateChangeEvent, type PanGestureHandlerEventPayload } from 'react-native-gesture-handler';
import { BlurView } from 'expo-blur';

import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/hooks/useAuth';
import { ChevronLeft, Headphones } from 'lucide-react-native';
import * as Application from 'expo-application';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { AuthStackParamList } from '@/navigation/AuthNavigator';
import { useAudioPlayer } from 'expo-audio';
import { setAudioModeAsync } from 'expo-audio';
import { FirestoreService } from '@/lib/firestore';
import { useAnalytics } from '@/hooks/useAnalytics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

type OnboardingScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Onboarding'>;

export default function OnboardingScreen() {
  const navigation = useNavigation<OnboardingScreenNavigationProp>();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { firebaseUser, signOut } = useAuth();
  const { trackOnboardingCompleted } = useAnalytics();
  const accentColors = {
    'blue': '#2563EB',
    'orange': '#FF4500'
  };

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
  const [coachingStylePosition, setCoachingStylePosition] = useState({ x: 0, y: 0 });
  const [hasInteractedWithCoachingStyle, setHasInteractedWithCoachingStyle] = useState(false);
  const [timeDuration, setTimeDuration] = useState(10); // Default to 10 minutes
  const [hasInteractedWithTimeSlider, setHasInteractedWithTimeSlider] = useState(false);
  const [timerMinutes, setTimerMinutes] = useState(5);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerEnded, setTimerEnded] = useState(false);
  const [showPauseOverlay, setShowPauseOverlay] = useState(false);

  const keyboardOffset = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const buttonSlideAnim = useRef(new Animated.Value(0)).current;
  const loadingPulseAnim = useRef(new Animated.Value(1)).current;
  const pauseOverlayAnim = useRef(new Animated.Value(0)).current;
  const onboardingStartTime = useRef(Date.now()).current;

  const roleOptions = [
    'Founder', 'Designer', 'Academic',
    'Investor', 'Developer', 'Consultant', 'Healthcare',
    'Writer', 'Student', 'Creative / Artist',
    'Entrepreneur', 'Other'
  ];

  const selfReflectionOptions = [
    'Journaling', 'Meditation', 'Mindfulness', 'Breathing', 'Exercise', 'Other'
  ];

  // Initialize audio player for meditation bell
  const bellPlayer = useAudioPlayer(require('@/assets/mediation_bell.mp3'));
  
  // Initialize audio player for meditation audio from local asset
  const meditationPlayer = useAudioPlayer(require('@/assets/5m_meditation.wav'));

  // Function to play meditation bell sound
  const playMeditationBell = async () => {
    try {
      // Configure audio to play even in silent mode
      await setAudioModeAsync({
        playsInSilentMode: true,
      });
      
      bellPlayer.seekTo(0);
      bellPlayer.play();
    } catch (error) {
      console.log('Error playing meditation bell:', error);
    }
  };

  // Function to prepare meditation audio (local asset is already loaded)
  const loadMeditationAudio = async () => {
    try {
      // Configure audio to play even in silent mode
      await setAudioModeAsync({
        playsInSilentMode: true,
      });

      console.log('Meditation audio loaded from local asset');
      console.log('Audio player isLoaded:', meditationPlayer.isLoaded);
    } catch (error) {
      console.log('Error configuring meditation audio:', error);
    }
  };

  // Function to start meditation audio
  const startMeditationAudio = async () => {
    try {
      console.log('Starting meditation audio...');
      console.log('Audio player isLoaded:', meditationPlayer.isLoaded);
      
      meditationPlayer.seekTo(0);
      meditationPlayer.play();
      console.log('Meditation audio started successfully');
    } catch (error) {
      console.log('Error starting meditation audio:', error);
      console.log('Error details:', error);
    }
  };

  // Function to pause meditation audio
  const pauseMeditationAudio = () => {
    try {
      meditationPlayer.pause();
      console.log('Meditation audio paused');
    } catch (error) {
      console.log('Error pausing meditation audio:', error);
    }
  };

  // Function to resume meditation audio
  const resumeMeditationAudio = () => {
    try {
      meditationPlayer.play();
      console.log('Meditation audio resumed');
    } catch (error) {
      console.log('Error resuming meditation audio:', error);
    }
  };

  // Function to stop meditation audio
  const stopMeditationAudio = () => {
    try {
      meditationPlayer.pause();
      meditationPlayer.seekTo(0);
    } catch (error) {
      console.log('Error stopping meditation audio:', error);
    }
  };



  // SVG Icon Components
  const LeadershipIcon = ({ color }: { color: string }) => (
    <Svg width="16" height="16" viewBox="0 0 15 15" fill="none">
      <Path d="M10.7868 13.5116C10.6308 14.076 9.94126 14.2871 9.49607 13.9067L0.235373 5.99511C-0.244596 5.58506 -0.0827769 4.80667 0.520852 4.62189L13.0267 0.793705C13.6304 0.608927 14.2002 1.16335 14.032 1.77181L10.7868 13.5116Z" fill={color} />
    </Svg>
  );

  const RelationshipsIcon = ({ color }: { color: string }) => (
    <Svg width="16" height="16" viewBox="0 0 14 13" fill="none">
      <Path d="M7.00005 -0.000105182C8.25821 -0.000105237 9.48812 0.372984 10.5342 1.07198C11.5804 1.77098 12.3957 2.76449 12.8772 3.92688C13.3587 5.08927 13.4847 6.36833 13.2392 7.60232C12.9937 8.83631 12.3879 9.9698 11.4982 10.8595C10.6086 11.7491 9.47508 12.355 8.2411 12.6004C7.00711 12.8459 5.72805 12.7199 4.56566 12.2384C3.40327 11.7569 2.40976 10.9416 1.71076 9.89547C1.01176 8.84935 0.638672 7.61944 0.638672 6.36128L7.00005 6.36128L7.00005 -0.000105182Z" fill={color} />
    </Svg>
  );

  const WorkIcon = ({ color }: { color: string }) => (
    <Svg width="16" height="16" viewBox="0 0 16 15" fill="none">
      <Rect x="5.91504" width="11.3919" height="11.3919" rx="2" transform="rotate(30 5.91504 0)" fill={color} />
    </Svg>
  );

  // Interactive Circular Time Display Component - Crosswalk style
  const CircularTimeDisplay = () => {
    const sliderSize = 320; // Slightly larger
    const centerX = sliderSize / 2;
    const centerY = sliderSize / 2;
    const radius = 130; // Distance from center to segments - increased
    const segmentWidth = 18; // Width of each crosswalk stripe - thicker
    const segmentHeight = 36; // Height of each crosswalk stripe - longer
    const totalSegments = 25; // One for each minute

    // Compute knob position based on current timeDuration
    const getKnobPosition = () => {
      const index = Math.max(0, Math.min(totalSegments - 1, timeDuration - 1));
      const angleDeg = (index / totalSegments) * 360 - 90; // start from top
      const angleRad = (angleDeg * Math.PI) / 180;
      const knobX = centerX + radius * Math.cos(angleRad);
      const knobY = centerY + radius * Math.sin(angleRad);
      return { x: knobX, y: knobY };
    };

    // Calculate angle from touch position
    const calculateAngleFromTouch = (touchX: number, touchY: number): number => {
      const deltaX = touchX - centerX;
      const deltaY = touchY - centerY;
      let angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;
      
      // Convert to 0-360 range starting from top (-90 degrees)
      angle = (angle + 90 + 360) % 360;
      
      return angle;
    };

    // Calculate time duration from angle
    const calculateTimeFromAngle = (angle: number): number => {
      // Convert angle to segment index (0-24)
      const segmentIndex = Math.round((angle / 360) * totalSegments);
      // Ensure it's within bounds (1-25 minutes)
      const minutes = Math.max(1, Math.min(25, segmentIndex + 1));
      return minutes;
    };

    // Handle pan gesture - continuously map touch to minutes
    const handlePanGesture = (event: PanGestureHandlerGestureEvent | HandlerStateChangeEvent<PanGestureHandlerEventPayload>): void => {
      const { x, y, locationX, locationY } = event.nativeEvent;
      const touchX = typeof x === 'number' ? x : locationX;
      const touchY = typeof y === 'number' ? y : locationY;

      if (typeof touchX !== 'number' || typeof touchY !== 'number') {
        return;
      }

      const angle = calculateAngleFromTouch(touchX, touchY);
      const newTimeDuration = calculateTimeFromAngle(angle);
      
      if (newTimeDuration !== timeDuration) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setTimeDuration(newTimeDuration);
      }
    };

    // Called for every pan frame
    const onGestureEvent = (event: PanGestureHandlerGestureEvent): void => {
      handlePanGesture(event);
    };

    // Set interaction flag and also update immediately when gesture begins/ends
    const onHandlerStateChange = (event: HandlerStateChangeEvent<PanGestureHandlerEventPayload>): void => {
      if (event.nativeEvent.state === GestureState.BEGAN) {
        setHasInteractedWithTimeSlider(true);
        handlePanGesture(event);
      }
      if (event.nativeEvent.state === GestureState.ACTIVE) {
        handlePanGesture(event);
      }
      if (event.nativeEvent.state === GestureState.END) {
        handlePanGesture(event);
      }
    };

    // Generate crosswalk-style segments
    const generateSegments = () => {
      const segments = [];
      for (let i = 0; i < totalSegments; i++) {
        const angle = (i / totalSegments) * 360 - 90; // Start from top, -90 degrees
        const radian = (angle * Math.PI) / 180;

        // Calculate position for this segment
        const x = centerX + radius * Math.cos(radian);
        const y = centerY + radius * Math.sin(radian);

        // Determine if this segment should be orange (filled) or gray (unfilled)
        const isActive = i < timeDuration;
        const fillColor = isActive ? accentColors.orange : `${colors.text}20`;

        segments.push(
          <Rect
            key={i}
            x={x - segmentWidth / 2}
            y={y - segmentHeight / 2}
            width={segmentWidth}
            height={segmentHeight}
            fill={fillColor}
            rx={2} // Slightly rounded corners
            transform={`rotate(${angle + 90} ${x} ${y})`} // Rotate segment to face outward
          />
        );
      }
      return segments;
    };

    return (
      <View style={styles.circularDisplayContainer}>
        <View style={styles.displayWrapper}>
          {/* Full-area pan handler: press-hold anywhere on the ring and drag */}
          <PanGestureHandler
            onGestureEvent={onGestureEvent}
            onHandlerStateChange={onHandlerStateChange}
            minDist={0}
          >
            <Animated.View
              style={{
                position: 'absolute',
                width: sliderSize,
                height: sliderSize,
                zIndex: 1,
              }}
            />
          </PanGestureHandler>

          <Svg width={sliderSize} height={sliderSize}>
            {/* Crosswalk-style segments */}
            {generateSegments()}
          </Svg>

          {/* Center display */}
          <View style={styles.centerDisplay}>
            <Text style={[styles.timeDisplay, { color: accentColors.orange }]}>
              {timeDuration} min
            </Text>
          </View>
        </View>
      </View>
    );
  };

  // 4-Directional Coaching Style Selector Component
  const CoachingStyleSelector = () => {
    const panRef = useRef(null);
    const animatedPosition = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
    const currentPosition = useRef({ x: 0, y: 0 });
    const selectorSize = 300; // Reasonable size that fits on mobile screens
    const controlSize = 60;
    const labelPadding = 20; // Reduced padding - knob can get closer to labels
    const maxX = (selectorSize - controlSize - labelPadding) / 2; // Max horizontal movement
    const maxY = (selectorSize - controlSize - labelPadding) / 2; // Max vertical movement

    // Initialize position from existing state when component mounts
    useEffect(() => {
      const initialX = coachingStylePosition.x * maxX;
      const initialY = -coachingStylePosition.y * maxY; // Invert Y back

      currentPosition.current = { x: initialX, y: initialY };
      animatedPosition.setValue({ x: initialX, y: initialY });
    }, []); // Only run once when component mounts

    const onGestureStateChange = (event: any) => {
      if (event.nativeEvent.state === GestureState.BEGAN) {
        setHasInteractedWithCoachingStyle(true);
      }

      if (event.nativeEvent.state === GestureState.END || event.nativeEvent.state === GestureState.CANCELLED) {
        const { translationX, translationY } = event.nativeEvent;

        // Calculate new position from current position plus translation
        let newX = currentPosition.current.x + translationX;
        let newY = currentPosition.current.y + translationY;

        // Constrain to rectangular bounds
        newX = Math.max(-maxX, Math.min(maxX, newX));
        newY = Math.max(-maxY, Math.min(maxY, newY));

        // Update current position
        currentPosition.current = { x: newX, y: newY };

        // Update state with rounded values (2 decimal places)
        setCoachingStylePosition({
          x: Math.round((newX / maxX) * 100) / 100,
          y: Math.round((-newY / maxY) * 100) / 100
        }); // Invert Y for UI coordinates

        // Set final absolute position
        animatedPosition.setValue({ x: newX, y: newY });
      }
    };

    const handlePanGesture = (event: any) => {
      const { translationX, translationY } = event.nativeEvent;

      // Calculate what the new position would be
      let newX = currentPosition.current.x + translationX;
      let newY = currentPosition.current.y + translationY;

      // Constrain to rectangular bounds
      newX = Math.max(-maxX, Math.min(maxX, newX));
      newY = Math.max(-maxY, Math.min(maxY, newY));

      // Update the animated position directly
      animatedPosition.setValue({
        x: newX,
        y: newY
      });
    };

    const DottedGrid = () => (
      <Svg width={selectorSize} height={selectorSize} style={styles.dottedGrid}>
        <Defs>
          <Pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <Circle cx="10" cy="10" r="1" fill={`${colors.text}20`} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#grid)" />
        {/* Center lines */}
        <Path d={`M ${selectorSize / 2} 0 L ${selectorSize / 2} ${selectorSize}`} stroke={`${colors.text}15`} strokeWidth="1" />
        <Path d={`M 0 ${selectorSize / 2} L ${selectorSize} ${selectorSize / 2}`} stroke={`${colors.text}15`} strokeWidth="1" />
      </Svg>
    );

    return (
      <View style={styles.coachingSelectorContainer}>
        <View style={styles.selectorWrapper}>
          {/* All labels positioned inside the area */}
          <Text style={[styles.selectorLabel, styles.selectorLabelTop, { color: colors.text }]}>
            Friendliness
          </Text>
          <Text style={[styles.selectorLabel, styles.selectorLabelBottom, { color: colors.text }]}>
            Challenging
          </Text>
          <Text style={[styles.selectorLabel, styles.selectorLabelLeft, { color: colors.text }]}>
            Active
          </Text>
          <Text style={[styles.selectorLabel, styles.selectorLabelRight, { color: colors.text }]}>
            Passive
          </Text>

          {/* Grid background */}
          <View style={[styles.selectorArea, { backgroundColor: `${colors.tint}05` }]}>
            <DottedGrid />

            {/* Draggable control */}
            <PanGestureHandler
              ref={panRef}
              onGestureEvent={handlePanGesture}
              onHandlerStateChange={onGestureStateChange}
            >
              <Animated.View
                style={[
                  styles.selectorControl,
                  {
                    backgroundColor: `${colors.background}B3`, // Semi-transparent base
                    borderColor: `${colors.background}40`,
                    transform: animatedPosition.getTranslateTransform(),
                  }
                ]}
              >
                {/* Glass effect layers */}
                <View style={[styles.glassLayer1, { backgroundColor: `${colors.background}60` }]} />
                <View style={[styles.glassLayer2, { backgroundColor: `${colors.background}80` }]} />
                <View style={[styles.glassHighlight, { backgroundColor: `${colors.background}A0` }]} />
                <View style={[styles.selectorControlInner, { backgroundColor: `${colors.text}A0` }]} />
              </Animated.View>
            </PanGestureHandler>
          </View>
        </View>

        <Text style={[styles.selectorInstructions, { color: `${colors.text}80` }]}>
          Move the glass button around for configuration.
        </Text>
      </View>
    );
  };

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

  const animateToStep = (newStep: number) => {
    // Handle button animations for case 13
    if (newStep === 13 || newStep === 16) {
      // Slide buttons down when entering case 13
      Animated.timing(buttonSlideAnim, {
        toValue: 200, // Slide down by 200 pixels
        duration: 500,
        useNativeDriver: true,
      }).start();
    } else if (currentStep === 13 && newStep === 14) {
      // Slide buttons back up when leaving case 13 to case 14
      setTimeout(() => {
        Animated.timing(buttonSlideAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }).start();
      }, 2000);
    }

    // Fade out
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: newStep === 15 || newStep === 16 ? 1000 : 300,
      useNativeDriver: true,
    }).start(() => {
      // Change step
      setCurrentStep(newStep);

      // Reset interaction states when moving to or from interactive steps
      if (newStep === 4) {
        setHasInteractedWithClaritySlider(false);
      } else if (newStep === 5) {
        setHasInteractedWithStressSlider(false);
      } else if (newStep === 11) {
        // Only reset interaction state, preserve position
        setHasInteractedWithCoachingStyle(false);
      } else if (newStep === 12) {
        setHasInteractedWithTimeSlider(false);
      }

      // Reset interaction states when going back from interactive steps
      if (currentStep === 5 && newStep < 5) {
        setHasInteractedWithStressSlider(false);
      } else if (currentStep === 4 && newStep < 4) {
        setHasInteractedWithClaritySlider(false);
      } else if (currentStep === 11 && newStep < 11) {
        setHasInteractedWithCoachingStyle(false);
      } else if (currentStep === 12 && newStep < 12) {
        setHasInteractedWithTimeSlider(false);
      }

      // Fade in
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: newStep === 15 || newStep === 16 ? 1000 : 300,
        useNativeDriver: true,
      }).start();
    });
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

  // Auto-advance from case 13 to case 14 and handle loading animation
  useEffect(() => {
    if (currentStep === 13) {
      // Start pulsing animation for loading dots
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(loadingPulseAnim, {
            toValue: 0.3,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(loadingPulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimation.start();

      const timeout = setTimeout(() => {
        pulseAnimation.stop();
        loadingPulseAnim.setValue(1);
        animateToStep(14);
      }, 3000); // 3 seconds

      return () => {
        clearTimeout(timeout);
        pulseAnimation.stop();
        loadingPulseAnim.setValue(1);
      };
    }
  }, [currentStep]);

  // Timer logic for case 16
  useEffect(() => {
    if (currentStep === 16) {
      // Reset timer to 5:00 when entering case 16
      setTimerMinutes(5);
      setTimerSeconds(0);
      setIsTimerRunning(false);
      setTimerEnded(false);

      // Activate keep awake to prevent screen from sleeping during meditation
      activateKeepAwakeAsync();

      // Load meditation audio from API and start timer
      let startTimeoutId: NodeJS.Timeout | null = null;
      
      const loadAudio = async () => {
        await loadMeditationAudio();
        
        startMeditationAudio();

        // Start timer after audio is loaded
        startTimeoutId = setTimeout(() => {
          setIsTimerRunning(true);
          // Start meditation audio when timer starts
        }, 2000);
      };
      
      loadAudio();

      return () => {
        if (startTimeoutId) {
          clearTimeout(startTimeoutId);
        }
        setIsTimerRunning(false);
        setTimerEnded(false);
        // Stop meditation audio when leaving case 16
        stopMeditationAudio();
        // Deactivate keep awake when leaving case 16
        deactivateKeepAwake();
      };
    } else {
      // Ensure keep awake is deactivated when not in case 16
      deactivateKeepAwake();
      // Stop meditation audio when not in case 16
      stopMeditationAudio();
    }
  }, [currentStep]);

  // Timer countdown logic
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isTimerRunning && (timerMinutes > 0 || timerSeconds > 0)) {
      interval = setInterval(() => {
        if (timerSeconds > 0) {
          setTimerSeconds(timerSeconds - 1);
        } else if (timerMinutes > 0) {
          setTimerMinutes(timerMinutes - 1);
          setTimerSeconds(59);
        }
      }, 1000);
    } else if (timerMinutes === 0 && timerSeconds === 0 && isTimerRunning && !timerEnded) {
      // Timer just ended
      setIsTimerRunning(false);
      setTimerEnded(true);

      // Stop meditation audio when timer ends
      stopMeditationAudio();

      // Deactivate keep awake when meditation timer ends
      deactivateKeepAwake();

      // Play meditation bell sound
      playMeditationBell();

      // Slide continue button back up
      Animated.timing(buttonSlideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start();
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning, timerMinutes, timerSeconds, timerEnded]);

  // Cleanup keep awake on component unmount
  useEffect(() => {
    return () => {
      deactivateKeepAwake();
    };
  }, []);

  const handleContinue = async () => {
    if (currentStep < 16) {
      animateToStep(currentStep + 1);
      if (currentStep === 12) {
        // Handle data submission - save data to user object in database
        if (firebaseUser?.uid) {
          try {
            const onboardingDuration = Math.floor((Date.now() - onboardingStartTime) / 1000);
            
            // Update user account in Firestore with onboarding data and completion status
            await FirestoreService.updateUserAccount(firebaseUser.uid, {
              // Mark onboarding as completed
              // Store all onboarding data for future reference
              firstName:name,
              onboardingData: {
                onboardingCompleted: true,
                onboardingCompletedAt: Date.now(),
                whatDoYouDoInLife: selectedRoles,
                selfReflectionPracticesTried: selectedSelfReflection,
                clarityInLife: clarityLevel,
                stressInLife: stressLevel,
              },
              coachingConfig: {
                challengeDegree: coachingStylePosition.x < 0.3 ? 'gentle' : coachingStylePosition.x < 0.6 ? 'moderate' : coachingStylePosition.x < 0.8 ? 'challenging' : 'intense',
                harshToneDegree: coachingStylePosition.y > 0.8 ? 'supportive' : coachingStylePosition.y > 0.6 ? 'direct' : coachingStylePosition.y > 0.3 ? 'firm' : 'harsh',
                coachingMessageFrequency: 'daily',
                enableCoachingMessages: true,
                lastCoachingMessageSentAt: 0,
                coachingMessageTimePreference: 'morning',
              },
              updatedAt: new Date(),
              userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            });
            
            // Track onboarding completion
            trackOnboardingCompleted({
              onboarding_duration: onboardingDuration,
              steps_completed: 13, // Steps 1-12 completed at this point
              user_responses: selectedRoles.length + selectedSelfReflection.length + 4, // roles + reflections + clarity + stress + coaching style + time
            });
          } catch (error) {
            console.error('Failed to save onboarding data:', error);
          }
        }
      }
    } else if (currentStep === 16) {
      // Fade out current screen before navigating
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        // Navigate to chat screen with all onboarding data
        navigation.navigate('OnboardingChat', {
          name,
          selectedRoles,
          selectedSelfReflection,
          clarityLevel,
          stressLevel,
          coachingStylePosition,
          timeDuration
        });
      });
    }
  };

  const handleBack = () => {
    if (currentStep <= 1) {
      // Go back to login screen
      Alert.alert('Go back?', 'Are you sure you want to cancel this onboarding? You will lose all your progress.', [
        { text: 'Continue', style: 'cancel' },
        { text: 'Go back', style: 'destructive', onPress: () => {
          try {
            signOut();
          } catch (error) {
            console.error('Go back error:', error);
            Alert.alert('Error', 'Failed to sign out and go back. Please try again.');
          }
        } }
      ]);
    } else {
      animateToStep(currentStep - 1);
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
                You just pressed pause – and that changes everything.
              </Text>
            </View>
          </>
        );
      case 7:
        return (
          <>
            <View style={[styles.headerContainer, { gap: 30, flex: 1, justifyContent: 'center', width: '100%' }]}>
              <Text style={[styles.mainText, { color: '#FFFFFF', textAlign: 'center' }]}>
                The unfair advantage nobody talks about.
              </Text>
              <Text style={[styles.mainText, { color: '#FFFFFF', textAlign: 'center' }]}>
                Studying yourself.
              </Text>
            </View>
          </>
        );
      case 8:
        return (
          <>
            <View style={[styles.headerContainer, { justifyContent: 'flex-start', alignItems: 'center', marginHorizontal: 20 }]}>
              <Text style={[styles.headerText, { textAlign: 'center', marginLeft: 10, color: accentColors.blue }]}>
                Research backed.*
              </Text>
              <Text style={[styles.mainText, { color: colors.text, textAlign: 'center', fontSize: 20, lineHeight: 24 }]}>
                Founders, creators, and leaders who reflect regularly report improvements in:
              </Text>
            </View>

            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <View style={styles.listContainer}>
                <View style={[styles.listItemContainer, {
                  backgroundColor: `${colors.tint}08`,
                  borderColor: `${colors.tint}15`
                }]}>
                  <View style={[styles.listItem, {
                    backgroundColor: colors.background,
                    borderColor: `${colors.tint}12`
                  }]}>
                    <View style={styles.listItemIcon}>
                      <RelationshipsIcon color={colors.text} />
                    </View>
                    <View style={styles.listItemContent}>
                      <Text style={[styles.listItemTitle, { color: colors.text }]}>
                        Relationships
                      </Text>
                      <Text style={[styles.listItemDescription, { color: `${colors.text}99` }]}>
                        More presence, less reactivity.
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.grayAreaText, { color: `${colors.text}66` }]}>
                    <Text style={{ fontWeight: '600' }}>King, L. A. (2001).</Text> The health benefits of writing about life goals. Personality and Social Psychology Bulletin, 27(7), 798–807.
                  </Text>
                </View>
                <View style={[styles.listItemContainer, {
                  backgroundColor: `${colors.tint}08`,
                  borderColor: `${colors.tint}15`
                }]}>
                  <View style={[styles.listItem, {
                    backgroundColor: colors.background,
                    borderColor: `${colors.tint}12`
                  }]}>
                    <View style={styles.listItemIcon}>
                      <WorkIcon color={colors.text} />
                    </View>
                    <View style={styles.listItemContent}>
                      <Text style={[styles.listItemTitle, { color: colors.text }]}>
                        Work
                      </Text>
                      <Text style={[styles.listItemDescription, { color: `${colors.text}99` }]}>
                        Less noise, smarter choices.
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.grayAreaText, { color: `${colors.text}66` }]}>
                    <Text style={{ fontWeight: '600' }}>Pennebaker, J. W., & Smyth, J. M. (2016).</Text> Opening Up by Writing It Down: How Expressive Writing Improves Health and Eases Emotional Pain. The Guilford Press.                </Text>
                </View>
                <View style={[styles.listItemContainer, {
                  backgroundColor: `${colors.tint}08`,
                  borderColor: `${colors.tint}15`
                }]}>
                  <View style={[styles.listItem, {
                    backgroundColor: colors.background,
                    borderColor: `${colors.tint}12`
                  }]}>
                    <View style={styles.listItemIcon}>
                      <LeadershipIcon color={colors.text} />
                    </View>
                    <View style={styles.listItemContent}>
                      <Text style={[styles.listItemTitle, { color: colors.text }]}>
                        Leadership
                      </Text>
                      <Text style={[styles.listItemDescription, { color: `${colors.text}99` }]}>
                        Decide with clarity, not pressure.
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.grayAreaText, { color: `${colors.text}66` }]}>
                    <Text style={{ fontWeight: '600' }}>Baikie, K. A., & Wilhelm, K. (2005).</Text> Emotional and physical health benefits of expressive writing. Advances in Psychiatric Treatment, 11(5), 338–346.</Text>
                </View>
              </View>
            </View>
          </>
        );
      case 9:
        return (
          <>
            <View style={[styles.headerContainer, { justifyContent: 'flex-start', alignItems: 'center', marginHorizontal: 20 }]}>
              <Text style={[styles.headerText, { textAlign: 'center', marginLeft: 10, color: accentColors.blue }]}>
                World leading figures.*
              </Text>
              <Text style={[styles.mainText, { color: colors.text, textAlign: 'center', fontSize: 20, lineHeight: 24 }]}>
                The best creators and leaders reflect daily.
              </Text>
            </View>

            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <View style={styles.figuresGrid}>
                <View style={styles.figureCard}>
                  <View style={[styles.figureImageBorder, { backgroundColor: colorScheme == 'light' ? '#EEE' : '#222', transform: [{ rotate: '-3deg' }] }]}>
                    <Image
                      source={require('@/assets/images/Sam Altman.png')}
                      style={styles.figureImage}
                      contentFit="cover"
                    />
                  </View>
                  <Text style={[styles.figureName, { color: colors.text }]}>Sam Altman</Text>
                  <Text style={[styles.figureDescription, { color: `${colors.text}80` }]}>
                    Uses writing to clarify hard problems.
                  </Text>
                </View>

                <View style={styles.figureCard}>
                  <View style={[styles.figureImageBorder, { backgroundColor: colorScheme == 'light' ? '#EEE' : '#222', transform: [{ rotate: '2deg' }] }]}>
                    <Image
                      source={require('@/assets/images/Leonardo da Vinci.png')}
                      style={styles.figureImage}
                      contentFit="cover"
                    />
                  </View>
                  <Text style={[styles.figureName, { color: colors.text }]}>Leonardo da Vinci</Text>
                  <Text style={[styles.figureDescription, { color: `${colors.text}80` }]}>
                    Filled thousands of pages with questions and ideas.
                  </Text>
                </View>

                <View style={styles.figureCard}>
                  <View style={[styles.figureImageBorder, { backgroundColor: colorScheme == 'light' ? '#EEE' : '#222', transform: [{ rotate: '4deg' }] }]}>
                    <Image
                      source={require('@/assets/images/Albert Einstein.png')}
                      style={styles.figureImage}
                      contentFit="cover"
                    />
                  </View>
                  <Text style={[styles.figureName, { color: colors.text }]}>Albert Einstein</Text>
                  <Text style={[styles.figureDescription, { color: `${colors.text}80` }]}>
                    Wrote daily reflections to refine his thinking.
                  </Text>
                </View>

                <View style={styles.figureCard}>
                  <View style={[styles.figureImageBorder, { backgroundColor: colorScheme == 'light' ? '#EEE' : '#222', transform: [{ rotate: '-2deg' }] }]}>
                    <Image
                      source={require('@/assets/images/Rick Rubin.png')}
                      style={styles.figureImage}
                      contentFit="cover"
                    />
                  </View>
                  <Text style={[styles.figureName, { color: colors.text }]}>Rick Rubin</Text>
                  <Text style={[styles.figureDescription, { color: `${colors.text}80` }]}>
                    Journals to quiet his mind and unlock creativity.
                  </Text>
                </View>
              </View>
            </View>
          </>
        );
      case 10:
        return (
          <>
            <View style={[styles.headerContainer, { gap: 30, flex: 1, justifyContent: 'center', width: '100%' }]}>
              <Text style={[styles.mainText, { color: colors.text, textAlign: 'center' }]}>
                Are you ready to put all of this to work?
              </Text>
            </View>
          </>
        );
      case 11:
        return (
          <>
            <View style={[styles.headerContainer, { justifyContent: 'flex-start', alignItems: 'center', marginHorizontal: 20 }]}>
              <Text style={[styles.headerText, { textAlign: 'center', marginLeft: 10, color: accentColors.orange }]}>
                Coach configuration
              </Text>
              <Text style={[styles.mainText, { color: colors.text, textAlign: 'center', fontSize: 20, lineHeight: 24, fontWeight: '500' }]}>
                Pick how you want your coach to behave in today's session.
              </Text>
            </View>

            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', alignSelf: 'stretch' }}>
              <CoachingStyleSelector />
            </View>
          </>
        );
      case 12:
        return (
          <>
            <View style={[styles.headerContainer, { justifyContent: 'flex-start', alignItems: 'center', marginHorizontal: 20 }]}>
              <Text style={[styles.headerText, { textAlign: 'center', marginLeft: 10, color: accentColors.orange }]}>
                Investment in yourself
              </Text>
              <Text style={[styles.mainText, { color: colors.text, textAlign: 'center', fontSize: 20, lineHeight: 24, fontWeight: '500' }]}>
                How much time do you want to invest in yourself today?
              </Text>
            </View>

            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', alignSelf: 'stretch' }}>
              <CircularTimeDisplay />
            </View>
            <View style={{ height: 40, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={[styles.mainText, { color: `${colors.text}60`, fontSize: 16, textAlign: 'center' }]}>
                Tap around the circle to adjust time
              </Text>
            </View>
          </>
        );
      case 13:
        return (
          <>
            <View style={[styles.headerContainer, { gap: 40, flex: 1, justifyContent: 'center', alignItems: 'center', alignSelf: 'stretch' }]}>
              <View style={styles.circularLoadingContainer}>
                <Animated.View style={[styles.circularPattern, { opacity: loadingPulseAnim }]}>
                  {/* Create scattered circular pattern of dots like in screenshot */}
                  {[
                    // Pre-defined positions to match the screenshot pattern
                    { x: 0, y: -70, size: 8, opacity: 0.7 },
                    { x: 25, y: -65, size: 6, opacity: 0.4 },
                    { x: -30, y: -55, size: 7, opacity: 0.6 },
                    { x: 50, y: -45, size: 8, opacity: 0.8 },
                    { x: -55, y: -35, size: 9, opacity: 0.5 },
                    { x: 70, y: -20, size: 7, opacity: 0.6 },
                    { x: -70, y: -10, size: 8, opacity: 0.7 },
                    { x: 75, y: 10, size: 6, opacity: 0.4 },
                    { x: -65, y: 25, size: 8, opacity: 0.8 },
                    { x: 60, y: 40, size: 7, opacity: 0.5 },
                    { x: -45, y: 55, size: 9, opacity: 0.6 },
                    { x: 20, y: 70, size: 7, opacity: 0.7 },
                    { x: -15, y: 75, size: 6, opacity: 0.4 },
                    { x: 0, y: 80, size: 8, opacity: 0.6 },
                    { x: -40, y: 0, size: 7, opacity: 0.5 },
                    { x: 40, y: 0, size: 8, opacity: 0.7 },
                    { x: 0, y: -40, size: 6, opacity: 0.4 },
                    { x: 0, y: 40, size: 7, opacity: 0.6 },
                    { x: -25, y: -40, size: 8, opacity: 0.5 },
                    { x: 25, y: -40, size: 7, opacity: 0.7 },
                    { x: -25, y: 40, size: 6, opacity: 0.4 },
                    { x: 25, y: 40, size: 8, opacity: 0.6 },
                    { x: -55, y: 15, size: 7, opacity: 0.5 },
                    { x: 55, y: 15, size: 8, opacity: 0.7 },
                    { x: -35, y: -25, size: 6, opacity: 0.4 },
                    { x: 35, y: -25, size: 7, opacity: 0.6 },
                    { x: -15, y: 15, size: 8, opacity: 0.5 },
                    { x: 15, y: 15, size: 7, opacity: 0.7 },
                    { x: -45, y: 30, size: 6, opacity: 0.4 },
                    { x: 45, y: 30, size: 8, opacity: 0.6 },
                  ].map((dot, i) => (
                    <View
                      key={i}
                      style={[
                        styles.patternDot,
                        {
                          transform: [{ translateX: dot.x }, { translateY: dot.y }],
                          backgroundColor: colors.text,
                          opacity: dot.opacity,
                          width: dot.size,
                          height: dot.size,
                          borderRadius: dot.size / 2,
                        }
                      ]}
                    />
                  ))}
                </Animated.View>
              </View>
              <Text style={[styles.loadingText, { color: `${colors.text}99`, textAlign: 'center' }]}>
                Configuring your custom{'\n'}coaching session.
              </Text>
            </View>
          </>
        );
      case 14:
        return (
          <>
            <View style={[styles.headerContainer, { gap: 40, flex: 1, justifyContent: 'center', width: '100%', marginTop: '10%' }]}>
              <Text style={[styles.mainText, { color: '#FFFFFF', textAlign: 'center', fontWeight: '500' }]}>
                {`${name}, you made it.`}
              </Text>
              <Text style={[styles.mainText, { color: '#FFFFFF', textAlign: 'center', fontWeight: '500' }]}>
                We are now starting with a tailored meditation.
              </Text>
              <Text style={[styles.mainText, { color: '#FFFFFF', textAlign: 'center', fontWeight: '500' }]}>
                Even a short meditation can help you reflect more clearly and stay open to new perspectives.¹
              </Text>
              <Text style={[styles.mainText, { color: '#FFFFFF', textAlign: 'center', fontSize: 14, fontWeight: '400', lineHeight: 20, opacity: 0.6 }]}>
                ¹ Reference: Kiken, L. G., et al. (2015). From a state to a trait: Mindfulness training promotes cognitive flexibility. Journal of Experimental Psychology: General.
              </Text>
            </View>
          </>
        );
      case 15:
        return (
          <>
            <View style={[styles.headerContainer, { gap: 30, flex: 1, justifyContent: 'center', width: '100%', opacity: 0.6, alignItems: 'center' }]}>
              <Headphones size={64} color={colors.background} />
              <Text style={[styles.mainText, { color: '#FFFFFF', textAlign: 'center', fontSize: 16, fontWeight: '500', lineHeight: 24, paddingHorizontal: 20 }]}>
                Please find a quiet place and consider using headphones.
              </Text>
            </View>
          </>
        );
      case 16:
        const formatTime = (minutes: number, seconds: number) => {
          return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        };

        const handleScreenPress = () => {
          if (!timerEnded && isTimerRunning) {
            setIsTimerRunning(false);
            setShowPauseOverlay(true);
            // Pause meditation audio when showing pause overlay
            pauseMeditationAudio();
            Animated.timing(pauseOverlayAnim, {
              toValue: 1,
              duration: 300,
              useNativeDriver: true,
            }).start();
          }
        };

        const handleContinueTimer = () => {
          Animated.timing(pauseOverlayAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }).start(() => {
            setShowPauseOverlay(false);
            setIsTimerRunning(true);
            // Resume meditation audio when continuing timer
            resumeMeditationAudio();
          });
        };

        return (
          <>
            <TouchableOpacity
              style={{ flex: 1, justifyContent: 'space-between', alignItems: 'center', alignSelf: 'stretch', marginBottom: -50 }}
              onPress={handleScreenPress}
              activeOpacity={1}
            >
              <Text style={[styles.mainText, { color: '#FFFFFF', textAlign: 'center', fontSize: 16, fontWeight: '400', lineHeight: 24, opacity: 0.6, paddingHorizontal: 20 }]}>
                {`If you can read this,
close your eyes...`}
              </Text>
              <View style={[styles.timerContainer]}>
                <Text style={[styles.timerText]}>
                  {formatTime(timerMinutes, timerSeconds)}
                </Text>
              </View>
              <Text style={[styles.mainText, { color: '#FFFFFF', textAlign: 'center', fontSize: 16, fontWeight: '400', lineHeight: 24, opacity: !timerEnded ? 0.6 : 0, paddingHorizontal: 20 }]}>
                Press anywhere to pause
              </Text>
            </TouchableOpacity>

            {/* Pause Overlay */}
            <Animated.View
              style={[
                styles.pauseOverlay,
                {
                  opacity: pauseOverlayAnim,
                  pointerEvents: showPauseOverlay ? 'auto' : 'none',
                }
              ]}
            >
              <BlurView intensity={30} tint="dark" style={styles.pauseOverlayBlur} />
              <View style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: '#00000011',
              }} />
              <View style={styles.pauseButtonsContainer}>
                <Button
                  variant="secondary"
                  onPress={() => {
                    Alert.alert('End early', 'Are you sure you want to end your meditation early?', [
                      {
                        text: 'Continue', style: 'cancel', onPress: () => {
                          Animated.timing(pauseOverlayAnim, {
                            toValue: 0,
                            duration: 300,
                            useNativeDriver: true,
                          }).start(() => {
                            setShowPauseOverlay(false);
                            setIsTimerRunning(true);
                            // Resume meditation audio when continuing
                            resumeMeditationAudio();
                          });
                        }
                      },
                      {
                        text: 'End early', style: 'destructive', onPress: () => {
                          // Stop meditation audio when ending early
                          stopMeditationAudio();
                          Animated.timing(pauseOverlayAnim, {
                            toValue: 0,
                            duration: 300,
                            useNativeDriver: true,
                          }).start(() => {
                            setTimerMinutes(0);
                            setTimerSeconds(0);
                            setIsTimerRunning(true);
                            setShowPauseOverlay(false);
                          });
                        }
                      }
                    ], { cancelable: true, userInterfaceStyle: 'dark' });
                  }}
                  style={[styles.backButton, { backgroundColor: `#FFFFFF11`, flex: 1, borderColor: 'transparent' }]}
                >
                  <Text style={[{ color: '#FFFFFF', fontSize: 16, fontWeight: '500' }]}>End early</Text>
                </Button>
                <Button
                  variant="primary"
                  onPress={handleContinueTimer}
                  size="lg"
                  style={[styles.continueButtonWithBack, { backgroundColor: `#FFFFFF`, flex: 1, borderColor: 'transparent' }]}
                  textStyle={{ color: '#000000' }}
                >
                  Continue
                </Button>
              </View>
            </Animated.View>
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
    if (currentStep === 8) return true;
    if (currentStep === 9) return true;
    if (currentStep === 10) return true;
    if (currentStep === 11) return hasInteractedWithCoachingStyle;
    if (currentStep === 12) return hasInteractedWithTimeSlider;
    if (currentStep === 13) return false; // Buttons are hidden during loading
    if (currentStep === 14) return true;
    if (currentStep === 15) return true;
    if (currentStep === 16) return timerEnded; // Only valid when timer has ended
    return false;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: currentStep === 7 ? '#111111' : currentStep >= 14 ? '#000000' : colors.background }]}>
      <Animated.View
        style={[
          styles.contentContainer,
          {
            transform: [{ translateY: keyboardOffset }],
            opacity: fadeAnim,
            // Remove padding for chat interface
            ...(currentStep >= 16 && { padding: 0, gap: 0 })
          }
        ]}
      >
        {renderStepContent()}
      </Animated.View>

      <Animated.View
        style={[
          styles.buttonContainer,
          {
            transform: [
              { translateY: keyboardOffset },
              { translateY: buttonSlideAnim }
            ]
          }
        ]}
      >
        <View style={styles.buttonRow}>
          {currentStep < 14 && (
            <Button
              variant="secondary"
              onPress={handleBack}
              style={[styles.backButton, { borderColor: 'transparent', backgroundColor: currentStep === 7 || currentStep >= 14 ? `#FFFFFF11` : `${colors.tint}11` }]}
            >
              <ChevronLeft size={24} color={currentStep === 7 || currentStep >= 14 ? '#FFFFFF' : colors.text} />
            </Button>
          )}
          <Button
            variant="primary"
            onPress={handleContinue}
            size="lg"
            style={[styles.continueButtonWithBack, { backgroundColor: currentStep === 7 || currentStep >= 14 ? `#FFFFFF11` : currentStep === 6 ? `${colors.tint}11` : colors.tint, borderColor: 'transparent' }]}
            textStyle={{ color: currentStep === 7 || currentStep >= 14 ? '#FFFFFF' : currentStep === 6 ? colors.text : colors.background }}
            disabled={isLoading || !isStepValid()}
          >
            {isLoading ? 'Loading...' : currentStep === 10 ? 'Yes, I\'m in' : currentStep === 15 ? 'Start 5 min Meditation' : 'Continue'}
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
    color: '#2563EB'
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
  listContainer: {
    flexDirection: 'column',
    gap: 16,
    width: '100%',
  },
  listItemContainer: {
    borderRadius: 22,
    padding: 10,
    borderWidth: 0.5,
  },
  listItem: {
    flexDirection: 'row',
    gap: 12,
    borderRadius: 16,
    paddingTop: 12,
    paddingRight: 14,
    paddingBottom: 14,
    paddingLeft: 16,
    borderWidth: 0.5,
    boxShadow: '0px 1.16px 1.5px 0px #00000003, 0px 2.79px 3.72px -2px #00000004, 0px 5.25px 7px 0px #00000005, 0px 9.4px 12.5px 0px #00000006, 0px 17.54px 23.39px 0px #00000009',
  },
  listItemIcon: {
    alignItems: 'center',
    width: 16,
    height: 48,
    paddingTop: 4,
    paddingBottom: 4,
  },
  listItemContent: {
    flex: 1,
    flexDirection: 'column',
  },
  listItemTitle: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 24,
    marginBottom: 4,
  },
  listItemDescription: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
  },
  grayAreaText: {
    fontSize: 8,
    fontWeight: '400',
    lineHeight: 12,
    letterSpacing: 0,
    textAlign: 'left',
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 6,
  },
  coachingSelectorContainer: {
    alignItems: 'center',
    gap: 20,
    width: '100%',
    paddingHorizontal: 20, // Add padding to ensure it doesn't touch screen edges
  },
  selectorWrapper: {
    position: 'relative',
    width: 300,
    height: 300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectorArea: {
    width: 300,
    height: 300,
    borderRadius: 20,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  dottedGrid: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  selectorLabel: {
    position: 'absolute',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  selectorLabelTop: {
    top: 20,
    left: 0,
    right: 0,
  },
  selectorLabelBottom: {
    bottom: 20,
    left: 0,
    right: 0,
  },
  selectorLabelLeft: {
    left: 20,
    top: '46%',
    width: 60,
    textAlign: 'center',
    transform: [{ rotate: '-90deg' }, { translateY: -30 }],
  },
  selectorLabelRight: {
    right: 20,
    top: '46%',
    width: 60,
    textAlign: 'center',
    transform: [{ rotate: '90deg' }, { translateY: -30 }],
  },
  selectorControl: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    // Enhanced glass shadows
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
  },
  glassLayer1: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    top: 1,
    left: 1,
  },
  glassLayer2: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    top: 4,
    left: 4,
  },
  glassHighlight: {
    position: 'absolute',
    width: 20,
    height: 16,
    borderRadius: 10,
    top: 8,
    left: 12,
  },
  selectorControlInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    position: 'absolute',
  },
  selectorInstructions: {
    fontSize: 14,
    fontWeight: '400',
    textAlign: 'center',
  },
  circularSliderContainer: {
    alignItems: 'center',
    gap: 20,
    width: '100%',
    paddingHorizontal: 20,
  },
  circularDisplayContainer: {
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 20,
  },
  sliderWrapper: {
    position: 'relative',
    width: 300,
    height: 300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  displayWrapper: {
    position: 'relative',
    width: 320,
    height: 320,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerDisplay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeDisplay: {
    fontSize: 36,
    fontWeight: '400',
    textAlign: 'center',
  },
  touchOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 300,
    height: 300,
  },
  sliderInstructions: {
    fontSize: 14,
    fontWeight: '400',
    textAlign: 'center',
  },
  figuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    gap: 20,
  },
  figureCard: {
    width: '45%',
    alignItems: 'center',
    marginBottom: 20,
  },
  figureImageBorder: {
    padding: 10,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  figureImage: {
    width: 110,
    height: 110,
  },
  figureName: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  figureDescription: {
    fontSize: 14,
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 18,
  },
  loadingIndicator: {
    alignItems: 'center',
    marginTop: 20,
  },
  loadingDots: {
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: 8,
  },
  circularLoadingContainer: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  circularPattern: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  patternDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    position: 'absolute',
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '400',
    lineHeight: 24,
  },
  timerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  timerText: {
    fontSize: 64,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 80,
  },
  pauseOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    alignItems: 'stretch',
    height: '115%',
    zIndex: 100,
  },
  pauseOverlayBlur: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  pauseButtonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 50,
    zIndex: 101,
  },
}); 