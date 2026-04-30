import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

// Screens
import SplashScreen from '../screens/SplashScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import HomeScreen from '../screens/HomeScreen';
import HotNowScreen from '../screens/HotNowScreen';
import CartScreen from '../screens/CartScreen';
import ProfileScreen from '../screens/ProfileScreen';
import OrdersListScreen from '../screens/OrdersListScreen';
import OrdersScreen from '../screens/OrdersScreen';
import AddressPickerScreen from '../screens/AddressPickerScreen';
import OtpVerifyScreen from '../screens/OtpVerifyScreen';
import NoServiceScreen from '../screens/NoServiceScreen';
import OrderPlacingScreen from '../screens/OrderPlacingScreen';

// Context
import { useAuth } from '../context/AuthContext';
import { useAddress } from '../context/AddressContext';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const { user, isLoading: authLoading } = useAuth();

  // While checking auth / addresses, still show Splash or spinner
  if (authLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#02844F" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Splash">
        <Stack.Screen name="Splash" component={SplashScreen} />
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="OtpVerify" component={OtpVerifyScreen} />
        <Stack.Screen name="AddressPicker" component={AddressPickerScreen} />
        <Stack.Screen name="NoService" component={NoServiceScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="Cart" component={CartScreen} />
        <Stack.Screen name="OrdersList" component={OrdersListScreen} />
        <Stack.Screen name="OrderTracking" component={OrdersScreen} />
        <Stack.Screen name="OrderPlacing" component={OrderPlacingScreen} />
        <Stack.Screen name="HotNow" component={HotNowScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#02844F' },
});
