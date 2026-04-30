/**
 * CartScreen.tsx — Bitezy
 * Zero external animation deps — pure react-native Animated API only.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, Image, Animated, Dimensions, Easing,
  Platform, StatusBar, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useCart } from '../context/CartContext';
import { useAddress } from '../context/AddressContext';
import VegIndicator from '../components/common/VegIndicator';

const { width } = Dimensions.get('window');
const BRAND_GREEN = '#02844F';
const TRACK_HEIGHT = 10;
const TIER_1 = 49;
const TIER_2 = 89;
const TRACK_WIDTH = (width && width > 40) ? width - 40 : 320;

// ─── Shimmer ───────────────────────────────────
const Shimmer = ({ trackW }: { trackW: number }) => {
  const shimX = useRef(new Animated.Value(-trackW)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(shimX, {
        toValue: trackW,
        duration: 1600,
        easing: Easing.linear,
        useNativeDriver: false,
      }),
    ).start();
  }, [trackW]);

  return (
    <View style={{ position: 'absolute', width: trackW, height: TRACK_HEIGHT, overflow: 'hidden', borderRadius: 2 }}>
      <Animated.View
        style={{
          position: 'absolute',
          width: trackW * 0.4,
          height: TRACK_HEIGHT,
          backgroundColor: 'rgba(255,255,255,0.4)',
          transform: [{ translateX: shimX }],
        }}
      />
    </View>
  );
};

// ─── Burst particles ──────────────────────────
const Burst = ({ active }: { active: boolean }) => {
  const anims = useRef(
    Array.from({ length: 8 }, () => ({
      dist: new Animated.Value(0),
      opacity: new Animated.Value(0),
    })),
  ).current;

  useEffect(() => {
    if (!active) return;
    anims.forEach(({ dist, opacity }) => {
      dist.setValue(0);
      opacity.setValue(0);
      Animated.parallel([
        Animated.spring(dist, { toValue: 26, friction: 5, tension: 180, useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 1, duration: 60, useNativeDriver: true }),
          Animated.delay(150),
          Animated.timing(opacity, { toValue: 0, duration: 280, useNativeDriver: true }),
        ]),
      ]).start();
    });
  }, [active]);

  return (
    <View style={{ width: 0, height: 0, alignItems: 'center', justifyContent: 'center' }}>
      {anims.map(({ dist, opacity }, i) => {
        const angle = (i / 8) * Math.PI * 2;
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              width: 5, height: 5, borderRadius: 2.5,
              backgroundColor: BRAND_GREEN,
              opacity,
              transform: [
                { translateX: dist.interpolate({ inputRange: [0, 26], outputRange: [0, Math.cos(angle) * 26] }) },
                { translateY: dist.interpolate({ inputRange: [0, 26], outputRange: [0, Math.sin(angle) * 26] }) },
              ],
            }}
          />
        );
      })}
    </View>
  );
};

// ─── Progress bar ──────────────────────────────
const DeliveryProgressBar = ({ itemTotal, onPressInfo }: { itemTotal: number, onPressInfo: () => void }) => {
  const progress = useRef(new Animated.Value(0)).current;
  const vehicleBob = useRef(new Animated.Value(0)).current;
  const vehicleScale = useRef(new Animated.Value(1)).current;

  const [burst1, setBurst1] = useState(false);
  const [burst2, setBurst2] = useState(false);
  const prevTotal = useRef(0);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(vehicleBob, { toValue: -4, duration: 350, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(vehicleBob, { toValue: 0, duration: 350, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ]),
    ).start();
  }, []);

  useEffect(() => {
    const target = Math.min(itemTotal / TIER_2, 1);
    const prev = prevTotal.current;

    if (prev < TIER_1 && itemTotal >= TIER_1) {
      setBurst1(false);
      requestAnimationFrame(() => setBurst1(true));
    }
    if (prev < TIER_2 && itemTotal >= TIER_2) {
      setBurst2(false);
      requestAnimationFrame(() => setBurst2(true));
    }
    prevTotal.current = itemTotal;

    Animated.sequence([
      Animated.spring(vehicleScale, { toValue: 1.4, friction: 3, tension: 300, useNativeDriver: false }),
      Animated.spring(vehicleScale, { toValue: 1.0, friction: 7, tension: 200, useNativeDriver: false }),
    ]).start();

    Animated.spring(progress, {
      toValue: Number.isFinite(target) ? target : 0,
      friction: 10,
      tension: 80,
      useNativeDriver: false,
    }).start();
  }, [itemTotal]);

  const fillWidth = progress.interpolate({ inputRange: [0, 1], outputRange: [0, TRACK_WIDTH] });
  const vehicleLeft = progress.interpolate({ inputRange: [0, 1], outputRange: [-16, TRACK_WIDTH - 16] });
  const barColor = itemTotal >= TIER_2 ? BRAND_GREEN : itemTotal >= TIER_1 ? '#F59E0B' : '#6EE7B7';
  const vehicleBgColor = itemTotal >= TIER_2 ? BRAND_GREEN : '#9CA3AF';

  const getTierMessage = () => {
    if (itemTotal >= TIER_2) return 'Free delivery unlocked!';
    if (itemTotal >= TIER_1) return `Add ₹${TIER_2 - itemTotal} more for FREE delivery`;
    return `Add ₹${TIER_1 - itemTotal} more to save ₹10 on delivery`;
  };
  const getIcon = () => itemTotal >= TIER_2 ? 'rocket-launch' : itemTotal >= TIER_1 ? 'moped' : 'bicycle';
  const getIconColor = () => itemTotal >= TIER_2 ? BRAND_GREEN : itemTotal >= TIER_1 ? '#F59E0B' : '#9CA3AF';

  return (
    <View style={pb.container}>
      <View style={pb.header}>
        <View style={[pb.iconCircle, itemTotal >= TIER_2 && pb.iconCircleUnlocked]}>
          <MaterialCommunityIcons name={getIcon() as any} size={22} color={getIconColor()} />
        </View>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={pb.eyebrow}>{itemTotal >= TIER_2 ? 'ACHIEVEMENT UNLOCKED' : 'DELIVERY SAVINGS'}</Text>
            <TouchableOpacity onPress={onPressInfo} style={{ marginLeft: 6, opacity: 0.6 }}>
              <Feather name="info" size={10} color="#666" />
            </TouchableOpacity>
          </View>
          <Text style={pb.message}>{getTierMessage()}</Text>
        </View>
      </View>

      <View style={{ width: TRACK_WIDTH, marginBottom: 28, position: 'relative' }}>
        <View style={pb.rail} />

        <Animated.View style={[pb.fill, { width: fillWidth, backgroundColor: barColor }]}>
          <Shimmer trackW={TRACK_WIDTH} />
        </Animated.View>

        {/* Tier 1 marker */}
        <View style={[pb.markerWrap, { left: (TIER_1 / TIER_2) * TRACK_WIDTH - 8 }]}>
          <View style={[pb.markerDot, itemTotal >= TIER_1 && { backgroundColor: '#F59E0B', borderColor: '#FBBF24' }]} />
          <Burst active={burst1} />
        </View>

        {/* Tier 2 marker */}
        <View style={[pb.markerWrap, { left: TRACK_WIDTH - 8 }]}>
          <View style={[pb.markerDot, itemTotal >= TIER_2 && { backgroundColor: BRAND_GREEN, borderColor: '#34D399' }]} />
          <Burst active={burst2} />
        </View>

        {/* Vehicle */}
        <Animated.View
          style={[pb.vehicle, { transform: [{ translateX: vehicleLeft }, { translateY: vehicleBob }, { scale: vehicleScale }] }]}
        >
          <View style={[pb.vehicleBubble, { backgroundColor: vehicleBgColor }]}>
            <MaterialCommunityIcons name={itemTotal >= TIER_2 ? 'rocket-launch' : 'moped'} size={13} color="#FFF" />
          </View>
          <View style={pb.exhaustRow}>
            {[3, 2.5, 2].map((s, i) => (
              <View key={i} style={[pb.exhaustDot, { width: s, height: s, opacity: 0.15 + i * 0.12 }]} />
            ))}
          </View>
        </Animated.View>

        {/* Start (0) marker */}
        <View style={[pb.markerWrap, { left: -8 }]}>
          <View style={pb.markerDotSmall} />
        </View>
      </View>

      {/* Responsive One-Line Legend */}
      <View style={pb.legendRow}>
        <View style={pb.legendItem}>
          <Text style={pb.markerLabel}>₹0</Text>
        </View>
        <View style={[pb.legendItem, { left: (TIER_1 / TIER_2) * TRACK_WIDTH - (TRACK_WIDTH/2) }]}>
          <Text style={[pb.markerLabel, itemTotal >= TIER_1 && { color: '#F59E0B' }]}>₹{TIER_1}</Text>
        </View>
        <View style={pb.legendItem}>
          <Text style={[pb.markerLabel, itemTotal >= TIER_2 && { color: BRAND_GREEN }]}>₹{TIER_2}</Text>
        </View>
      </View>
    </View>
  );
};

// ─── Main screen ──────────────────────────────
export default function CartScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { items: cartItems, updateQuantity, cartTotal: itemTotal, deliveryFee, addToCart, clearCart, restaurantId } = useCart();
  const { selectedAddress } = useAddress();
  const [addons, setAddons] = useState<any[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'COD' | 'UPI'>('COD');
  const [infoModalConfig, setInfoModalConfig] = useState<{ visible: boolean; type: 'PLATFORM' | 'DELIVERY' | 'SENTINEL_ERROR'; errorMsg?: string }>({ visible: false, type: 'PLATFORM' });
  const [isValidating, setIsValidating] = useState(false);
  const [unavailableItemIds, setUnavailableItemIds] = useState<string[]>([]);
  const [isBakeryClosed, setIsBakeryClosed] = useState(false);

  // ─── Silent Availability Polling (10s) ────────────────
  useEffect(() => {
    if (!restaurantId || cartItems.length === 0) return;

    const checkAvailability = async () => {
      try {
        // 1. Check Restaurant Status
        const { data: resData } = await supabase.from('restaurants').select('is_open').eq('id', restaurantId).single();
        if (resData) setIsBakeryClosed(!resData.is_open);

        // 2. Check Items/Combos Availability
        const itemIds = cartItems.filter(i => i.item_id).map(i => i.item_id);
        const comboIds = cartItems.filter(i => i.combo_id).map(i => i.combo_id);

        const unavailable: string[] = [];

        if (itemIds.length > 0) {
          const { data: itemsData } = await supabase.from('items').select('id, is_available').in('id', itemIds);
          itemsData?.forEach(item => {
             if (!item.is_available) unavailable.push(item.id);
          });
        }
        
        if (comboIds.length > 0) {
          const { data: combosData } = await supabase.from('combos').select('id, is_available').in('id', comboIds);
          combosData?.forEach(combo => {
             if (!combo.is_available) unavailable.push(combo.id);
          });
        }

        setUnavailableItemIds(unavailable);
      } catch (err) {
        console.error('Availability check failed:', err);
      }
    };

    checkAvailability(); // Initial check
    const interval = setInterval(checkAvailability, 10000);
    return () => clearInterval(interval);
  }, [restaurantId, cartItems.length]);

  const isCheckoutDisabled = isBakeryClosed || unavailableItemIds.length > 0 || isValidating;

  const finalTotal = itemTotal + deliveryFee;

  const togglePaymentMethod = () => setPaymentMethod(prev => (prev === 'COD' ? 'UPI' : 'COD'));

  const handleProceedToPay = async () => {
    if (!selectedAddress || !restaurantId) return;
    if (isBakeryClosed || unavailableItemIds.length > 0) return;
    
    setIsValidating(true);
    try {
      // FINAL PRE-PAYMENT VALIDATION (SPLIT-SECOND CHECK)
      const itemIds = cartItems.filter(i => i.item_id).map(i => i.item_id);
      const comboIds = cartItems.filter(i => i.combo_id).map(i => i.combo_id);

      const { data: preflight, error: preflightErr } = await supabase.rpc('sentinel_preflight_check', {
        p_res_id: restaurantId,
        p_user_lat: selectedAddress.lat,
        p_user_long: selectedAddress.long,
        p_item_ids: itemIds,
        p_combo_ids: comboIds,
      });

      if (preflightErr || (preflight && !preflight.success)) {
        setInfoModalConfig({ 
          visible: true, 
          type: 'SENTINEL_ERROR', 
          errorMsg: preflight?.error || 'Validation failed. Please try again.' 
        });
        setIsValidating(false);
        return;
      }

      // If success, proceed to placing screen
      (navigation.navigate as any)('OrderPlacing', { 
        initialEta: preflight.eta,
        paymentMethod: paymentMethod 
      });

    } catch (err: any) {
      console.error('Sentinel Check Failed:', err.message);
      setInfoModalConfig({ visible: true, type: 'SENTINEL_ERROR', errorMsg: 'Logistics engine is busy. Please try again.' });
    } finally {
      setIsValidating(false);
    }
  };

  const handleClearCart = async () => {
    await clearCart();
    navigation.navigate('Home' as never);
  };

  useEffect(() => {
    const fetchAddons = async () => {
      if (restaurantId) {
        setAddons([]); // Clear stale items first
        try {
          const { data, error } = await supabase.from('items')
            .select('*')
            .eq('restaurant_id', restaurantId)
            .limit(6);
            
          if (error) throw error;
          if (data) setAddons(data);
        } catch (err: any) {
          console.error('Error fetching addons:', err.message);
        }
      } else {
        setAddons([]); // Clear if no restaurantId
      }
    };
    fetchAddons();
  }, [restaurantId]);

  if (cartItems.length === 0) {
    return (
      <SafeAreaView style={styles.emptyContainer}>
        <View style={styles.emptyWrapper}>
          <Image 
            source={require('../../assets/empty_cart.png')} 
            style={styles.emptyHugeImg}
            resizeMode="contain"
          />
          <View style={styles.emptyTextSpace}>
            <Text style={styles.emptyTitle}>YOUR CART IS</Text>
            <Text style={styles.emptyTitleMotive}>EMOTIONALLY EMPTY</Text>
          </View>
        </View>
        
        <TouchableOpacity 
          style={styles.shopNowBtn} 
          onPress={() => navigation.navigate('Home' as never)}
        >
          <Text style={styles.shopNowText}>SHOP NOW</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.mainContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF" />

      <View style={[styles.headerArea, { paddingTop: insets.top }]}>
        <View style={styles.headerNav}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Feather name="arrow-left" size={24} color="#111" />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.addressLabel}>{selectedAddress?.label || 'Home'}</Text>
            <Text style={styles.addressSub} numberOfLines={1}>{selectedAddress?.address_line || 'Set Location'}</Text>
          </View>
          <TouchableOpacity onPress={handleClearCart} style={styles.trashBtn}>
            <Feather name="trash-2" size={20} color="#666" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.mainContainer} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        <View style={styles.progressCard}>
          <DeliveryProgressBar 
            itemTotal={itemTotal} 
            onPressInfo={() => setInfoModalConfig({ visible: true, type: 'DELIVERY' })}
          />
        </View>

        {/* Availability Warning Banner */}
        {(isBakeryClosed || unavailableItemIds.length > 0) && (
          <View style={styles.warningBanner}>
            <Feather name="alert-triangle" size={18} color="#991B1B" />
            <Text style={styles.warningText}>
              {isBakeryClosed ? 'Bakery is currently closed for orders.' : 'One or more items in your cart are currently unavailable.'}
            </Text>
          </View>
        )}

        <View style={styles.whiteCard}>
          <Text style={styles.cardTitle}>YOUR ORDER</Text>
          {cartItems.map((item) => {
            const isUnavailable = unavailableItemIds.includes(item.item_id || item.combo_id || '');
            return (
              <View key={item.id} style={[styles.cartItemRow, isUnavailable && { opacity: 0.5 }]}>
                <View style={styles.itemLeft}>
                  <Image
                    source={{ uri: item.image_url || 'https://images.unsplash.com/photo-1544148103-0773bf10d330?w=100' }}
                    style={styles.itemThumb}
                  />
                  <View style={styles.itemMeta}>
                    <View style={styles.vegIndicator}>
                      <VegIndicator isVeg={item.is_veg} size={14} />
                      <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                    </View>
                    <Text style={styles.itemPriceText}>₹{item.price} each</Text>
                  </View>
                </View>
                <View style={styles.itemActions}>
                  <View style={styles.qtyControl}>
                    <TouchableOpacity 
                      onPress={() => updateQuantity(item.id, item.quantity - 1)}
                    >
                      <Feather name="minus" size={16} color={BRAND_GREEN} />
                    </TouchableOpacity>
                    <Text style={styles.qtyText}>{item.quantity}</Text>
                    <TouchableOpacity 
                      onPress={() => !isUnavailable && updateQuantity(item.id, item.quantity + 1)}
                      disabled={isUnavailable}
                    >
                      <Feather name="plus" size={16} color={isUnavailable ? '#CCC' : BRAND_GREEN} />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.itemSubtotalText}>₹{item.price * item.quantity}</Text>
                </View>
              </View>
            );
          })}
          <TouchableOpacity style={styles.addMoreMini} onPress={() => navigation.navigate('Home' as never)}>
            <Text style={styles.addMoreMiniText}>+ ADD MORE ITEMS</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.addonSection}>
          <Text style={styles.addonHeading}>COMPLETE YOUR MEAL</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {addons.map((item) => (
              <View key={item.id} style={styles.addonItemCard}>
                <View style={styles.addonImgWrap}>
                  <Image source={{ uri: item.image_url || 'https://images.unsplash.com/photo-1544148103-0773bf10d330?w=120' }} style={styles.addonImg} />
                  <TouchableOpacity style={styles.addonAddBtn} onPress={() => addToCart(item, 1)}>
                    <Feather name="plus" size={16} color={BRAND_GREEN} />
                  </TouchableOpacity>
                </View>
                <View style={styles.addonMeta}>
                  <VegIndicator isVeg={item.type === 'veg'} size={10} />
                  <Text style={styles.addonName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.addonPrice}>₹{item.price}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>

        <View style={styles.billContainer}>
          <Text style={styles.billHeader}>BILL SUMMARY</Text>
          <View style={styles.billLine}>
            <Text style={styles.billLabel}>Item Total</Text>
            <Text style={styles.billAmount}>₹{itemTotal}</Text>
          </View>
          <View style={styles.billLine}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.billLabel}>Delivery Fee</Text>
              <TouchableOpacity onPress={() => setInfoModalConfig({ visible: true, type: 'DELIVERY' })} style={{ marginLeft: 6 }}>
                <Feather name="info" size={12} color="#999" />
              </TouchableOpacity>
            </View>
            <Text style={[styles.billAmount, deliveryFee === 0 && { color: BRAND_GREEN }]}>
              {deliveryFee === 0 ? 'FREE' : `₹${deliveryFee}`}
            </Text>
          </View>
          <View style={styles.billLine}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.billLabel}>Platform Fee</Text>
              <TouchableOpacity onPress={() => setInfoModalConfig({ visible: true, type: 'PLATFORM' })} style={{ marginLeft: 6 }}>
                <Feather name="info" size={12} color="#999" />
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[styles.billAmount, { textDecorationLine: 'line-through', color: '#BBB', marginRight: 6, fontSize: 12 }]}>₹2</Text>
              <Text style={[styles.billAmount, { color: BRAND_GREEN }]}>FREE</Text>
            </View>
          </View>
          <View style={styles.billLine}>
            <Text style={styles.billLabel}>Handling & Charges</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[styles.billAmount, { textDecorationLine: 'line-through', color: '#BBB', marginRight: 6, fontSize: 12 }]}>₹3</Text>
              <Text style={[styles.billAmount, { color: BRAND_GREEN }]}>FREE</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.totalLine}>
            <Text style={styles.totalLabel}>GRAND TOTAL</Text>
            <Text style={styles.totalAmountText}>₹{finalTotal}</Text>
          </View>
          <Text style={styles.legalLabel}>
            Review your order carefully. Orders once placed are non-cancellable to ensure fresh preparation and timely delivery.
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom > 0 ? insets.bottom : 20 }]}>
        <TouchableOpacity style={styles.paymentInfo} onPress={togglePaymentMethod} activeOpacity={0.7}>
          <Text style={styles.payLabel}>PAY USING  <Feather name="refresh-cw" size={10} color={BRAND_GREEN} /></Text>
          <View style={styles.methodRow}>
            <MaterialCommunityIcons name={paymentMethod === 'COD' ? 'cash-multiple' : 'lightning-bolt'} size={16} color="#111" />
            <Text style={styles.methodName}>{paymentMethod === 'COD' ? 'CASH ON DELIVERY' : 'UPI'}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.checkoutBtn, (isCheckoutDisabled) && { opacity: 0.5, backgroundColor: '#999' }]} 
          activeOpacity={0.8}
          onPress={handleProceedToPay}
          disabled={isCheckoutDisabled}
        >
          {isValidating ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <>
              <Text style={styles.checkoutBtnText}>PAY ₹{finalTotal}</Text>
              <Feather name="chevron-right" size={20} color="#FFF" />
            </>
          )}
        </TouchableOpacity>
      </View>

      {infoModalConfig.visible && (
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setInfoModalConfig({ ...infoModalConfig, visible: false })} />
          <View style={styles.infoModal}>
            <View style={styles.modalHeader}>
              <MaterialCommunityIcons name={infoModalConfig.type === 'PLATFORM' ? 'shield-check-outline' : 'truck-delivery-outline'} size={24} color={BRAND_GREEN} />
              <Text style={styles.modalTitle}>{infoModalConfig.type === 'PLATFORM' ? 'Platform Fee' : 'Delivery Model'}</Text>
            </View>
            <Text style={styles.modalText}>
              {infoModalConfig.type === 'PLATFORM'
                ? `Platform fee and handling charges have been waived! You always pay exactly what you see.`
                : infoModalConfig.type === 'DELIVERY'
                ? `Tiered delivery pricing:\n\n• Below ₹49 → ₹25 fee\n• ₹49–₹88 → ₹15 fee\n• ₹89 or more → FREE`
                : infoModalConfig.errorMsg}
            </Text>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setInfoModalConfig({ ...infoModalConfig, visible: false })}>
              <Text style={styles.modalCloseText}>Got it!</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

// ── Progress bar styles ───────────────────────────────────────────────────────
const pb = StyleSheet.create({
  container: { paddingTop: 4, paddingBottom: 30, paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  iconCircle: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: '#F4F4F5', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#E8E8E8',
  },
  iconCircleUnlocked: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
  eyebrow: { fontSize: 9, fontWeight: '900', color: '#AAAAAA', letterSpacing: 1.2, marginBottom: 3 },
  message: { fontSize: 14, fontWeight: '800', color: '#111', lineHeight: 19 },
  rail: { position: 'absolute', width: '100%', height: TRACK_HEIGHT, backgroundColor: '#E0E0E0', borderRadius: 2 },
  fill: { position: 'absolute', height: TRACK_HEIGHT, borderRadius: 2, overflow: 'hidden' },
  markerWrap: { position: 'absolute', top: -5, alignItems: 'center', width: 16 },
  markerDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2.5, borderColor: '#D0D0D0', backgroundColor: '#E8E8E8', zIndex: 2 },
  markerLabel: { fontSize: 10, fontWeight: '900', color: '#888' },
  legendRow: { flexDirection: 'row', justifyContent: 'space-between', width: TRACK_WIDTH, marginTop: -15 },
  legendItem: { alignItems: 'center', minWidth: 40 },
  markerDotSmall: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: '#D0D0D0', backgroundColor: '#E8E8E8', zIndex: 2, marginTop: 3 },
  vehicle: { position: 'absolute', top: -(32 - TRACK_HEIGHT) / 2 - 5, zIndex: 10 },
  vehicleBubble: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5, borderColor: '#FFF',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18, shadowRadius: 6, elevation: 5,
  },
  exhaustRow: { flexDirection: 'row', position: 'absolute', left: -10, top: 13, gap: 2 },
  exhaustDot: { borderRadius: 99, backgroundColor: '#999' },
  segmentLabelWrap: { position: 'absolute', top: -20, width: 100, alignItems: 'center' },
  segmentLabel: { fontSize: 8, fontWeight: '900', color: '#999', textAlign: 'center', letterSpacing: 0.5 },
});

// ── Screen styles ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#ECEEF1' },
  headerArea: { backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E8E8E8' },
  headerNav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  backBtn: { width: 32 },
  headerInfo: { flex: 1, marginLeft: 12, justifyContent: 'center' },
  trashBtn: { padding: 4 },
  addressLabel: { fontSize: 18, fontWeight: '900', color: '#111' },
  addressSub: { fontSize: 13, color: '#666', fontWeight: '500', marginTop: 2 },
  progressCard: { backgroundColor: '#FFF', marginTop: 10, paddingTop: 20 },
  whiteCard: { backgroundColor: '#FFF', padding: 16, marginTop: 10 },
  cardTitle: { fontSize: 11, fontWeight: '900', color: '#AAA', letterSpacing: 1, marginBottom: 15 },
  cartItemRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  itemLeft: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  itemThumb: { width: 50, height: 50, borderRadius: 8, marginRight: 12, backgroundColor: '#F3F4F6' },
  itemMeta: { flex: 1 },
  vegIndicator: { flexDirection: 'row', alignItems: 'center' },
  itemName: { fontSize: 14, fontWeight: '700', color: '#333', marginLeft: 4, flexShrink: 1 },
  itemPriceText: { fontSize: 12, color: '#666', marginTop: 2, marginLeft: 16 },
  oosText: { fontSize: 10, fontWeight: '900', color: '#991B1B', marginTop: 4, marginLeft: 16 },
  warningBanner: { 
    backgroundColor: '#FFF7ED', 
    marginHorizontal: 16, 
    marginVertical: 12,
    padding: 14, 
    borderRadius: 12, 
    flexDirection: 'row', 
    alignItems: 'center', 
    borderWidth: 1.5, 
    borderColor: '#FED7AA',
    shadowColor: '#EA580C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  warningText: { fontSize: 12, fontWeight: '800', color: '#9A3412', marginLeft: 12, flex: 1, lineHeight: 18 },
  itemActions: { alignItems: 'flex-end', marginLeft: 10 },
  qtyControl: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#E5E7EB',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: '#F9FAFB',
  },
  qtyText: { marginHorizontal: 12, fontSize: 14, fontWeight: '900', color: BRAND_GREEN },
  itemSubtotalText: { fontSize: 14, fontWeight: '800', color: '#111', marginTop: 6 },
  addMoreMini: { paddingVertical: 8 },
  addMoreMiniText: { color: BRAND_GREEN, fontWeight: '800', fontSize: 13 },
  addonSection: { backgroundColor: '#FFF', padding: 16, marginTop: 10 },
  addonHeading: { fontSize: 11, fontWeight: '900', color: '#AAA', letterSpacing: 1, marginBottom: 16 },
  addonItemCard: { width: 110, marginRight: 16 },
  addonImgWrap: { position: 'relative' },
  addonImg: { width: '100%', height: 110, borderRadius: 12, backgroundColor: '#F8F9FA' },
  addonAddBtn: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: '#FFF', width: 28, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
  },
  addonMeta: { marginTop: 8 },
  addonName: { fontSize: 12, fontWeight: '700', color: '#333' },
  addonPrice: { fontSize: 12, color: '#666', marginTop: 2 },
  billContainer: { backgroundColor: '#FFF', padding: 20, marginTop: 10 },
  billHeader: { fontSize: 15, fontWeight: '900', color: '#111', marginBottom: 20 },
  billLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  billLabel: { fontSize: 14, color: '#666', fontWeight: '600' },
  billAmount: { fontSize: 14, color: '#111', fontWeight: '800' },
  divider: { height: 1, backgroundColor: '#F0F0F0', marginVertical: 16 },
  totalLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 17, fontWeight: '900', color: '#111' },
  totalAmountText: { fontSize: 20, fontWeight: '900', color: '#111' },
  legalLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '600', marginTop: 16, textAlign: 'center', fontStyle: 'italic' },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#F0F0F0',
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 15,
    shadowColor: '#000', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 10,
  },
  paymentInfo: { flex: 1 },
  payLabel: { fontSize: 10, fontWeight: '900', color: '#888', letterSpacing: 0.5 },
  methodRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  methodName: { fontSize: 13, fontWeight: '800', color: '#111', marginLeft: 6 },
  checkoutBtn: {
    backgroundColor: BRAND_GREEN, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 25, paddingVertical: 14, borderRadius: 16,
  },
  checkoutBtnText: { color: '#FFF', fontSize: 17, fontWeight: '900', marginRight: 8 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF', paddingHorizontal: 30 },
  emptyWrapper: { alignItems: 'center', width: '100%', marginBottom: 40 },
  emptyHugeImg: { width: width * 0.7, height: width * 0.7, resizeMode: 'contain', marginBottom: 20 },
  emptyTextSpace: { alignItems: 'center' },
  emptyTitle: { fontSize: 24, fontWeight: '900', color: '#1E293B' },
  emptyTitleMotive: { fontSize: 28, fontWeight: '900', color: BRAND_GREEN, marginTop: 4, letterSpacing: -1 },
  emptyDivider: { width: 40, height: 4, backgroundColor: BRAND_GREEN, marginTop: 15, borderRadius: 2 },
  emptySubtitle: { fontSize: 13, color: '#64748B', marginTop: 15, fontWeight: '600', textAlign: 'center', lineHeight: 20 },
  shopNowBtn: { 
    marginTop: 20, 
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1.5,
    borderBottomColor: BRAND_GREEN,
    paddingBottom: 4,
  },
  shopNowText: { 
    color: BRAND_GREEN, 
    fontSize: 16, 
    fontWeight: '900', 
    letterSpacing: 1.5,
    textTransform: 'uppercase'
  },
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', zIndex: 2000 },
  infoModal: { width: '85%', backgroundColor: '#FFF', borderRadius: 24, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 20 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  modalTitle: { fontSize: 18, fontWeight: '900', color: '#111', marginLeft: 10 },
  modalText: { fontSize: 14, color: '#666', lineHeight: 22, marginBottom: 20, fontWeight: '500' },
  modalCloseBtn: { backgroundColor: BRAND_GREEN, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  modalCloseText: { color: '#FFF', fontSize: 15, fontWeight: '900' },
});