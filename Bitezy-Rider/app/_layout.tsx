import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { RiderProvider, useRider } from '../context/RiderContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useLocationTracker } from '../hooks/useLocationTracker';
import { Bike } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';

function InitialLayout() {
  const { activeRider, isLoading } = useRider();
  const segments = useSegments();
  const router = useRouter();
  
  // Initialize the location sentinel only after session is resolved
  useLocationTracker();

  useEffect(() => {
    // Hold navigation logic until the storage re-hydration phase is complete
    if (isLoading) return;

    const inTabsGroup = segments[0] === '(tabs)';

    if (!activeRider && inTabsGroup) {
      router.replace('/');
    } else if (activeRider && !inTabsGroup) {
      router.replace('/(tabs)/home');
    }
  }, [activeRider, segments, isLoading]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#02844F', justifyContent: 'center', alignItems: 'center' }}>
        <StatusBar style="light" />
        <View style={{ width: 80, height: 80, backgroundColor: '#ffffff', justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#000', marginBottom: 20 }}>
          <Bike color="#02844F" size={40} />
        </View>
        <Text style={{ color: '#ffffff', fontSize: 10, fontWeight: '900', letterSpacing: 2 }}>INITIALIZING TERMINAL</Text>
        <ActivityIndicator color="#ffffff" style={{ marginTop: 20 }} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ 
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: '#ffffff' }
      }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <RiderProvider>
        <InitialLayout />
      </RiderProvider>
    </GestureHandlerRootView>
  );
}
