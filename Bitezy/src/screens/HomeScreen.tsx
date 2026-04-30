import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, Image, TextInput, 
  TouchableOpacity, SafeAreaView, Platform, Modal, 
  Pressable, StatusBar, ActivityIndicator 
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// --- Context & Libs ---
import { supabase } from '../lib/supabase';
import { useCart } from '../context/CartContext';
import { useAddress } from '../context/AddressContext';
import { useRestaurant } from '../context/RestaurantContext';
import { useNotifications } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';

// --- Components ---
import AddressPickerModal from './AddressPickerScreen'; 
import CartPill from '../components/CartPill';
import { ActiveOrderWidget } from '../components/home/ActiveOrderWidget';
import SectionHeader from '../components/home/SectionHeader';
import ProductCard from '../components/home/ProductCard';
import FilterSection from '../components/home/FilterSection';
import VegIndicator from '../components/common/VegIndicator';
import RestaurantDetailModal from '../components/home/RestaurantDetailModal';

const AVATAR_MAP: any = {
  cool_rider: require('../../assets/cool_rider.png'),
  kadak_chai: require('../../assets/kadak_chai.png'),
  sizzling_samosa: require('../../assets/sizzling_samosa.png'),
  swagger_sandwich: require('../../assets/swagger_sandwich.png'),
};

const BRAND_GREEN = '#02844F';
const BG_COLOR = '#FFFFFF';

// ── Helpers ──────────────────────────────────────────────────────────────────

const formatTime = (t: string | null | undefined): string => {
  if (!t) return '';
  const [hStr, mStr] = t.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12} ${ampm}` : `${h12}:${mStr} ${ampm}`;
};

const checkIsOpen = (open_time: string | null, close_time: string | null): boolean => {
  if (!open_time || !close_time) return false;
  const now = new Date();
  const toMins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const openMins = toMins(open_time);
  const closeMins = toMins(close_time);
  if (closeMins < openMins) return nowMins >= openMins || nowMins < closeMins;
  return nowMins >= openMins && nowMins < closeMins;
};


const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

const HomeScreen = ({ navigation, route }: any) => {
  const { user } = useAuth();
  const { activeOrder } = useNotifications();
  const { selectedAddress, addresses, hasAddresses } = useAddress();
  const { nearestRestaurant } = useRestaurant();
  const { addToCart, items, totalWithDelivery } = useCart();
  const insets = useSafeAreaInsets();

  // Derive real-time open status from restaurant times + manual override flag
  const isTimeOpen = nearestRestaurant
    ? checkIsOpen(nearestRestaurant.open_time, nearestRestaurant.close_time)
    : false;
  const isManualOpen = nearestRestaurant?.is_open ?? true;
  const isOpen = isTimeOpen && isManualOpen;

  // --- States ---
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [qty, setQty] = useState(1);
  
  const [quickPicks, setQuickPicks] = useState<any[]>([]);
  const [combos, setCombos] = useState<any[]>([]);
  const [allSnacks, setAllSnacks] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [showRestaurantModal, setShowRestaurantModal] = useState(false);
  const [fixedETA, setFixedETA] = useState<number | null>(null);
  const [availableRiders, setAvailableRiders] = useState<number>(0);

  // Derive dynamic delivery time
  const fetchFixedETA = async () => {
    if (!selectedAddress || !nearestRestaurant) return;
    const { data, error } = await supabase.rpc('get_load_balanced_eta_mins', {
      p_res_id: nearestRestaurant.id,
      p_user_lat: selectedAddress.lat,
      p_user_long: selectedAddress.long
    });
    if (data) setFixedETA(data);
  };

  const isFleetBusy = availableRiders === 0;
  const isActuallyOpen = isOpen && !isFleetBusy && (fixedETA ? fixedETA <= 18 : true);

  // ── AUTO-SHOW ADDRESS PICKER ──────────────────────────────────────────────
  useEffect(() => {
    // Don't do anything if user isn't loaded or address check is still pending
    if (!user || hasAddresses === null) return;

    // 1. Explicit prompt from route (new signup / first login)
    if (route?.params?.promptAddress) {
      const timer = setTimeout(() => setShowAddressModal(true), 500);
      return () => clearTimeout(timer);
    }

    // 2. Fallback: user has no saved addresses at all
    if (hasAddresses === false) {
      const timer = setTimeout(() => setShowAddressModal(true), 500);
      return () => clearTimeout(timer);
    }
  }, [hasAddresses, route?.params?.promptAddress, user]);

  const fetchCatalog = async () => {
    try {
      setIsLoading(true);
      const restaurantId = nearestRestaurant?.id;
      const itemsQuery = supabase.from('items').select('*');
      const combosQuery = supabase.from('combos').select('*');
      
      const { data: itemsData, error: itemsError } = restaurantId
        ? await itemsQuery.eq('restaurant_id', restaurantId)
        : await itemsQuery;
      
      const { data: combosData, error: combosError } = restaurantId
        ? await combosQuery.eq('restaurant_id', restaurantId)
        : await combosQuery;

      if (itemsError || combosError) throw new Error('Network failure');
      
      setIsOffline(false);
      if (itemsData) {
        const mappedItems = itemsData.map(i => ({ 
          ...i, 
          isVeg: i.type === 'veg', 
          image: i.image_url, 
          desc: i.description,
          highly_reordered: i.highly_reordered ?? false,
          gimmick_price: i.gimmick_price,
          is_high_protein: i.is_high_protein ?? false
        }));
        setAllSnacks(mappedItems);
        setQuickPicks(mappedItems.slice(0, 6));
        const cats = Array.from(new Set(itemsData.map(i => i.category || 'Snacks')));
        setCategories(cats as string[]);
      }
      if (combosData) {
        setCombos(combosData.map(c => ({
          ...c,
          title: c.name,
          type: 'combo',
          isVeg: c.type === 'veg',
          highly_reordered: c.highly_reordered ?? false,
          is_high_protein: c.is_high_protein ?? false,
          image: c.image_url,
          gimmick_price: c.gimmick_price || c.price + 30,
          originalPrice: c.price + 30,
          save: '25%',
          desc: c.description
        })));
      }
    } catch (err) {
      console.error('Fetch failed:', err);
      setIsOffline(true);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Fetch Data & Listeners ---
  useEffect(() => {
    fetchCatalog();
  }, [nearestRestaurant?.id]);

  useFocusEffect(
    useCallback(() => {
      fetchFixedETA();
      
      const fetchFleet = async () => {
        if (!nearestRestaurant) return;
        const { data } = await supabase.rpc('fn_count_nearby_riders_v7', {
          p_res_id: nearestRestaurant.id,
          p_radius_km: 1.5 
        });
        if (typeof data === 'number') setAvailableRiders(data);
      };
      fetchFleet();

      // Silent BG Refresh (Every 30s)
      const refreshInterval = setInterval(() => {
        fetchFixedETA();
        fetchFleet();
      }, 30000);

      // Real-time fleet listener
      const riderSub = supabase.channel('riders-availability')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'riders' }, () => {
          fetchFleet();
        }).subscribe();

      return () => {
        clearInterval(refreshInterval);
        supabase.removeChannel(riderSub);
      };
    }, [nearestRestaurant?.id])
  );

  const toggleFilter = (filter: string) => setActiveFilter(activeFilter === filter ? null : filter);

  const getFilteredItems = (list: any[]) => {
    if (!list || !Array.isArray(list)) return [];
    let result = [...list];
    
    // Search Filter
    if (searchQuery && searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(i => {
        const name = (i.name || i.title || '').toLowerCase();
        const cat = (i.category || '').toLowerCase();
        const d = (i.description || i.desc || '').toLowerCase();
        return name.includes(q) || cat.includes(q) || d.includes(q);
      });
    }
    
    // Quick Filters
    if (activeFilter === 'veg') result = result.filter(i => i.isVeg);
    if (activeFilter === 'under49') result = result.filter(i => i.price <= 49);
    if (activeFilter === 'reordered') {
      result = result.filter(i => i.highly_reordered);
    }
    if (activeFilter === 'protein') {
      result = result.filter(i => i.is_high_protein);
    }
    
    return result;
  };

  const openItemDetail = (item: any) => {
    setSelectedItem(item);
    setQty(1);
  };

  if (isOffline) {
    return (
      <SafeAreaView style={styles.offlineContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFF" translucent={false} />
        <View style={styles.offlineContent}>
          <Image 
            source={require('../../assets/no_internet.png')} 
            style={styles.offlineImg}
          />
          <Text style={styles.offlineTitle}>Oops!</Text>
          <Text style={styles.offlineMotive}>INTERNET'S ON A BREAK 🍩</Text>
          <Text style={styles.offlineSubtitle}>Your internet took a snack break. Get back on the grid!</Text>
          
          <TouchableOpacity 
            style={styles.retryBtn} 
            onPress={fetchCatalog}
          >
            <Text style={styles.retryBtnText}>RETRY</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#02844F" translucent={false} />

      {/* ── ADDRESS PICKER MODAL ── */}
      <AddressPickerModal 
        visible={showAddressModal} 
        onClose={() => setShowAddressModal(false)} 
      />

      {/* ── GREEN DASHBOARD HEADER ── */}
      <View style={[styles.greenHeader, { paddingTop: Math.max(8, insets.top) }, !isOpen && styles.greenHeaderClosed]}>
        <View style={styles.headerTopRow}>
          <View style={styles.headerLeft}>
            <View style={[styles.timeBox, !isActuallyOpen && styles.timeBoxClosed]}>
              <Text style={[styles.timeBoxNum, !isActuallyOpen && styles.timeBoxNumClosed]}>
                {isActuallyOpen ? (fixedETA || '--') : (fixedETA && fixedETA > 18) ? 'BUSY' : isFleetBusy && isOpen ? 'BUSY' : '--'}
              </Text>
              <Text style={[styles.timeBoxText, !isActuallyOpen && styles.timeBoxTextClosed]}>
                {isActuallyOpen ? 'MINS' : (fixedETA && fixedETA > 18) ? 'OVERLOADED' : isFleetBusy && isOpen ? 'NO RIDER' : 'CLOSED'}
              </Text>
            </View>
            <View style={styles.headerLocation}>
              <View style={styles.openTillRow}>
                <Feather name="clock" size={10} color={isOpen ? '#FFF' : '#999'} />
                <Text style={[styles.openTillText, !isOpen && styles.openTillTextClosed]}>
                  {nearestRestaurant
                    ? isOpen
                      ? `CLOSES AT ${formatTime(nearestRestaurant.close_time)}`
                      : !isManualOpen
                        ? 'OPENING SOON'
                        : `OPENS AT ${formatTime(nearestRestaurant.open_time)}`
                    : 'NO RESTAURANT NEARBY'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowAddressModal(true)}>
                <Text style={styles.locationTitle} numberOfLines={1}>
                  {selectedAddress ? selectedAddress.label || selectedAddress.address_line?.split(',')[0] : 'Set Location'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.locationSubRow} onPress={() => setShowAddressModal(true)}>
                <Text style={styles.locationSubtitle} numberOfLines={1}>
                  {selectedAddress ? selectedAddress.address_line || 'Tap to change' : 'Tap to add address'}
                </Text>
                <Feather name="chevron-down" size={16} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity onPress={() => navigation.navigate('Cart')} style={styles.notificationIcon}>
              <Feather name="shopping-cart" size={22} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
              {user?.avatar_url && AVATAR_MAP[user.avatar_url] ? (
                <Image source={AVATAR_MAP[user.avatar_url]} style={styles.avatar} />
              ) : (
                <Image source={{ uri: `https://ui-avatars.com/api/?name=${user?.name || 'User'}&background=random` }} style={styles.avatar} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 0 }} style={[styles.mainScroll, !isOpen && styles.mainScrollClosed]}>


        {/* ── SEARCH ── */}
        <View style={styles.searchContainer}>
          <Feather name="search" size={20} color={BRAND_GREEN} />
          <TextInput 
            style={styles.searchInput} 
            placeholder="Search for 'Samosa' or 'Chai'" 
            placeholderTextColor="#888" 
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <View style={styles.searchDivider} />
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Feather name={searchQuery ? "x" : "mic"} size={20} color={BRAND_GREEN} />
          </TouchableOpacity>
        </View>

        <FilterSection activeFilter={activeFilter} toggleFilter={toggleFilter} />

        {/* ── WHAT'S ON YOUR MIND ── */}
        <View style={styles.MindSection}>
          <SectionHeader title="What's on your mind?" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
            {getFilteredItems(quickPicks).map(item => (
              <TouchableOpacity key={item.id} style={styles.quickPickCol} onPress={() => openItemDetail(item)}>
                <Image source={{ uri: item.image }} style={styles.quickPickCircle} resizeMode="contain" />
                <Text style={styles.quickPickLabel} numberOfLines={2}>{item.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* ── COMBOS ── */}
        <View style={styles.ComboSection}>
          <SectionHeader title="Best Value Combos" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
            {getFilteredItems(combos).map(item => (
              <TouchableOpacity
                key={item.id}
                style={styles.comboCard}
                onPress={() => openItemDetail(item)}
                activeOpacity={0.9}
              >
                <Image source={{ uri: item.image }} style={styles.comboImage} resizeMode="cover" />
                <View style={styles.comboGradient}>
                  {item.highly_reordered && (
                    <View style={styles.comboReorderedBadge}>
                      <Text style={styles.comboReorderedText}>🔥 TOP CHOICE</Text>
                    </View>
                  )}
                  {item.is_high_protein && (
                    <View style={[styles.comboReorderedBadge, item.highly_reordered && styles.comboProteinBadge]}>
                      <Text style={styles.comboProteinText}>💪 HI-PROTEIN</Text>
                    </View>
                  )}
                  <Text style={styles.comboTitle} numberOfLines={1}>{item.title}</Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={styles.comboPrice}>₹{item.price} <Text style={styles.comboOldPrice}>₹{item.originalPrice}</Text></Text>
                    {isOpen
                      ? <View style={styles.comboTag}><Text style={styles.comboTagText}>{item.save}</Text></View>
                      : <View style={[styles.comboTag, { backgroundColor: '#999' }]}><Text style={styles.comboTagText}>CLOSED</Text></View>
                    }
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.divider} />

        {categories.map(category => {
          const displayItems = getFilteredItems(allSnacks.filter(item => item.category === category));
          if (displayItems.length === 0) return null;

          return (
            <View key={category} style={styles.categoryBlock}>
              <SectionHeader title={category} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
                {displayItems.map(item => (
                  <ProductCard 
                    key={item.id}
                    item={item}
                    isOpen={isActuallyOpen}
                    onAdd={openItemDetail}
                  />
                ))}
              </ScrollView>
            </View>
          );
        })}

        {/* ── BAKERY INFO (bottom of scroll) ── */}
        <TouchableOpacity
          style={styles.bakeryBar}
          onPress={() => setShowRestaurantModal(true)}
          activeOpacity={0.85}
        >
          <MaterialCommunityIcons name="store" size={18} color={BRAND_GREEN} style={{ marginRight: 8 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.bakeryBarName} numberOfLines={1}>
              {nearestRestaurant?.name || 'No bakery selected'}
            </Text>
            <Text style={styles.bakeryBarSub}>
              {nearestRestaurant
                ? isOpen ? '🟢 Open now' : '🔴 Closed'
                : 'No restaurant nearby'}
            </Text>
          </View>
          <Feather name="chevron-up" size={16} color="#AAA" />
        </TouchableOpacity>
      </ScrollView>



      {/* ── DETAIL MODAL ── */}
      <Modal animationType="slide" transparent={true} visible={!!selectedItem} onRequestClose={() => setSelectedItem(null)}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalDismiss} onPress={() => setSelectedItem(null)} />
          <View style={styles.modalContent}>
            {selectedItem && (
              <>
                <View style={styles.modalImageContainer}>
                  <Image source={{ uri: selectedItem.image }} style={styles.modalExtImage} resizeMode="cover" />
                  <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setSelectedItem(null)}>
                    <Ionicons name="close" size={24} color="#555" />
                  </TouchableOpacity>
                </View>
                <View style={styles.modalBody}>
                   <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 12}}>
                     <VegIndicator isVeg={selectedItem.isVeg} />
                     {selectedItem.is_high_protein && (
                       <View style={[styles.modalBadge, styles.modalProteinBadge]}>
                         <MaterialCommunityIcons name="arm-flex" size={12} color="#6366F1" />
                         <Text style={[styles.modalBadgeText, { color: '#6366F1' }]}>HIGH PROTEIN</Text>
                       </View>
                     )}
                     {selectedItem.highly_reordered && (
                       <View style={[styles.modalBadge, styles.modalReorderedBadge]}>
                         <MaterialCommunityIcons name="fire" size={12} color="#D97706" />
                         <Text style={[styles.modalBadgeText, { color: '#D97706' }]}>TOP CHOICE</Text>
                       </View>
                     )}
                   </View>
                   <Text style={styles.modalItemTitle}>{selectedItem.name || selectedItem.title}</Text>
                   <View style={styles.modalPriceContainer}>
                     <Text style={styles.modalItemPrice}>₹{selectedItem.price}</Text>
                     {selectedItem.gimmick_price && (
                       <Text style={styles.modalGimmickPrice}>₹{selectedItem.gimmick_price}</Text>
                     )}
                   </View>
                   <Text style={styles.modalItemDesc}>{selectedItem.desc}</Text>

                   <View style={styles.modalActions}>
                     <View style={styles.qtyControl}>
                       <TouchableOpacity onPress={() => setQty(Math.max(1, qty - 1))} style={styles.qtyBtn}><Text style={styles.qtyMark}>-</Text></TouchableOpacity>
                       <Text style={styles.qtyNumber}>{qty}</Text>
                       <TouchableOpacity onPress={() => setQty(qty + 1)} style={styles.qtyBtn}><Text style={styles.qtyMark}>+</Text></TouchableOpacity>
                     </View>
                     <TouchableOpacity 
                       style={[
                         styles.modalAddCartBtn, 
                         (!isOpen || !selectedItem.is_available) && styles.modalAddCartBtnDisabled
                       ]} 
                       disabled={!isOpen || !selectedItem.is_available}
                       onPress={() => {
                         if (!isOpen || !selectedItem.is_available) return;
                         addToCart(selectedItem, qty);
                         setSelectedItem(null);
                       }}>
                       <Text style={styles.modalAddCartText}>
                         {!selectedItem.is_available 
                           ? 'Sold Out' 
                           : !isOpen 
                             ? 'CLOSED' 
                             : `Add item ₹${selectedItem.price * qty}`}
                       </Text>
                     </TouchableOpacity>
                   </View>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ── FLOATING CART PILL ── */}
      <CartPill 
        itemCount={items.length} 
        totalWithDelivery={totalWithDelivery}
        onPress={() => navigation.navigate('Cart')}
      />

      {/* ── ACTIVE ORDER WIDGET ── */}
      {activeOrder && !['DELIVERED', 'CANCELLED'].includes(activeOrder.status) && items.length === 0 && (
        <ActiveOrderWidget 
          order={activeOrder} 
        />
      )}

      {/* ── RESTAURANT DETAIL MODAL ── */}
      <RestaurantDetailModal
        visible={showRestaurantModal}
        onClose={() => setShowRestaurantModal(false)}
        restaurant={nearestRestaurant}
        isOpen={isOpen}
        isManualOpen={isManualOpen}
      />

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#02844F' },
  mainScroll: { backgroundColor: '#F4F4F5' },
  mainScrollClosed: { backgroundColor: '#EFEFEF' },
  greenHeader: { backgroundColor: '#02844F', paddingBottom: 0 },
  greenHeaderClosed: { backgroundColor: '#6B6B6B' },
  headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15, marginBottom: 20 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  timeBox: { backgroundColor: '#1EC760', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  timeBoxClosed: { backgroundColor: '#D0D0D0' },
  timeBoxNum: { color: '#004A27', fontSize: 24, fontWeight: '900', lineHeight: 24 },
  timeBoxNumClosed: { color: '#888', fontSize: 18 },
  timeBoxText: { color: '#004A27', fontSize: 10, fontWeight: '800' },
  timeBoxTextClosed: { color: '#888' },
  headerLocation: { flex: 1 },
  openTillRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
  openTillText: { color: '#FFF', fontSize: 10, fontWeight: '700', marginLeft: 4, letterSpacing: 0.5 },
  openTillTextClosed: { color: '#CCC' },
  locationTitle: { color: '#FFF', fontSize: 18, fontWeight: '800', marginBottom: 1 },
  locationSubRow: { flexDirection: 'row', alignItems: 'center' },
  locationSubtitle: { color: '#FFF', fontSize: 14, fontWeight: '500', marginRight: 4 },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  notificationIcon: { marginRight: 15, padding: 4 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#EEE' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', marginHorizontal: 16, borderRadius: 12, paddingHorizontal: 16, height: 50, elevation: 3, marginBottom: 20, borderWidth: 1, borderColor: '#F0F0F0', marginTop: 15 },
  searchInput: { flex: 1, marginHorizontal: 10, fontSize: 15, color: '#222' },
  searchDivider: { width: 1, height: 24, backgroundColor: '#EEE', marginRight: 12 },
  horizontalScroll: { paddingHorizontal: 16, paddingBottom: 10 },
  MindSection: { marginBottom: 5, backgroundColor: '#FFF' },
  ComboSection: { marginBottom: 5, backgroundColor: '#FFF' },
  quickPickCol: { alignItems: 'center', marginRight: 18, width: 75 },
  quickPickCircle: { width: 75, height: 75, borderRadius: 37.5, marginBottom: 8, backgroundColor: '#EEE', borderWidth: 1, borderColor: '#F0F0F0' },
  quickPickLabel: { fontSize: 12, fontWeight: '700', color: '#444', textAlign: 'center', lineHeight: 16 },
  comboCard: { width: 280, height: 160, borderRadius: 20, marginRight: 16, overflow: 'hidden', backgroundColor: '#EEE' },
  comboCardDisabled: { opacity: 0.55 },
  comboImage: { width: '100%', height: '100%' },
  comboGradient: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)', padding: 16, justifyContent: 'flex-end' },
  comboTitle: { color: '#FFF', fontSize: 20, fontWeight: '900', marginBottom: 6, letterSpacing: -0.5 },
  comboPrice: { color: '#FFF', fontSize: 18, fontWeight: '900' },
  comboOldPrice: { fontSize: 14, color: '#E0E0E0', textDecorationLine: 'line-through', fontWeight: '500' },
  comboTag: { backgroundColor: '#FFB74D', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start' },
  comboTagText: { fontSize: 11, fontWeight: '900', color: '#222' },
  divider: { height: 6, backgroundColor: '#F4F4F5' },
  categoryBlock: { marginBottom: 5, backgroundColor: BG_COLOR, paddingTop: 5 },
  productCard: { width: 155, marginRight: 15, marginBottom: 10 },
  productCardDisabled: { opacity: 0.6 },
  productCardImgWrap: { width: 155, height: 155, borderRadius: 16, position: 'relative', marginBottom: 18 },
  productCardImg: { width: 155, height: 155, borderRadius: 16, backgroundColor: '#EEE' },
  addBtnAbsCard: { position: 'absolute', bottom: -14, alignSelf: 'center', width: 96, height: 36, backgroundColor: '#FFF', borderRadius: 8, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', elevation: 4, borderWidth: 1, borderColor: '#F0F0F0' },
  addBtnDisabled: { backgroundColor: '#F0F0F0', borderColor: '#E0E0E0', elevation: 0 },
  addBtnTextCard: { color: BRAND_GREEN, fontSize: 15, fontWeight: '900', marginRight: 2 },
  addBtnTextDisabled: { color: '#AAA' },
  addPlusCard: { position: 'absolute', top: 5, right: 6 },
  soldOutBtn: { backgroundColor: '#F5F5F5', borderColor: '#E0E0E0', elevation: 0 },
  soldOutText: { fontSize: 11, fontWeight: '900', color: '#AAA', letterSpacing: 0.5 },
  productCardInfo: { paddingHorizontal: 2 },
  productCardName: { fontSize: 15, fontWeight: '800', color: '#222', marginTop: 4, marginBottom: 4, letterSpacing: -0.3, lineHeight: 18 },
  textMuted: { color: '#AAA' },
  priceContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  productPrice: { fontSize: 14, fontWeight: '800', color: '#222' },
  productDesc: { fontSize: 11, color: '#666', lineHeight: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalDismiss: { flex: 1 },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 20 },
  modalImageContainer: { width: '100%', height: 220, backgroundColor: '#F8F8F8', borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  modalExtImage: { width: '100%', height: '100%' },
  modalCloseBtn: { position: 'absolute', top: 16, right: 16, backgroundColor: '#FFF', borderRadius: 20, padding: 6 },
  modalBody: { padding: 20 },
  modalItemTitle: { fontSize: 24, fontWeight: '900', color: '#222', marginBottom: 6 },
  modalPriceContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  modalItemPrice: { fontSize: 20, fontWeight: '800', color: '#222' },
  modalGimmickPrice: { fontSize: 16, color: '#94A3B8', textDecorationLine: 'line-through', marginLeft: 10, fontWeight: '600' },
  modalItemDesc: { fontSize: 14, color: '#666', lineHeight: 22, marginBottom: 25 },
  modalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
    marginLeft: 8,
    borderWidth: 1,
  },
  modalProteinBadge: {
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
  },
  modalReorderedBadge: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FEF3C7',
  },
  modalBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    marginLeft: 4,
    letterSpacing: 0.8,
  },
  modalActions: { flexDirection: 'row', alignItems: 'center' },
  qtyControl: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E8E8E8', borderRadius: 12, marginRight: 15, height: 50, backgroundColor: '#F9F9F9' },
  qtyBtn: { width: 44, height: 50, justifyContent: 'center', alignItems: 'center' },
  qtyMark: { fontSize: 20, fontWeight: '700', color: BRAND_GREEN },
  qtyNumber: { fontSize: 16, fontWeight: '900', color: '#222', width: 24, textAlign: 'center' },
  modalAddCartBtn: { flex: 1, backgroundColor: BRAND_GREEN, height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  modalAddCartBtnDisabled: { backgroundColor: '#BDBDBD' },
  modalAddCartText: { color: '#FFF', fontSize: 16, fontWeight: '900' },
  bakeryBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#F0F0F0', marginTop: 8, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
  bakeryBarName: { fontSize: 14, fontWeight: '900', color: '#111', marginBottom: 1 },
  bakeryBarSub: { fontSize: 11, fontWeight: '600', color: '#888' },
  offlineContainer: { flex: 1, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  offlineContent: { alignItems: 'center', width: '100%' },
  offlineImg: { width: 260, height: 260, marginBottom: 20 },
  offlineTitle: { fontSize: 32, fontWeight: '900', color: '#1E293B', letterSpacing: -1 },
  offlineMotive: { fontSize: 24, fontWeight: '900', color: BRAND_GREEN, marginTop: 4, letterSpacing: -0.5 },
  offlineSubtitle: { fontSize: 14, color: '#64748B', marginTop: 15, fontWeight: '600', textAlign: 'center', lineHeight: 22 },
  retryBtn: { marginTop: 40, backgroundColor: BRAND_GREEN, paddingVertical: 16, paddingHorizontal: 50, borderRadius: 14, shadowColor: BRAND_GREEN, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  retryBtnText: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 1 },
  comboReorderedBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(255, 87, 34, 0.95)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    zIndex: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  comboReorderedText: {
    color: '#FFF',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  comboProteinBadge: {
    top: 36,
    backgroundColor: 'rgba(99, 102, 241, 0.95)',
  },
  comboProteinText: {
    color: '#FFF',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
});

export default HomeScreen;