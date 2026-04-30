import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, StyleSheet, Image, 
  TouchableOpacity, Animated, Easing, 
  SafeAreaView, StatusBar, Dimensions 
} from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useAddress } from '../context/AddressContext';
import { supabase } from '../lib/supabase';

const { width } = Dimensions.get('window');
const BRAND_GREEN = '#02844F';

const OrderPlacingScreen = ({ navigation, route }: any) => {
  const { user } = useAuth();
    const { items, cartTotal, clearCart, restaurantId } = useCart();
    const { selectedAddress } = useAddress();
    
    const { initialEta, paymentMethod } = route.params || {};
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(5);
  const progress = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const checkmarkScale = useRef(new Animated.Value(0)).current;
  const hasPlacedOrderRef = useRef(false);

  useEffect(() => {
    // Start progress bar animation
    Animated.timing(progress, {
      toValue: 1,
      duration: 5000,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();

    // Start countdown interval
    countdownIntervalRef.current = setInterval(() => {
      setCountdown(prev => (prev > 1 ? prev - 1 : 1));
    }, 1000);

    // Start order placement timer
    timerRef.current = setTimeout(() => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      handlePlaceOrder();
    }, 5000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, []);

  const handlePlaceOrder = async () => {
    // 1. REF LOCK (Bulletproof Synchronous Guard)
    if (hasPlacedOrderRef.current) return;
    hasPlacedOrderRef.current = true;

    // 2. KILL THE TIMERS
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }

    if (!user || !selectedAddress || !restaurantId || items.length === 0) {
      setError('Missing order information');
      return;
    }

    try {
      // 2. Insert Order 
      // Note: We don't manually pick a rider here anymore. 
      // The backend find_best_rider function will trigger assignment.
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: user.id,
          restaurant_id: restaurantId,
          address_id: selectedAddress.id,
          total_item_amount: cartTotal, // Backend trigger will add the fee correctly now
          payment_mode: paymentMethod || 'COD',
          status: 'PLACED'
        })
        .select()
        .single();

      if (orderError || !order) throw orderError || new Error('Order creation failed');

      // 3. Insert Order Items
      const orderItems = items.map(item => ({
        order_id: order.id,
        item_id: item.item_id,
        combo_id: item.combo_id,
        quantity: item.quantity,
        price: item.price
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      // 4. Success state
      setIsSuccess(true);
      await clearCart();

      // Zomato-style sound blast - now using local joy.mp3 for a premium experience
      try {
        const { sound } = await Audio.Sound.createAsync(
          require('../../assets/joy.mp3')
        );
        await sound.playAsync();
        // Unload after sound finishes (approx 2s) to free memory
        setTimeout(() => {
          sound.unloadAsync();
        }, 4000);
      } catch (err) {
        console.error('Audio playback failed:', err);
      }

      // Animate checkmark
      Animated.spring(checkmarkScale, {
        toValue: 1,
        tension: 50,
        useNativeDriver: true,
      }).start();

      // Redirect to home after 4 seconds
      setTimeout(() => {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Home' }],
        });
      }, 4000);

    } catch (err: any) {
      console.error('Order placement failed:', err);
      setError(err.message || 'Something went wrong');
    }
  };

  const cancelOrder = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    navigation.goBack();
  };

  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  if (isSuccess) {
    return (
      <SafeAreaView style={styles.successContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#F4F7F7" />
        <View style={styles.successContent}>
          <Image 
            source={require('../../assets/cool_rider.png')} 
            style={styles.successHeroImg}
            resizeMode="contain"
          />
          
          <Animated.View style={[styles.successBadgeOverlay, { transform: [{ scale: checkmarkScale }] }]}>
            <Ionicons name="checkmark-circle" size={80} color={BRAND_GREEN} />
          </Animated.View>

          <View style={styles.successTextContent}>
            <Text style={styles.successTitle}>ORDER PLACED!</Text>
            <Text style={styles.successSubtitle}>
              RELAX, YOUR SNACKS ARE ON THE WAY.{"\n"}WE'RE DASHING TO YOUR DOOR!
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF" />
      
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Placing your order</Text>
          <Text style={styles.subtitle}>Hold tight! We're confirming with the bakery.</Text>
        </View>

        <Image 
          source={require('../../assets/placing_order.png')} 
          style={styles.image}
          resizeMode="contain"
        />

        <View style={styles.progressContainer}>
          <View style={styles.progressBarBg}>
            <Animated.View style={[styles.progressBarFill, { width: progressWidth }]} />
          </View>
          <Text style={styles.timerText}>Confirmed in {countdown}s...</Text>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <MaterialCommunityIcons name="map-marker" size={18} color="#666" />
            <Text style={styles.summaryText} numberOfLines={1}>
              {selectedAddress?.address_line || 'No address selected'}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <MaterialCommunityIcons name="wallet" size={18} color="#666" />
            <Text style={styles.summaryText}>₹{Number(cartTotal) + (cartTotal < 49 ? 25 : cartTotal < 89 ? 15 : 0)} via {paymentMethod === 'UPI' ? 'UPI' : 'Cash on Delivery'}</Text>
          </View>
          <View style={styles.summaryRow}>
            <MaterialCommunityIcons name="clock-fast" size={18} color={BRAND_GREEN} />
            <Text style={[styles.summaryText, { color: BRAND_GREEN, fontWeight: '700' }]}>
              Delivering in {route.params?.initialEta || '--'} mins
            </Text>
          </View>
        </View>

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {error ? (
          <View style={styles.footer}>
            <TouchableOpacity 
              style={[styles.cancelButton, { backgroundColor: BRAND_GREEN, borderColor: BRAND_GREEN }]} 
              onPress={() => { setError(null); handlePlaceOrder(); }}
            >
              <Text style={[styles.cancelButtonText, { color: '#FFF' }]}>TRY AGAIN</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.footer}>
            <Text style={styles.quirkyText}>"YOUR STOMACH WILL THANK YOU LATER 🍩"</Text>
            <TouchableOpacity 
              style={styles.cancelButton} 
              onPress={cancelOrder}
            >
              <Text style={styles.cancelButtonText}>CANCEL ORDER</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  content: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    marginTop: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#1E293B',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    fontWeight: '600',
  },
  image: {
    width: width * 0.8,
    height: width * 0.8,
  },
  progressContainer: {
    width: '100%',
    alignItems: 'center',
  },
  progressBarBg: {
    width: '100%',
    height: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: BRAND_GREEN,
  },
  timerText: {
    fontSize: 12,
    fontWeight: '800',
    color: BRAND_GREEN,
    letterSpacing: 1,
  },
  summaryCard: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryText: {
    fontSize: 14,
    color: '#475569',
    marginLeft: 10,
    fontWeight: '600',
    flex: 1,
  },
  errorContainer: {
    backgroundColor: '#FEF2F2',
    padding: 12,
    borderRadius: 8,
    width: '100%',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  footer: {
    width: '100%',
    alignItems: 'center',
  },
  quirkyText: {
    fontSize: 13,
    fontWeight: '900',
    color: BRAND_GREEN,
    marginBottom: 20,
    letterSpacing: -0.5,
  },
  cancelButton: {
    width: '100%',
    paddingVertical: 18,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 1,
  },
  successContainer: {
    flex: 1,
    backgroundColor: '#F4F7F7',
  },
  successContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  successHeroImg: {
    width: width * 0.85,
    height: width * 0.85,
    marginBottom: -40,
  },
  successBadgeOverlay: {
    backgroundColor: '#FFF',
    borderRadius: 50,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    padding: 4,
    marginBottom: 20,
    zIndex: 10,
  },
  successTextContent: {
    alignItems: 'center',
    marginTop: 10,
  },
  successTitle: {
    fontSize: 34,
    fontWeight: '900',
    color: '#1E293B',
    marginBottom: 8,
    letterSpacing: -1.5,
  },
  successSubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    fontWeight: '800',
    lineHeight: 20,
    letterSpacing: 0.5,
  }
});

export default OrderPlacingScreen;
