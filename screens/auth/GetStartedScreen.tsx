import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { StyleSheet, Text, View, useColorScheme } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/hooks/useAuth';
import { AuthStackParamList } from '@/navigation/AuthNavigator';

type GetStartedScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'GetStarted'>;

type Props = {
  navigation: GetStartedScreenNavigationProp;
};

export default function GetStartedScreen({ navigation }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { resetGetStartedState } = useAuth();

  const handleGoBack = () => {
    resetGetStartedState();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      
      <View style={styles.logoContainer}>
        <Text style={[styles.title, { color: colors.text }]}>Welcome to Reflecta.</Text>
        <Text style={[styles.subtitle, { color: colors.icon }]}>To use the mobile app, please head to the reflecta.so website on your desktop to complete the setup, then come back to this app and sign in again.</Text>
      </View>
      
      <View style={[styles.buttonContainer]}>
          <Button
            variant="link"
            onPress={handleGoBack}
            textStyle={{ opacity: 0.5, fontWeight: 'normal', textDecorationLine: 'underline' }}
          >
            Go Back
          </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 30,
  },
  logoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
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
    paddingBottom: 50,
    paddingTop: 30,
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