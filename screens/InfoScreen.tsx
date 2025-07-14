import { Colors } from '@/constants/Colors';
import { useNavigation } from '@react-navigation/native';
import * as Application from 'expo-application';
import { ChevronLeft } from 'lucide-react-native';
import React from 'react';
import { Image, Text, TouchableOpacity, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const InfoScreen = () => {
  const navigation = useNavigation();

  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <SafeAreaView style={{
      flex: 1,
      justifyContent: 'space-between',
      backgroundColor: colors.background,
    }}>

      <View style={{
        paddingHorizontal: 20,
        paddingVertical: 15,
      }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
        }}>
          <ChevronLeft size={24} color={colors.text} />
          <Text style={{
            fontSize: 16,
            fontWeight: '400',
            color: colors.text,
          }}>Back</Text>
        </TouchableOpacity>
      </View>
      <View style={{
        justifyContent: 'center',
        gap: 10,
        alignItems: 'center',
        // marginTop: '30%'
      }}>
        <Image
          style={{
            width: 150,
            height: 150,
          }}
          source={
            colorScheme === 'light' ?
              require('../assets/images/splash-icon.png') :
              require('../assets/images/splash-icon-light.png')
          }
          resizeMode="contain"
        />
        <Text style={{ fontSize: 32, fontWeight: '600', color: colors.text }}>Reflecta.</Text>
        <Text style={{ fontWeight: '500', opacity: 0.4, color: colors.text }}>Version: {Application.nativeApplicationVersion}</Text>
      </View>
      <View style={{
        paddingHorizontal: 20,
        paddingVertical: 50,
        alignItems: 'center',
      }}>
        <Text style={{ fontSize: 12, fontWeight: '300', opacity: 0.2, color: colors.text }}>© {new Date().getFullYear()} Reflecta. All rights reserved.</Text>
      </View>
    </SafeAreaView>
  )
}

export default InfoScreen;