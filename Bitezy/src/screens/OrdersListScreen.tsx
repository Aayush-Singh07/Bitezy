import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Image, Platform, ActivityIndicator, RefreshControl, StatusBar, Alert, TextInput } from 'react-native';
import { Feather, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useAddress } from '../context/AddressContext';

const BRAND_GREEN = '#02844F'; 
const LIGHT_BG = '#F8F9FA';

const getStatusConfig = (status: string) => {
  switch (status) {
    case 'DELIVERED':
      return { bg: '#E8F5E9', text: '#2E7D32', label: 'DELIVERED', icon: 'check-circle' as const };
    case 'PREPARING':
      return { bg: '#FFF3E0', text: '#EF6C00', label: 'PREPARING', icon: 'clock' as const };
    case 'PLACED':
      return { bg: '#E3F2FD', text: '#1565C0', label: 'PLACED', icon: 'file-text' as const };
    case 'OUT_FOR_DELIVERY':
      return { bg: '#F3E5F5', text: '#7B1FA2', label: 'OUT FOR DELIVERY', icon: 'truck' as const };
    case 'CANCELLED':
      return { bg: '#FFEBEE', text: '#C62828', label: 'CANCELLED', icon: 'x-circle' as const };
    default:
      return { bg: '#F1F5F9', text: '#475569', label: (status || 'UNKNOWN').toUpperCase(), icon: 'info' as const };
  }
};

const OrdersListScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const { reorderItems } = useCart();
  const { selectAddress, addresses } = useAddress();
  
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const FILTER_OPTIONS = [
    { label: 'ALL', value: 'ALL' },
    { label: 'ACTIVE', value: 'ACTIVE' },
    { label: 'DELIVERED', value: 'DELIVERED' },
    { label: 'CANCELLED', value: 'CANCELLED' },
  ];

  const fetchOrders = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*, restaurants(name, image_url)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (err: any) {
      console.error('Error fetching orders:', err);
      // Fallback if query still fails due to cache or schema sync
      if (err.message?.includes('image_url')) {
         const { data } = await supabase
          .from('orders')
          .select('*, restaurants(name)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
         setOrders(data || []);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [user]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      // 1. Status Filter
      if (activeFilter === 'ACTIVE') {
        // Active = Anything not delivered or cancelled
        if (o.status === 'DELIVERED' || o.status === 'CANCELLED') return false;
      } else if (activeFilter !== 'ALL' && o.status !== activeFilter) {
        return false;
      }

      // 2. Search Filter
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const resName = (o.restaurants?.name || '').toLowerCase();
        const orderId = (o.id || '').toLowerCase();
        return resName.includes(q) || orderId.includes(q);
      }

      return true;
    });
  }, [orders, activeFilter, searchQuery]);

  const liveOrders = filteredOrders.filter(o => o.status !== 'DELIVERED' && o.status !== 'CANCELLED');
  const pastOrders = filteredOrders.filter(o => o.status === 'DELIVERED' || o.status === 'CANCELLED');

  const handleReorder = async (order: any) => {
    try {
      // 1. Fetch items for this order first
      const { data: itemsData, error } = await supabase
        .from('order_items')
        .select('item_id, combo_id, quantity, price')
        .eq('order_id', order.id);
      
      if (error) throw error;

      // 2. Set address persistently
      if (order.address_id) {
        const addr = addresses.find(a => a.id === order.address_id);
        if (addr) await selectAddress(addr);
      }

      // 3. Reorder logic
      await reorderItems(itemsData || [], order.restaurant_id);
      navigation.navigate('Cart');
    } catch (err) {
      console.error('Reorder error:', err);
      Alert.alert("Error", "Failed to reorder items.");
    }
  };

  const renderOrderCard = (order: any) => {
    const config = getStatusConfig(order.status);
    const date = new Date(order.created_at);
    const formattedDate = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const formattedTime = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    return (
      <TouchableOpacity 
        key={order.id} 
        style={styles.orderCard}
        activeOpacity={0.9}
        onPress={() => navigation.navigate('OrderTracking', { orderId: order.id })}
      >
        <View style={styles.cardHeader}>
          <View style={styles.restaurantInfo}>
            <Image 
              source={{ uri: order.restaurants?.image_url || 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&h=400&fit=crop' }} 
              style={styles.restaurantImage} 
            />
            <View style={styles.restaurantTextContainer}>
              <Text style={styles.restaurantName} numberOfLines={1}>{order.restaurants?.name || 'Bitezy Bakery'}</Text>
              <Text style={styles.orderTime}>
                {order.status === 'DELIVERED' && order.delivered_at 
                  ? `Delivered on ${new Date(order.delivered_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} • ${new Date(order.delivered_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
                  : `${formattedDate} • ${formattedTime}`
                }
              </Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
            <Feather name={config.icon} size={12} color={config.text} style={{marginRight: 4}} />
            <Text style={[styles.statusText, { color: config.text }]}>{config.label}</Text>
          </View>
        </View>

        <View style={styles.cardDivider} />

        <View style={styles.cardBody}>
          <View style={styles.orderDetails}>
            <View>
              <Text style={styles.billDetailText}>View full receipt & tracking</Text>
              {order.status === 'DELIVERED' && order.rating && (
                <View style={styles.ratingInfoContainer}>
                  <View style={styles.ratingRow}>
                    {[1, 2, 3, 4, 5].map(s => (
                      <Ionicons key={s} name="star" size={14} color={s <= order.rating ? "#FFB74D" : "#E2E8F0"} style={{marginRight: 2}} />
                    ))}
                    <Text style={styles.ratingValueText}>{order.rating}.0</Text>
                  </View>
                  {order.rating_comment && (
                    <Text style={styles.ratingCommentSnippet} numberOfLines={1}>
                      "{order.rating_comment}"
                    </Text>
                  )}
                </View>
              )}
            </View>
            <View style={styles.priceRow}>
              <Text style={styles.totalLabel}>Total Bill</Text>
              <Text style={styles.totalPrice}>₹{order.total_amount}</Text>
            </View>
          </View>
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity 
            style={styles.trackActionBtn}
            onPress={() => navigation.navigate('OrderTracking', { orderId: order.id })}
          >
            <Text style={styles.trackActionText}>
              {order.status === 'DELIVERED' ? 'VIEW DETAILS' : 'TRACK ORDER'}
            </Text>
          </TouchableOpacity>
          {order.status === 'DELIVERED' && (
            <TouchableOpacity 
              style={styles.reorderActionBtn}
              onPress={() => handleReorder(order)}
            >
              <Text style={styles.reorderActionText}>REORDER</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF" />
      
      {/* Premium Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <Feather name="chevron-left" size={28} color="#111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Your Orders</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Filter & Search Bar */}
      <View style={styles.filterSection}>
        <View style={styles.searchContainer}>
          <Feather name="search" size={18} color="#94A3B8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search orders or bakery..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={styles.filterChipRow}
        >
          {FILTER_OPTIONS.map((filter) => (
            <TouchableOpacity
              key={filter.value}
              onPress={() => setActiveFilter(filter.value)}
              style={[
                styles.filterChip,
                activeFilter === filter.value && styles.activeFilterChip
              ]}
            >
              <Text style={[
                styles.filterChipText,
                activeFilter === filter.value && styles.activeFilterChipText
              ]}>
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={BRAND_GREEN} />
        </View>
      ) : (
        <ScrollView 
          style={styles.container} 
          contentContainerStyle={styles.scrollContent} 
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND_GREEN} />
          }
        >
          {filteredOrders.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="food-off" size={80} color="#DDD" />
              <Text style={styles.emptyTitle}>
                {searchQuery || activeFilter !== 'ALL' ? 'No matching orders' : 'No orders yet'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery || activeFilter !== 'ALL' 
                  ? 'Try adjusting your filters or search query.' 
                  : 'Hungry? Start exploring the best bakeries nearby!'}
              </Text>
              {!(searchQuery || activeFilter !== 'ALL') && (
                <TouchableOpacity 
                  style={styles.startShoppingBtn}
                  onPress={() => navigation.navigate('Home')}
                >
                  <Text style={styles.startShoppingText}>EXPLORE FOOD</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <>
              {liveOrders.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>LIVE TRACKING</Text>
                  {liveOrders.map(renderOrderCard)}
                </View>
              )}

              {pastOrders.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>ORDER HISTORY</Text>
                  {pastOrders.map(renderOrderCard)}
                </View>
              )}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFF',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backButton: {
    padding: 4,
    marginLeft: -4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111',
    letterSpacing: -0.5,
  },
  container: {
    flex: 1,
    backgroundColor: LIGHT_BG,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    marginTop: 20,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1.5,
    marginBottom: 12,
    marginLeft: 4,
  },
  orderCard: {
    backgroundColor: '#FFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
      },
      android: {
        elevation: 3,
      },
    }),
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  restaurantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  restaurantImage: {
    width: 48,
    height: 48,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
  },
  restaurantTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  restaurantName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 2,
    letterSpacing: -0.3,
  },
  orderTime: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 16,
  },
  cardBody: {
    marginBottom: 16,
  },
  orderDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  billDetailText: {
    fontSize: 13,
    color: BRAND_GREEN,
    fontWeight: '700',
  },
  priceRow: {
    alignItems: 'flex-end',
  },
  totalLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 2,
  },
  totalPrice: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1E293B',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 12,
  },
  trackActionBtn: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  trackActionText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '800',
  },
  reorderActionBtn: {
    flex: 1,
    backgroundColor: BRAND_GREEN,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
    shadowColor: BRAND_GREEN,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  reorderActionText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  ratingValueText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFB74D',
    marginLeft: 4,
  },
  ratingInfoContainer: {
    marginTop: 4,
  },
  ratingCommentSnippet: {
    fontSize: 12,
    color: '#64748B',
    fontStyle: 'italic',
    marginTop: 2,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    paddingTop: 100,
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1E293B',
    marginTop: 20,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 20,
    fontWeight: '500',
  },
  startShoppingBtn: {
    marginTop: 30,
    backgroundColor: BRAND_GREEN,
    paddingVertical: 14,
    paddingHorizontal: 35,
    borderRadius: 6,
  },
  startShoppingText: {
    color: '#FFF',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 1,
  },
  filterSection: {
    backgroundColor: '#FFF',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 12,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '600',
  },
  filterChipRow: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  activeFilterChip: {
    backgroundColor: '#F0FDF4',
    borderColor: BRAND_GREEN,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748B',
  },
  activeFilterChipText: {
    color: BRAND_GREEN,
  },
});

export default OrdersListScreen;
