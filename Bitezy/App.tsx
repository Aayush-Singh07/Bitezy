import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { AuthProvider } from './src/context/AuthContext';
import { CartProvider } from './src/context/CartContext';
import { AddressProvider } from './src/context/AddressContext';
import { RestaurantProvider } from './src/context/RestaurantContext';
import { NotificationProvider } from './src/context/NotificationContext';

export default function App() {
  return (
    <AuthProvider>
      <AddressProvider>
        <RestaurantProvider>
          <CartProvider>
            <SafeAreaProvider>
              <NotificationProvider>
                <AppNavigator />
              </NotificationProvider>
            </SafeAreaProvider>
          </CartProvider>
        </RestaurantProvider>
      </AddressProvider>
    </AuthProvider>
  );
}
