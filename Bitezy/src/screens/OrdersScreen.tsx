import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Image, Platform, ActivityIndicator, Alert, Dimensions, TextInput } from 'react-native';
import { WebView } from 'react-native-webview';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useCart } from '../context/CartContext';
import { useAddress } from '../context/AddressContext';

// NOTE: Native Maps SDK is DISABLED in favor of Open-Source Leaflet (OSM).
const MapView: any = null;
const Marker: any = null;
const PROVIDER_GOOGLE: any = null;

// ─── Web Leaflet HTML for Tracking ──────────────────────────────────────────────
const buildTrackingLeafletHTML = (
  resLat: number, resLong: number,
  userLat: number, userLong: number,
  riderLat: number | null, riderLong: number | null,
  resName: string,
) => {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html,body,#map { width:100%; height:100%; background: #F8FAFC; }
  .marker-icon {
    width:32px; height:32px; border-radius:8px; 
    border:2px solid #FFF; display:flex; align-items:center; justify-content:center;
    box-shadow:0 4px 8px rgba(0,0,0,0.2); font-size: 16px;
  }
</style>
</head>
<body>
<div id="map"></div>
<script>
  var map = L.map('map', { zoomControl:false });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

  var resPos = [${resLat}, ${resLong}];
  var userPos = [${userLat}, ${userLong}];
  var points = [resPos, userPos];

  L.marker(resPos, { 
    icon: L.divIcon({ className:'', html:'<div class="marker-icon" style="background:#F57C00">🏠</div>', iconSize:[32,32], iconAnchor:[16,16]}) 
  }).addTo(map).bindPopup("${resName}");

  L.marker(userPos, { 
    icon: L.divIcon({ className:'', html:'<div class="marker-icon" style="background:#02844F">📍</div>', iconSize:[32,32], iconAnchor:[16,16]}) 
  }).addTo(map).bindPopup("DELIVERY ADDRESS");

  if (${riderLat !== null && riderLat !== undefined}) {
    var riderPos = [${riderLat}, ${riderLong}];
    points.push(riderPos);
    L.marker(riderPos, { 
      icon: L.divIcon({ className:'', html:'<div class="marker-icon" style="background:#02844F">🛵</div>', iconSize:[36,36], iconAnchor:[18,18]}) 
    }).addTo(map).bindPopup("DELIVERY PARTNER");
  }

  var bounds = L.latLngBounds(points);
  map.fitBounds(bounds, { padding: [50, 50] });
</script>
</body>
</html>`;
};

const UnifiedTrackingMap = ({ resLat, resLong, userLat, userLong, riderLat, riderLong, resName }: any) => {
  const html = useMemo(
    () => buildTrackingLeafletHTML(resLat, resLong, userLat, userLong, riderLat, riderLong, resName),
    [resLat, resLong, userLat, userLong, riderLat, riderLong, resName]
  );

  if (Platform.OS === 'web') {
    return (
      <iframe
        srcDoc={html}
        style={{ width: '100%', height: '100%', border: 'none' } as any}
        sandbox="allow-scripts allow-same-origin"
        title="Order Tracking Map"
      />
    );
  }

  return (
    <WebView
      originWhitelist={['*']}
      source={{ html }}
      style={{ flex: 1 }}
      javaScriptEnabled
      domStorageEnabled
    />
  );
};

const BRAND_GREEN = '#02844F'; 
const BRAND_ORANGE = '#F57C00';
const LIGHT_BG = '#F8FAFC';

const OrdersScreen = ({ route, navigation }: any) => {
  const { orderId } = route.params || {};
  const { reorderItems } = useCart();
  const { setSelectedAddress, addresses } = useAddress();
  const mapRef = useRef<any>(null);
  
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<any>(null);
  const [riderCoords, setRiderCoords] = useState<{lat: number, long: number} | null>(null);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [rating, setRating] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  const fetchOrderDetails = async (isPoll = false) => {
    if (!orderId) return;
    try {
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('*, restaurants(*), riders(*), addresses(*)')
        .eq('id', orderId)
        .single();
      if (orderError) throw orderError;
      setOrder(orderData);
      if (!isPoll) {
        setRating(orderData.rating || 0);
        setRatingComment(orderData.rating_comment || '');
        if (orderData.rating) setFeedbackSubmitted(true);
      }
      const { data: itemsData, error: itemsError } = await supabase
        .from('order_items')
        .select('*, items(name, price, image_url), combos(name, price, image_url)')
        .eq('order_id', orderId);
      if (itemsError) throw itemsError;
      setOrderItems(itemsData || []);
    } catch (err) { console.error('Error fetching order details:', err);
    } finally { if (!isPoll) setLoading(false); }
  };

  useEffect(() => {
    fetchOrderDetails();
    const interval = setInterval(() => fetchOrderDetails(true), 5000);
    // Main Order Subscription
    const subscription = supabase.channel(`order-${orderId}`).on('postgres_changes', { 
        event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}`
    }, (payload) => setOrder((prev: any) => ({ ...prev, ...payload.new }))).subscribe();

    // Rider Movement Subscription (Buttery Smooth)
    let riderSub: any;
    if (order?.rider_id) {
      riderSub = supabase.channel(`rider-move-${order.rider_id}`)
        .on('postgres_changes', { 
          event: 'UPDATE', schema: 'public', table: 'riders', filter: `id=eq.${order.rider_id}` 
        }, (payload) => {
          setRiderCoords({ lat: payload.new.lat, long: payload.new.long });
        }).subscribe();
    }

    return () => { 
      clearInterval(interval);
      supabase.removeChannel(subscription); 
      if (riderSub) supabase.removeChannel(riderSub);
    };
  }, [orderId, order?.rider_id]);

  useEffect(() => {
    if (Platform.OS !== 'web' && mapRef.current && order) {
        const coords = [
            { latitude: Number(order.restaurants?.lat), longitude: Number(order.restaurants?.long) },
            { latitude: Number(order.addresses?.lat), longitude: Number(order.addresses?.long) },
        ];
        // Allow rider marker in PREPARING (if assigned) or OUT_FOR_DELIVERY
        if ((order.status === 'PREPARING' || order.status === 'OUT_FOR_DELIVERY') && order.riders?.lat) {
            coords.push({ latitude: Number(order.riders.lat), longitude: Number(order.riders.long) });
        }
        mapRef.current.fitToCoordinates(coords, { edgePadding: { top: 50, right: 50, bottom: 50, left: 50 }, animated: true });
    }
  }, [order?.riders?.lat, order?.status]);

  const handleRating = async () => {
    if (isSubmittingRating || rating === 0) return;
    setIsSubmittingRating(true);
    try {
      const { error } = await supabase.from('orders').update({ rating, rating_comment: ratingComment }).eq('id', orderId);
      if (error) throw error;
      setFeedbackSubmitted(true);
      Alert.alert("SUCCESS", "THANKS FOR YOUR FEEDBACK!");
    } catch (err) { Alert.alert("ERROR", "FAILED TO SAVE RATING."); } finally { setIsSubmittingRating(false); }
  };

  const formattedDeliveryTime = useMemo(() => {
    if (!order || !order.delivered_at) return 'JUST NOW';
    return new Date(order.delivered_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }).toUpperCase();
  }, [order?.delivered_at]);

  if (loading) return (
    <View style={styles.loaderContainer}>
      <ActivityIndicator size="large" color={BRAND_GREEN} />
      <Text style={styles.loaderText}>TRACKING FOOD...</Text>
    </View>
  );

  if (!order) return (
    <View style={styles.loaderContainer}>
      <Ionicons name="alert-circle-outline" size={60} color="#666" />
      <Text style={styles.loaderText}>ORDER NOT FOUND</Text>
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}><Text style={styles.backBtnText}>GO BACK</Text></TouchableOpacity>
    </View>
  );

  const isDelivered = order.status === 'DELIVERED';
  const isCancelled = order.status === 'CANCELLED';

  const getETA = () => {
    if (!order || !order.estimated_arrival_at) return '--';
    
    const now = new Date();
    const arrival = new Date(order.estimated_arrival_at);
    const diffMs = arrival.getTime() - now.getTime();
    const diffMins = Math.ceil(diffMs / (1000 * 60));
    
    if (diffMins <= 1) return 'ARRIVING NOW';
    if (diffMins > 60) return '> 1 HOUR';
    return `${diffMins} MINS`;
  };

  const getStatusBannerText = () => {
    switch(order.status) {
        case 'PLACED': return 'ORDER PLACED! 📦';
        case 'ACCEPTED': return 'ORDER ACCEPTED! 👨‍🍳';
        case 'PREPARING': return 'CHEF IS PREPARING... 🥣';
        case 'READY': return 'FOOD IS READY! 🍩';
        case 'ON_THE_WAY': return 'ON THE WAY! 🛵';
        case 'ARRIVED': return 'RIDER HAS ARRIVED! 🏁';
        case 'DELIVERED': return 'DELIVERED SUCCESSFULLY! 🎉';
        case 'CANCELLED': return 'ORDER CANCELLED ❌';
        default: return 'YOUR ORDER IS IN PROGRESS';
    }
  };

  const getStatusSubText = () => {
    if (isDelivered) return `DELIVERED AT ${formattedDeliveryTime}`;
    if (isCancelled) return 'WE SINCERELY APOLOGIZE FOR THE INCONVENIENCE.';
    switch(order.status) {
        case 'PLACED': return 'RESTAURANT IS CONFIRMING...';
        case 'ACCEPTED': return 'RESTAURANT HAS ACCEPTED YOUR ORDER';
        case 'PREPARING': return 'CHEF IS CAREFULLY PREPARING YOUR MEAL';
        case 'READY': return 'RIDER IS AT THE BAKERY TO PICK UP';
        case 'ON_THE_WAY': return 'RIDER IS DASHING TO YOUR DOOR';
        case 'ARRIVED': return 'RIDER IS AT YOUR LOCATION AND WALKING TO YOU';
        case 'DELIVERED': return `DELIVERED SUCCESSFULLY AT ${formattedDeliveryTime}`;
        default: return `EXPECTED ARRIVAL: ${getETA()}`;
    }
  };

  const renderTimeline = () => {
    const steps = [
      { key: 'PLACED', label: 'ORDER PLACED', time: order.created_at },
      { key: 'ACCEPTED', label: 'ORDER ACCEPTED', time: order.accepted_at },
      { key: 'PREPARING', label: 'PREPARING', time: order.prep_started_at },
      { key: 'READY', label: 'READY FOR PICKUP', time: order.prep_completed_at },
      { key: 'ON_THE_WAY', label: 'OUT FOR DELIVERY', time: order.picked_up_at },
      { key: 'ARRIVED', label: 'RIDER ARRIVED', time: order.arrived_at },
      { key: 'DELIVERED', label: 'DELIVERED', time: order.delivered_at },
    ];

    const currentIdx = steps.findIndex(s => s.key === order.status);

    return (
      <View style={styles.timelineCard}>
        <Text style={styles.sectionTitle}>ORDER JOURNEY</Text>
        {steps.map((step, idx) => {
          const isDone = !!step.time;
          const isCurrent = step.key === order.status;
          const timeStr = step.time ? new Date(step.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : null;

          return (
            <View key={idx} style={styles.timelineItem}>
              <View style={styles.timelineLeft}>
                <View style={[styles.timelineDot, isDone && styles.dotDone, isCurrent && styles.dotCurrent]} />
                {idx < steps.length - 1 && <View style={[styles.timelineLine, isDone && styles.lineDone]} />}
              </View>
              <View style={styles.timelineRight}>
                <Text style={[styles.timelineLabel, isDone && styles.textDone, isCurrent && styles.textCurrent]}>
                  {step.label}
                </Text>
                {timeStr && <Text style={styles.timelineTime}>{timeStr}</Text>}
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  const showRiderDetails = order.riders && order.status !== 'PLACED' && !isCancelled;
  // Use riderCoords if available (from separate subscription) or order.riders
  const currentRiderLat = riderCoords?.lat || order.riders?.lat;
  const currentRiderLong = riderCoords?.long || order.riders?.long;
  const showRiderMarker = currentRiderLat && order.status !== 'PLACED' && !isCancelled;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBack} onPress={() => navigation.goBack()}><Ionicons name="chevron-back" size={28} color="#111" /></TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>{isDelivered ? 'ORDER DELIVERED' : (isCancelled ? 'ORDER CANCELLED' : 'LIVE TRACKING')}</Text>
          <Text style={styles.orderIdText}>ID: #{order.id.slice(0, 8).toUpperCase()}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Status Timeline */}
        <View style={[styles.statusBanner, isCancelled && { borderColor: '#FFEBEE', backgroundColor: '#FFF' }]}>
           <View style={styles.statusHeaderRow}>
             <View style={{ flex: 1 }}>
               <Text style={[styles.statusLargeText, isCancelled && { color: '#C62828' }]}>{getStatusBannerText().toUpperCase()}</Text>
               <Text style={styles.statusSubText}>{getStatusSubText().toUpperCase()}</Text>
             </View>
             <MaterialCommunityIcons 
                name={isDelivered ? "check-decagram" : (isCancelled ? "close-circle" : (order.status === 'PREPARING' ? "chef-hat" : "moped"))} 
                size={40} color={isCancelled ? '#C62828' : BRAND_GREEN} 
             />
           </View>
           
           {!isDelivered && !isCancelled && (
             <View style={styles.topEtaBadge}>
                <Ionicons name="time-outline" size={16} color="#FFF" style={{ marginRight: 6 }} />
                <Text style={styles.topEtaText}>ARRIVING IN {getETA()}</Text>
             </View>
           )}
        </View>

        {/* Live Map or Rating Card */}
        {!isCancelled && (
          <View style={isDelivered ? styles.visualContainerDelivered : styles.visualContainer}>
            {!isDelivered ? (
              <View style={styles.mapWrapper}>
                <UnifiedTrackingMap 
                  resLat={order.restaurants?.lat} resLong={order.restaurants?.long}
                  userLat={order.addresses?.lat} userLong={order.addresses?.long}
                  riderLat={showRiderMarker ? currentRiderLat : null}
                  riderLong={showRiderMarker ? currentRiderLong : null}
                  resName={order.restaurants?.name}
                />
              </View>
            ) : (
              <View style={styles.ratingCard}>
                <Text style={styles.ratingMsg}>HOW WAS THE FOOD FROM {order.restaurants?.name?.toUpperCase()}?</Text>
                {!feedbackSubmitted ? (
                  <>
                    <View style={styles.starsRow}>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <TouchableOpacity key={s} onPress={() => setRating(s)} disabled={isSubmittingRating}>
                          <Ionicons name={s <= rating ? "star" : "star-outline"} size={32} color={s <= rating ? "#FFB74D" : "#E2E8F0"} style={{ marginHorizontal: 4 }} />
                        </TouchableOpacity>
                      ))}
                    </View>
                    <TextInput style={styles.ratingInput} placeholder="ADD A COMMENT (OPTIONAL)..." placeholderTextColor="#94A3B8" value={ratingComment} onChangeText={setRatingComment} multiline />
                    <TouchableOpacity style={[styles.submitRatingBtn, rating === 0 && { opacity: 0.5 }]} onPress={handleRating} disabled={isSubmittingRating || rating === 0}>
                      {isSubmittingRating ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.submitRatingText}>SUBMIT FEEDBACK</Text>}
                    </TouchableOpacity>
                  </>
                ) : (
                  <View style={styles.submittedContainer}><Ionicons name="checkmark-circle" size={40} color={BRAND_GREEN} />
                    <Text style={styles.submittedText}>RATING SAVED!</Text>
                    <View style={styles.starsRowSmall}>{[1, 2, 3, 4, 5].map((s) => (
                        <Ionicons key={s} name={s <= rating ? "star" : "star-outline"} size={16} color={s <= rating ? "#FFB74D" : "#E2E8F0"} style={{ marginHorizontal: 2 }} />
                      ))}</View></View>
                )}
              </View>
            )}
          </View>
        )}

        {/* Delivery Partner Container */}
        {!isDelivered && !isCancelled && (
          <View style={styles.partnerCard}>
            <Text style={styles.sectionTitle}>DELIVERY PARTNER</Text>
            {showRiderDetails ? (
              <View style={styles.partnerInfoRow}>
                <Image 
                    source={{ uri: 'https://images.unsplash.com/photo-1542909168-82c3e7fdca5c?w=200' }} 
                    style={styles.partnerAvatar} 
                />
                <View style={styles.partnerDetails}>
                  <Text style={styles.partnerName}>{order.riders?.name?.toUpperCase() || 'RAMESH'}</Text>
                  <Text style={styles.vehicleType}>BITEZY HERO · {order.riders?.vehicle_number?.toUpperCase() || 'DL 3C 4532'}</Text>
                </View>
                <TouchableOpacity style={styles.callBtn}><Feather name="phone" size={20} color={BRAND_GREEN} /></TouchableOpacity>
              </View>
            ) : (
              <View style={styles.unassignedContainer}>
                <MaterialCommunityIcons name="account-clock" size={24} color={BRAND_GREEN} style={{ marginRight: 10 }} />
                <Text style={styles.unassignedText}>DELIVERY RIDER WILL BE ASSIGNED SOON</Text>
              </View>
            )}
          </View>
        )}

        {/* Order Timeline */}
        {renderTimeline()}

        {/* Order Items Section */}
        <View style={styles.detailsContainer}>
          <View style={styles.detailsHeader}>
            <Text style={styles.detailsTitle}>BILL DETAILS & ITEMS</Text>
          </View>
          <View style={styles.detailsBody}>
             {orderItems.map((item, idx) => (
               <View key={idx} style={styles.billItem}>
                  <Text style={styles.billQty}>{item.quantity} X</Text>
                  <Text style={styles.billName}>{(item.items?.name || item.combos?.name)?.toUpperCase()}</Text>
                  <Text style={styles.billPrice}>₹{item.price * item.quantity}</Text>
               </View>
             ))}
             <View style={styles.billDivider} />
             <View style={styles.billTotalRow}>
                <Text style={styles.billTotalLabel}>
                  {order.payment_mode === 'COD' ? 'TOTAL PAYABLE' : 'TOTAL PAID'} ({order.payment_mode})
                </Text>
                <Text style={styles.billTotalPrice}>₹{order.total_amount}</Text>
             </View>
          </View>
        </View>

        {isDelivered && (
          <TouchableOpacity style={styles.reorderBtnMain} onPress={() => {
              const originalAddress = addresses.find(a => a.id === order.address_id) || order.addresses;
              if (originalAddress) setSelectedAddress(originalAddress);
              reorderItems(orderItems, order.restaurant_id).then(() => navigation.navigate('Cart'));
          }} activeOpacity={0.8}>
            <Text style={styles.reorderBtnTextMain}>REORDER THIS MEAL</Text>
            <Ionicons name="chevron-forward" size={18} color="#FFF" />
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff', paddingTop: Platform.OS === 'android' ? 35 : 0 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1.5, borderBottomColor: '#F1F5F9' },
  headerBack: { padding: 4, marginLeft: -8 },
  headerContent: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '900', color: '#1E293B', letterSpacing: 0.5 },
  orderIdText: { fontSize: 11, color: '#94A3B8', fontWeight: '900', textTransform: 'uppercase', marginTop: 1 },
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollContent: { paddingBottom: 40 },
  statusBanner: {
    backgroundColor: '#FFF', padding: 18, borderBottomLeftRadius: 12, borderBottomRightRadius: 12,
    borderWidth: 1.5, borderColor: '#F1F5F9', marginBottom: 16, elevation: 2,
  },
  statusHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusLargeText: { fontSize: 17, fontWeight: '900', color: '#1E293B', marginBottom: 2 },
  statusSubText: { fontSize: 12, color: '#64748B', fontWeight: '800' },
  topEtaBadge: {
    backgroundColor: BRAND_GREEN, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    marginTop: 12, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6,
  },
  topEtaText: { color: '#FFF', fontSize: 12, fontWeight: '900' },
  visualContainer: {
    marginHorizontal: 16, marginBottom: 16, height: 280, borderRadius: 12, overflow: 'hidden',
    backgroundColor: '#FFF', borderWidth: 1.5, borderColor: '#F1F5F9', elevation: 4,
    ...Platform.select({ web: { height: 400 } }),
  },
  visualContainerDelivered: {
    marginHorizontal: 16, marginBottom: 16, backgroundColor: '#FFF', borderRadius: 12, padding: 20,
    borderWidth: 1.5, borderColor: '#F1F5F9', elevation: 3,
  },
  mapWrapper: { flex: 1 },
  map: { width: '100%', height: '100%' },
  markerContainer: { padding: 4, backgroundColor: '#FFF', borderRadius: 8, elevation: 4 },
  markerIcon: { width: 28, height: 28, borderRadius: 5, justifyContent: 'center', alignItems: 'center' },
  riderMarkerWrapper: { padding: 4, backgroundColor: '#FFF', borderRadius: 8, elevation: 8 },
  riderMarker: { width: 36, height: 36, borderRadius: 6, backgroundColor: BRAND_GREEN, justifyContent: 'center', alignItems: 'center' },
  ratingCard: { justifyContent: 'center', alignItems: 'center' },
  ratingMsg: { fontSize: 16, fontWeight: '900', color: '#1E293B', textAlign: 'center', marginBottom: 15 },
  starsRow: { flexDirection: 'row', marginBottom: 15 },
  starsRowSmall: { flexDirection: 'row', marginTop: 8 },
  ratingInput: {
    width: '100%', backgroundColor: '#F8FAFC', borderRadius: 10, padding: 12, color: '#1E293B', fontSize: 14, minHeight: 70,
    textAlignVertical: 'top', marginBottom: 15, borderWidth: 1, borderColor: '#E2E8F0',
  },
  submitRatingBtn: { backgroundColor: BRAND_GREEN, paddingVertical: 12, borderRadius: 10, width: '100%', alignItems: 'center' },
  submitRatingText: { color: '#FFF', fontWeight: '900', fontSize: 13, letterSpacing: 0.5 },
  submittedContainer: { alignItems: 'center', paddingVertical: 10 },
  submittedText: { fontSize: 14, fontWeight: '900', color: BRAND_GREEN, marginTop: 8 },
  partnerCard: {
    backgroundColor: '#FFF', marginHorizontal: 16, padding: 16, borderRadius: 12, marginBottom: 16,
    borderWidth: 1.5, borderColor: '#F1F5F9',
  },
  sectionTitle: { fontSize: 10, fontWeight: '900', color: '#94A3B8', letterSpacing: 1.2, marginBottom: 10 },
  partnerInfoRow: { flexDirection: 'row', alignItems: 'center' },
  timelineCard: {
    backgroundColor: '#FFF', marginHorizontal: 16, padding: 16, borderRadius: 12, marginBottom: 16,
    borderWidth: 1.5, borderColor: '#F1F5F9',
  },
  timelineItem: { flexDirection: 'row', minHeight: 45 },
  timelineLeft: { width: 30, alignItems: 'center' },
  timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#E2E8F0', marginTop: 6, zIndex: 2 },
  dotDone: { backgroundColor: BRAND_GREEN },
  dotCurrent: { backgroundColor: BRAND_GREEN, borderWidth: 2, borderColor: '#FFF', elevation: 4 },
  timelineLine: { width: 2, flex: 1, backgroundColor: '#F1F5F9', marginVertical: -2 },
  lineDone: { backgroundColor: BRAND_GREEN },
  timelineRight: { flex: 1, paddingLeft: 10, paddingBottom: 15 },
  timelineLabel: { fontSize: 13, fontWeight: '800', color: '#94A3B8' },
  textDone: { color: '#1E293B' },
  textCurrent: { color: BRAND_GREEN, fontWeight: '900' },
  timelineTime: { fontSize: 10, fontWeight: '700', color: '#64748B', marginTop: 2 },
  partnerAvatar: { width: 42, height: 42, borderRadius: 8, backgroundColor: '#F1F5F9' },
  partnerDetails: { flex: 1, marginLeft: 12 },
  partnerName: { fontSize: 14, fontWeight: '900', color: '#1E293B' },
  vehicleType: { fontSize: 11, color: BRAND_GREEN, fontWeight: '900', marginTop: 1 },
  callBtn: { width: 36, height: 36, borderRadius: 8, backgroundColor: '#F0F9F3', justifyContent: 'center', alignItems: 'center' },
  unassignedContainer: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  unassignedText: { fontSize: 12, fontWeight: '900', color: BRAND_GREEN, letterSpacing: 0.2 },
  detailsContainer: {
    backgroundColor: '#FFF', marginHorizontal: 16, borderRadius: 12, overflow: 'hidden', marginBottom: 16,
    borderWidth: 1.5, borderColor: '#F1F5F9',
  },
  detailsHeader: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  detailsTitle: { fontSize: 13, fontWeight: '900', color: '#1E293B', letterSpacing: 0.5 },
  detailsBody: { padding: 16 },
  billItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  billQty: { width: 25, fontSize: 12, color: '#64748B', fontWeight: '900' },
  billName: { flex: 1, fontSize: 13, color: '#1E293B', fontWeight: '800' },
  billPrice: { fontSize: 13, color: '#1E293B', fontWeight: '900' },
  billDivider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 10 },
  billTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  billTotalLabel: { fontSize: 12, fontWeight: '900', color: '#64748B' },
  billTotalPrice: { fontSize: 16, fontWeight: '900', color: '#1E293B' },
  reorderBtnMain: { backgroundColor: BRAND_GREEN, marginHorizontal: 16, height: 52, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  reorderBtnTextMain: { color: '#FFF', fontSize: 14, fontWeight: '900', letterSpacing: 1 },
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF' },
  loaderText: { marginTop: 15, fontSize: 14, color: '#64748B', fontWeight: '900' },
  backBtn: { marginTop: 20, paddingHorizontal: 30, paddingVertical: 12, backgroundColor: BRAND_GREEN, borderRadius: 10 },
  backBtnText: { color: '#FFF', fontWeight: '900', fontSize: 14 },
  noMapFallback: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F1F5F9' },
  noMapText: { marginTop: 12, fontSize: 12, fontWeight: '900', color: '#94A3B8' },
});

export default OrdersScreen;