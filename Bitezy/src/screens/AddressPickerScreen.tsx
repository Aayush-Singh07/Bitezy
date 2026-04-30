/**
 * AddressPickerScreen.tsx — Bitezy Premium Edition v3
 *
 * Changes from v2:
 *  1. Location permission gate — shows "PLEASE ALLOW LOCATION ACCESS" if denied
 *  2. Default map center = user's GPS (not Rashtrapati Bhawan)
 *  3. Zone check ONLY on regionChangeComplete — eliminates pin/text blinking
 *  4. "WE ARE NOT HERE YET" instead of "Outside delivery zone" (premium brand tone)
 *  5. Selected address becomes default; others become non-default via updateAddress
 *  6. Bolder, boxier, more uppercase UI throughout — no curvy cheap aesthetics
 */

import React, {
  useEffect, useRef, useState, useCallback, useMemo,
} from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal,
  ActivityIndicator, Alert, TextInput, Animated,
  Dimensions, ScrollView, Pressable, SafeAreaView,
  Platform, KeyboardAvoidingView, StatusBar,
} from 'react-native';
import * as Location from 'expo-location';
import { WebView } from 'react-native-webview';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAddress, Address } from '../context/AddressContext';
import { useRestaurant, DELIVERY_RADIUS_METERS } from '../context/RestaurantContext';
import { getDistanceMeters } from '../lib/distance';

// ─── Constants ────────────────────────────────────────────────────────────────
const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
const BRAND_GREEN = '#02844F';
const BRAND_DARK = '#01603A';
const LIGHT_GREEN = '#E8F5EF';
const ACCENT_GREEN = '#05C46B';

// Bottom card height ranges
const CARD_PEEK = 220;
const CARD_FULL = SCREEN_HEIGHT * 0.75;

// Fallback center — geometric center of India (neutral, not Rashtrapati Bhawan)
// Will be replaced immediately by GPS on mount
const INDIA_CENTER = { latitude: 20.5937, longitude: 78.9629 };

// NOTE: Native Maps SDK is DISABLED in favor of Open-Source Leaflet (OSM).
const MapView: any = null;
const PROVIDER_GOOGLE: any = null;

// ─── Types ────────────────────────────────────────────────────────────────────
interface AddressPickerProps {
  visible?: boolean;
  onClose?: () => void;
  navigation?: any;
}
type Step = 'list' | 'map';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getLabelIcon = (label: string): string => {
  const l = (label || '').toLowerCase();
  if (l.includes('home')) return 'home';
  if (l.includes('work')) return 'briefcase';
  if (l.includes('hotel')) return 'book-open';
  return 'map-pin';
};

const buildLine = (
  flat: string, floor: string, building: string,
  landmark: string, geocoded: string,
): string =>
  [flat, floor ? `Floor ${floor}` : '', building, landmark ? `Near ${landmark}` : '', geocoded]
    .filter(Boolean).join(', ');

// ─── Leaflet HTML for web map ─────────────────────────────────────────────────
// NOTE: Zone check is ONLY sent on 'moveend' (not 'move') to prevent blinking
const buildLeafletHTML = (
  lat: number, lng: number,
  restaurants: Array<{ lat: number; long: number; name?: string }>,
  radiusMeters: number,
) => `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html,body,#map { width:100%; height:100%; }
  .pin-center {
    position:absolute; left:50%; top:50%;
    transform:translate(-50%,-100%);
    pointer-events:none; z-index:1000;
  }
  .pin-box {
    width:40px; height:40px; background:#02844F;
    border:3px solid #FFF; display:flex; align-items:center; justify-content:center;
    box-shadow:0 8px 16px rgba(0,0,0,0.3);
  }
  .pin-inner { width:16px; height:16px; background:#FFF; }
  .pin-stem { width:3px; height:12px; background:#02844F; margin:0 auto; transform:translateY(-1px); }
  .pin-shadow { width:16px; height:6px; background:rgba(0,0,0,0.2); margin:0 auto; margin-top:-2px; }
  .store-badge {
    background:#111; color:#fff; border:1px solid #fff;
    padding:4px 8px; font-size:11px; font-weight:900;
    text-transform:uppercase; white-space:nowrap;
  }
</style>
</head>
<body>
<div id="map"></div>
<div class="pin-center">
  <div class="pin-box"><div class="pin-inner"></div></div>
  <div class="pin-stem"></div>
  <div class="pin-shadow"></div>
</div>
<script>
  var map = L.map('map', { zoomControl:false }).setView([${lat}, ${lng}], 16);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution:'', maxZoom:19
  }).addTo(map);

  var RADIUS = ${radiusMeters};
  var restaurants = ${JSON.stringify(restaurants)};

  restaurants.forEach(function(r) {
    L.circle([r.lat, r.long], {
      radius: RADIUS, color:'#02844F', weight:2,
      fillColor:'#02844F', fillOpacity:0.07
    }).addTo(map);
    var storeIcon = L.divIcon({
      className:'',
      html:'<div class="store-badge">' + (r.name || 'Bitezy') + '</div>',
      iconSize:[80,28], iconAnchor:[40,28]
    });
    L.marker([r.lat, r.long], { icon: storeIcon }).addTo(map);
  });

  function checkZone(lat, lng) {
    var inZone = restaurants.some(function(r) {
      var dx = lat - r.lat, dy = lng - r.long;
      return Math.sqrt(dx*dx + dy*dy) * 111320 <= RADIUS;
    });
    sendMsg({ type:'regionChange', lat:lat, lng:lng, inZone:inZone });
    
    // Initial and subsequent geocoding
    fetch('https://nominatim.openstreetmap.org/reverse?lat=' + lat + '&lon=' + lng + '&format=json')
      .then(function(r){ return r.json(); })
      .then(function(d){
        var addr = d.address || {};
        var line = [addr.road, addr.suburb || addr.neighbourhood, addr.city || addr.town].filter(Boolean).join(', ');
        sendMsg({ type:'geocode', address:line, lat:lat, lng:lng });
      }).catch(function(){});
  }

  function sendMsg(obj) {
    var msg = JSON.stringify(obj);
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(msg);
    else if (window.parent !== window) window.parent.postMessage(msg, '*');
  }

  // ── Only check zone on moveend (not every move frame) to prevent blinking ──
  map.on('moveend', function() {
    var c = map.getCenter();
    checkZone(c.lat, c.lng);
    fetch('https://nominatim.openstreetmap.org/reverse?lat=' + c.lat + '&lon=' + c.lng + '&format=json')
      .then(function(r){ return r.json(); })
      .then(function(d){
        var addr = d.address || {};
        var line = [addr.road, addr.suburb, addr.city || addr.town].filter(Boolean).join(', ');
        sendMsg({ type:'geocode', address:line, lat:c.lat, lng:c.lng });
      }).catch(function(){});
  });

  // Initial zone check
  checkZone(${lat}, ${lng});

  // Listen for recenter command from RN
  window.addEventListener('message', function(e){
    try {
      var d = JSON.parse(e.data);
      if (d.type === 'recenter') map.setView([d.lat, d.lng], 16);
    } catch(_){}
  });
</script>
</body>
</html>`;

// ─────────────────────────────────────────────────────────────────────────────
// Web map component using iframe
// ─────────────────────────────────────────────────────────────────────────────
const UnifiedLeafletMap = ({
  lat, lng, restaurants, radiusMeters, onLocationChange, iframeRef,
}: {
  lat: number; lng: number;
  restaurants: any[];
  radiusMeters: number;
  onLocationChange: (lat: number, lng: number, address: string, inZone: boolean) => void;
  iframeRef: React.RefObject<any>;
}) => {
  const html = useMemo(
    () => buildLeafletHTML(lat, lng, restaurants, radiusMeters),
    [lat, lng, restaurants, radiusMeters],
  );

  useEffect(() => {
    if (Platform.OS !== 'web') return; // Handled via postMessage on native

    const handler = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'regionChange') {
          onLocationChange(data.lat, data.lng, '', data.inZone);
        } else if (data.type === 'geocode') {
          onLocationChange(data.lat, data.lng, data.address, true);
        }
      } catch (_) { }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onLocationChange]);

  if (Platform.OS === 'web') {
    return (
      <iframe
        ref={iframeRef}
        srcDoc={html}
        style={{ width: '100%', height: '100%', border: 'none' } as any}
        sandbox="allow-scripts allow-same-origin"
        title="Address Map"
      />
    );
  }

  return (
    <WebView
      ref={iframeRef}
      originWhitelist={['*']}
      source={{ html }}
      style={{ flex: 1 }}
      onMessage={(event) => {
        try {
          const data = JSON.parse(event.nativeEvent.data);
          if (data.type === 'regionChange') {
            onLocationChange(data.lat, data.lng, '', data.inZone);
          } else if (data.type === 'geocode') {
            onLocationChange(data.lat, data.lng, data.address, true);
          }
        } catch (_) { }
      }}
      javaScriptEnabled
      domStorageEnabled
    />
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Address List Sheet  (Step 1)
// ─────────────────────────────────────────────────────────────────────────────
const AddressListSheet = ({
  savedAddresses, onSelectAddress, onAddNew,
  onEditAddress, onDeleteAddress, selectedAddress,
}: any) => {
  const slideY = useRef(new Animated.Value(60)).current;
  const alpha = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideY, { toValue: 0, friction: 8, tension: 70, useNativeDriver: true }),
      Animated.timing(alpha, { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[styles.listSheet, { opacity: alpha, transform: [{ translateY: slideY }] }]}>
      {/* Pill handle */}
      <View style={styles.pillHandle} />

      {/* Header */}
      <View style={styles.listHeader}>
        <View style={styles.listHeaderLeft}>
          <View style={styles.headerIconBox}>
            <MaterialCommunityIcons name="map-marker-radius" size={18} color={BRAND_GREEN} />
          </View>
          <View>
            <Text style={styles.listHeaderTitle}>DELIVER TO</Text>
            <Text style={styles.listHeaderSub}>CHOOSE OR ADD AN ADDRESS</Text>
          </View>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        bounces={false}
        contentContainerStyle={styles.listScroll}
      >
        {/* Add new CTA */}
        <TouchableOpacity style={styles.addNewCard} onPress={onAddNew} activeOpacity={0.8}>
          <View style={styles.addNewIconBox}>
            <Feather name="map-pin" size={18} color={BRAND_GREEN} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.addNewTitle}>ADD NEW ADDRESS</Text>
            <Text style={styles.addNewSub}>PIN ON MAP & SAVE DETAILS</Text>
          </View>
          <View style={styles.addNewChevron}>
            <Feather name="chevron-right" size={16} color={BRAND_GREEN} />
          </View>
        </TouchableOpacity>

        {/* Saved addresses */}
        {savedAddresses.length > 0 && (
          <>
            <View style={styles.sectionRow}>
              <View style={styles.sectionLine} />
              <Text style={styles.sectionLabel}>SAVED ADDRESSES</Text>
              <View style={styles.sectionLine} />
            </View>
            {savedAddresses.map((addr: Address, idx: number) => {
              const isSelected = selectedAddress?.id === addr.id || addr.is_default;
              return (
                <TouchableOpacity
                  key={addr.id || idx}
                  style={[styles.addrCard, isSelected && styles.addrCardSelected]}
                  onPress={() => onSelectAddress(addr)}
                  activeOpacity={0.78}
                >
                  <View style={[styles.addrIconBox, isSelected && styles.addrIconBoxSelected]}>
                    <Feather name={getLabelIcon(addr.label || '') as any} size={20} color={isSelected ? '#FFF' : BRAND_GREEN} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <Text style={[styles.addrLabel, isSelected && styles.addrLabelSelected]}>
                        {(addr.label || 'ADDRESS').toUpperCase()}
                      </Text>
                      {isSelected && (
                        <View style={styles.defaultBadge}>
                          <Text style={styles.defaultBadgeText}>DEFAULT</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.addrLine} numberOfLines={2}>{addr.address_line}</Text>
                  </View>
                  <View style={styles.addrActions}>
                    <TouchableOpacity
                      onPress={() => onEditAddress(addr)}
                      style={styles.addrActionBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Feather name="edit-2" size={13} color={BRAND_GREEN} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => onDeleteAddress(addr)}
                      style={[styles.addrActionBtn, styles.addrDeleteBtn]}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Feather name="trash-2" size={13} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })}
          </>
        )}

        {/* Empty state */}
        {savedAddresses.length === 0 && (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIconBox}>
              <Feather name="map" size={42} color="#DDD" />
            </View>
            <Text style={styles.emptyTitle}>NO SAVED ADDRESSES</Text>
            <Text style={styles.emptySub}>ADD YOUR FIRST DELIVERY ADDRESS TO GET STARTED</Text>
          </View>
        )}
      </ScrollView>
    </Animated.View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Location Permission Gate
// ─────────────────────────────────────────────────────────────────────────────
const LocationPermissionGate = ({ onGranted }: { onGranted: () => void }) => (
  <View style={styles.permGate}>
    <View style={styles.permIconBox}>
      <MaterialCommunityIcons name="map-marker-off" size={40} color={BRAND_GREEN} />
    </View>
    <Text style={styles.permTitle}>LOCATION ACCESS NEEDED</Text>
    <Text style={styles.permSub}>
      PLEASE ALLOW LOCATION ACCESS{'\n'}SO WE CAN PIN YOU ON THE MAP
    </Text>
    <TouchableOpacity style={styles.permBtn} onPress={onGranted} activeOpacity={0.85}>
      <Ionicons name="navigate" size={16} color="#FFF" style={{ marginRight: 8 }} />
      <Text style={styles.permBtnText}>ALLOW LOCATION ACCESS</Text>
    </TouchableOpacity>
  </View>
);

// ─────────────────────────────────────────────────────────────────────────────
// Map Address Picker  (Step 2)
// ─────────────────────────────────────────────────────────────────────────────
const MapAddressPicker = ({
  allRestaurants, saveAddress, updateAddress,
  setNearestRestaurant, onBack, onSaved, editingAddress,
}: any) => {
  const isEditing = !!editingAddress;

  // Start at a neutral point — GPS will override immediately in initGPS()
  const [region, setRegion] = useState({
    latitude: editingAddress?.lat ?? INDIA_CENTER.latitude,
    longitude: editingAddress?.long ?? INDIA_CENTER.longitude,
    latitudeDelta: 0.005,
    longitudeDelta: 0.005,
  });

  // Permission state
  const [locationPermission, setLocationPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [gpsResolved, setGpsResolved] = useState(isEditing);

  // Form fields
  const [flatNo, setFlatNo] = useState('');
  const [floorNo, setFloorNo] = useState('');
  const [building, setBuilding] = useState('');
  const [landmark, setLandmark] = useState('');
  const [label, setLabel] = useState(editingAddress?.label || 'Home');
  const [customLabel, setCustomLabel] = useState('');
  const [geocoded, setGeocoded] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [outOfRange, setOutOfRange] = useState(false);
  const [nearestRes, setNearestRes] = useState<any>(null);

  const cardAnim = useRef(new Animated.Value(CARD_PEEK)).current;
  const [expanded, setExpanded] = useState(false);
  const pinY = useRef(new Animated.Value(0)).current;
  const mapRef = useRef<any>(null);
  const iframeRef = useRef<any>(null);

  // Track whether a region change is in progress (for pin animation only)
  const isDragging = useRef(false);

  useEffect(() => {
    if (isEditing) {
      setLocationPermission('granted'); // editing doesn't need new GPS
      updateLocationData(editingAddress.lat, editingAddress.long);
    } else {
      initGPS();
    }
  }, []);

  const animateCard = (toFull: boolean) => {
    Animated.spring(cardAnim, {
      toValue: toFull ? CARD_FULL : CARD_PEEK,
      friction: 9, tension: 80, useNativeDriver: false,
    }).start();
    setExpanded(toFull);
  };

  /**
   * Request location permission and move map to user's actual GPS position.
   * Shows the permission gate if denied.
   */
  const initGPS = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setLocationPermission('denied');
      return;
    }
    setLocationPermission('granted');
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = loc.coords;
      const newRegion = { latitude, longitude, latitudeDelta: 0.005, longitudeDelta: 0.005 };
      setRegion(newRegion);
      mapRef.current?.animateToRegion(newRegion, 300);
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({ type: 'recenter', lat: latitude, lng: longitude }), '*',
        );
      }
      await updateLocationData(latitude, longitude);
      setGpsResolved(true);
    } catch (_) { 
      setGpsResolved(true); // show map even if geocode fails
    }
  };

  /**
   * Geocode + zone-check for a coordinate.
   * Called ONLY on drag-end (regionChangeComplete), NOT during drag, to prevent blinking.
   */
  const updateLocationData = useCallback(async (lat: number, lng: number) => {
    setIsGeocoding(true);
    const nearest = allRestaurants.find((r: any) =>
      getDistanceMeters(lat, lng, r.lat, r.long) <= DELIVERY_RADIUS_METERS,
    );
    setNearestRes(nearest || null);
    setOutOfRange(!nearest);
    try {
      const geo = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (geo[0]) {
        const g = geo[0];
        const addr = [g.street, g.district || g.subregion, g.city].filter(Boolean).join(', ');
        setGeocoded(addr || 'LOCATION PINNED');
      }
    } catch (_) { }
    setIsGeocoding(false);
  }, [allRestaurants]);

  // Web message handler — only geocode messages update text (zone already stable)
  const handleWebMessage = useCallback((lat: number, lng: number, address: string, inZone: boolean) => {
    setRegion(r => ({ ...r, latitude: lat, longitude: lng }));
    setOutOfRange(!inZone);
    const nearest = allRestaurants.find((r: any) =>
      getDistanceMeters(lat, lng, r.lat, r.long) <= DELIVERY_RADIUS_METERS,
    );
    setNearestRes(nearest || null);
    if (address) setGeocoded(address);
  }, [allRestaurants]);

  // Pin lifts on drag start — NO data update here
  const onRegionChange = () => {
    if (!isDragging.current) {
      isDragging.current = true;
      Animated.timing(pinY, { toValue: -14, duration: 120, useNativeDriver: true }).start();
    }
  };

  // Pin drops on drag end — update data ONCE
  const onRegionChangeComplete = (r: any) => {
    isDragging.current = false;
    setRegion(r);
    updateLocationData(r.latitude, r.longitude);
    Animated.spring(pinY, { toValue: 0, friction: 5, tension: 120, useNativeDriver: true }).start();
  };

  const recenterGPS = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setLocationPermission('denied');
      return;
    }
    setLocationPermission('granted');
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = loc.coords;
      const r = { latitude, longitude, latitudeDelta: 0.005, longitudeDelta: 0.005 };
      mapRef.current?.animateToRegion(r, 400);
      setRegion(r);
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({ type: 'recenter', lat: latitude, lng: longitude }), '*',
        );
      }
      updateLocationData(latitude, longitude);
    } catch (_) { }
  };

  const handleSave = async () => {
    if (outOfRange) {
      Alert.alert('WE ARE NOT HERE YET', 'Move the pin inside the green zone to continue.', [{ text: 'GOT IT' }]);
      return;
    }
    if (!flatNo.trim() && !building.trim()) {
      Alert.alert('ALMOST THERE', 'Please enter your Flat No. or Building name.');
      return;
    }
    setIsSaving(true);
    const finalLabel = label === 'Other' ? (customLabel.trim() || 'Other') : label;
    const fullLine = buildLine(flatNo, floorNo, building, landmark, geocoded);
    try {
      if (isEditing && editingAddress?.id) {
        await updateAddress(editingAddress.id, {
          label: finalLabel, address_line: fullLine,
          lat: region.latitude, long: region.longitude,
        });
      } else {
        await saveAddress({
          label: finalLabel, address_line: fullLine,
          lat: region.latitude, long: region.longitude,
        });
      }
      if (nearestRes) setNearestRestaurant(nearestRes);
      onSaved();
    } catch (_) {
      Alert.alert('ERROR', 'Could not save address. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const LABELS = ['Home', 'Work', 'Hotel', 'Other'];

  // ── Show permission gate if location was denied ──
  if (locationPermission === 'denied') {
    return (
      <View style={styles.mapScreen}>
        <TouchableOpacity style={styles.floatingBack} onPress={onBack} activeOpacity={0.85}>
          <Feather name="arrow-left" size={20} color="#111" />
        </TouchableOpacity>
        <LocationPermissionGate onGranted={initGPS} />
      </View>
    );
  }

  // ── Show loader while location is loading for the first time ──
  if (locationPermission === 'unknown' && !isEditing) {
    return (
      <View style={[styles.mapScreen, { justifyContent: 'center', alignItems: 'center' }]}>
        <TouchableOpacity style={styles.floatingBack} onPress={onBack} activeOpacity={0.85}>
          <Feather name="arrow-left" size={20} color="#111" />
        </TouchableOpacity>
        <ActivityIndicator size="large" color={BRAND_GREEN} />
        <Text style={{ marginTop: 16, fontSize: 12, fontWeight: '900', color: '#999', letterSpacing: 1 }}>
          FINDING YOUR LOCATION…
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.mapScreen}>
      {/* ── Back button ── */}
      <TouchableOpacity style={styles.floatingBack} onPress={onBack} activeOpacity={0.85}>
        <Feather name="arrow-left" size={20} color="#111" />
      </TouchableOpacity>

      {/* ── GPS recenter ── */}
      <TouchableOpacity style={styles.floatingGPS} onPress={recenterGPS} activeOpacity={0.85}>
        <MaterialCommunityIcons name="crosshairs-gps" size={20} color={BRAND_GREEN} />
      </TouchableOpacity>

      {/* ── Map ── */}
      <View style={StyleSheet.absoluteFill}>
        {gpsResolved ? (
          <UnifiedLeafletMap
            lat={region.latitude}
            lng={region.longitude}
            restaurants={allRestaurants}
            radiusMeters={DELIVERY_RADIUS_METERS}
            onLocationChange={handleWebMessage}
            iframeRef={iframeRef}
          />
        ) : (
          <View style={styles.noMapFallback}>
            <ActivityIndicator size="large" color={BRAND_GREEN} />
            <Text style={styles.noMapText}>FETCHING YOUR LOCATION…</Text>
          </View>
        )}
      </View>

      {/* ── Sliding bottom card ── */}
      <Animated.View style={[styles.bottomCard, { height: cardAnim }]}>
        <TouchableOpacity
          onPress={() => animateCard(!expanded)}
          activeOpacity={0.7}
          style={styles.dragZone}
        >
          <View style={styles.dragHandle} />
        </TouchableOpacity>

        {/* Geocoded strip */}
        <TouchableOpacity
          style={styles.geocodedStrip}
          onPress={() => animateCard(!expanded)}
          activeOpacity={0.75}
        >
          <View style={styles.geocodedIconWrap}>
            <MaterialCommunityIcons name="map-marker-check-outline" size={16} color={BRAND_GREEN} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.geocodedLabel}>DELIVERING TO</Text>
            <Text style={styles.geocodedAddress} numberOfLines={1}>
              {isGeocoding ? 'LOCATING…' : (geocoded || (gpsResolved ? 'LOCATION PINNED' : 'MOVE MAP TO PIN')).toUpperCase()}
            </Text>
          </View>
          <Feather name={expanded ? 'chevron-down' : 'chevron-up'} size={16} color="#999" />
        </TouchableOpacity>

        {!expanded ? (
          <TouchableOpacity 
            style={[styles.expandCTA, outOfRange && { backgroundColor: '#CBD5E1' }]} 
            onPress={() => !outOfRange && animateCard(true)} 
            disabled={outOfRange}
            activeOpacity={0.85}
          >
            {outOfRange ? (
              <Ionicons name="alert-circle" size={18} color="#FFF" style={{ marginRight: 8 }} />
            ) : (
              <Ionicons name="add-circle" size={18} color="#FFF" style={{ marginRight: 8 }} />
            )}
            <Text style={styles.expandCTAText}>
              {outOfRange ? 'WE ARE NOT HERE YET' : 'ADD ADDRESS DETAILS'}
            </Text>
          </TouchableOpacity>
        ) : (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
          >
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={styles.formContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.formTitle}>
                {isEditing ? 'EDIT ADDRESS DETAILS' : 'COMPLETE YOUR ADDRESS'}
              </Text>

              {/* Flat + Floor row */}
              <View style={styles.twoCol}>
                <View style={[styles.inputBox, { flex: 1, marginRight: 10 }]}>
                  <Text style={styles.inputLabel}>FLAT / HOUSE NO.</Text>
                  <TextInput
                    style={styles.inputText}
                    value={flatNo} onChangeText={setFlatNo}
                    placeholder="A-205" placeholderTextColor="#CCC"
                    returnKeyType="next"
                    autoCapitalize="characters"
                  />
                </View>
                <View style={[styles.inputBox, { flex: 0.6 }]}>
                  <Text style={styles.inputLabel}>FLOOR</Text>
                  <TextInput
                    style={styles.inputText}
                    value={floorNo} onChangeText={setFloorNo}
                    placeholder="2nd" placeholderTextColor="#CCC"
                    returnKeyType="next"
                  />
                </View>
              </View>

              <View style={styles.inputBox}>
                <Text style={styles.inputLabel}>BUILDING / SOCIETY</Text>
                <TextInput
                  style={styles.inputText}
                  value={building} onChangeText={setBuilding}
                  placeholder="The Camellias" placeholderTextColor="#CCC"
                  returnKeyType="next"
                />
              </View>

              <View style={styles.inputBox}>
                <Text style={styles.inputLabel}>LANDMARK (OPTIONAL)</Text>
                <TextInput
                  style={styles.inputText}
                  value={landmark} onChangeText={setLandmark}
                  placeholder="Near the park" placeholderTextColor="#CCC"
                  returnKeyType="done"
                />
              </View>

              {/* Save as */}
              <Text style={styles.saveAsLabel}>SAVE AS</Text>
              <View style={styles.labelRow}>
                {LABELS.map(l => (
                  <TouchableOpacity
                    key={l}
                    style={[styles.labelPill, label === l && styles.labelPillActive]}
                    onPress={() => setLabel(l)}
                    activeOpacity={0.75}
                  >
                    <Feather
                      name={getLabelIcon(l) as any}
                      size={14}
                      color={label === l ? '#FFF' : '#777'}
                      style={styles.labelPillIcon}
                    />
                    <Text style={[styles.labelPillText, label === l && styles.labelPillTextActive]}>
                      {l.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {label === 'Other' && (
                <View style={[styles.inputBox, { marginTop: 4 }]}>
                  <Text style={styles.inputLabel}>CUSTOM LABEL</Text>
                  <TextInput
                    style={styles.inputText}
                    value={customLabel} onChangeText={setCustomLabel}
                    placeholder="Mom's House" placeholderTextColor="#CCC"
                  />
                </View>
              )}

              {/* Save button */}
              <TouchableOpacity
                style={[styles.saveBtn, (outOfRange || isSaving) && styles.saveBtnDisabled]}
                onPress={handleSave}
                disabled={isSaving || outOfRange}
                activeOpacity={0.87}
              >
                {isSaving ? (
                  <ActivityIndicator color="#FFF" />
                ) : outOfRange ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="alert-circle-outline" size={18} color="#FFF" style={{ marginRight: 8 }} />
                    <Text style={styles.saveBtnText}>WE ARE NOT HERE YET</Text>
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="checkmark-circle" size={18} color="#FFF" style={{ marginRight: 8 }} />
                    <Text style={styles.saveBtnText}>{isEditing ? 'UPDATE ADDRESS' : 'SAVE ADDRESS'}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        )}
      </Animated.View>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────
const AddressPickerScreen = ({ visible, onClose, navigation }: AddressPickerProps) => {
  const {
    saveAddress, updateAddress, deleteAddress,
    addresses, selectAddress, selectedAddress,
    refreshAddresses,
  } = useAddress();
  const { allRestaurants, setNearestRestaurant } = useRestaurant();

  const [step, setStep] = useState<Step>('list');
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  const isModal = visible !== undefined;

  useEffect(() => {
    if (visible) {
      setStep('list');
      setEditingAddress(null);
      Animated.timing(overlayOpacity, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    }
  }, [visible]);

  const handleClose = () => {
    if (!selectedAddress) return;
    Animated.timing(overlayOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setStep('list');
      setEditingAddress(null);
      if (isModal && onClose) onClose();
      else if (!isModal && navigation) navigation.goBack();
    });
  };

  /**
   * When user taps a saved address:
   *  1. Make it default in DB (mark all others non-default)
   *  2. Set as selectedAddress in context
   *  3. Close the sheet
   */
  const handleSelectSaved = async (addr: Address) => {
    const nearest = allRestaurants.find((res: any) =>
      getDistanceMeters(addr.lat, addr.long, res.lat, res.long) <= DELIVERY_RADIUS_METERS,
    );
    if (!nearest) {
      Alert.alert('WE ARE NOT HERE YET 😔', 'This address is outside our current delivery area.');
      return;
    }

    // Persistently set as default and select
    await selectAddress(addr);
    setNearestRestaurant(nearest);
    handleClose();
  };

  const handleEditAddress = (addr: Address) => {
    setEditingAddress(addr);
    setStep('map');
  };

  const handleDeleteAddress = (addr: Address) => {
    Alert.alert('REMOVE ADDRESS', `Delete "${addr.label}"?`, [
      { text: 'CANCEL', style: 'cancel' },
      {
        text: 'DELETE', style: 'destructive',
        onPress: async () => { if (addr.id) await deleteAddress(addr.id); },
      },
    ]);
  };

  const content = (
    <View style={isModal ? styles.overlay : styles.fullScreen}>
      {isModal && (
        <Animated.View style={[StyleSheet.absoluteFillObject, styles.backdrop, { opacity: overlayOpacity }]}>
          <Pressable style={{ flex: 1 }} />
        </Animated.View>
      )}
      {step === 'list' ? (
        <AddressListSheet
          savedAddresses={addresses}
          onSelectAddress={handleSelectSaved}
          onAddNew={() => { setEditingAddress(null); setStep('map'); }}
          onEditAddress={handleEditAddress}
          onDeleteAddress={handleDeleteAddress}
          onClose={handleClose}
          isModal={isModal}
          selectedAddress={selectedAddress}
        />
      ) : (
        <MapAddressPicker
          allRestaurants={allRestaurants}
          saveAddress={saveAddress}
          updateAddress={updateAddress}
          setNearestRestaurant={setNearestRestaurant}
          editingAddress={editingAddress}
          onBack={() => setStep('list')}
          onSaved={handleClose}
          selectedAddress={selectedAddress}
        />
      )}
    </View>
  );

  if (isModal) {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        transparent
        statusBarTranslucent
        onRequestClose={() => { if (selectedAddress) handleClose(); }}
      >
        {content}
      </Modal>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFF' }}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF" />
      {content}
    </SafeAreaView>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  fullScreen: { flex: 1, backgroundColor: '#FFF' },
  backdrop: { backgroundColor: 'rgba(0,0,0,0.5)' },

  // ─── List sheet ──────────────────────────────────────────────
  listSheet: {
    backgroundColor: '#FAFAFA',
    borderTopLeftRadius: 0,   // boxy — no curvy corners
    borderTopRightRadius: 0,
    borderTopWidth: 4,
    borderTopColor: '#111',
    maxHeight: SCREEN_HEIGHT * 0.82,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 20,
    overflow: 'hidden',
  },
  pillHandle: {
    width: 36, height: 4,
    backgroundColor: '#DDD',
    alignSelf: 'center',
    marginTop: 10, marginBottom: 0,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 2,
    borderBottomColor: '#F0F0F0',
    backgroundColor: '#FFF',
  },
  listHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIconBox: {
    width: 42, height: 42,
    backgroundColor: LIGHT_GREEN,
    justifyContent: 'center', alignItems: 'center',
    // Square, not rounded — boxy design
  },
  listHeaderTitle: { fontSize: 16, fontWeight: '900', color: '#111', letterSpacing: 0.5 },
  listHeaderSub: { fontSize: 11, color: '#999', fontWeight: '700', marginTop: 1, letterSpacing: 0.5 },

  listScroll: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 },

  // ─── Add new card ──────────────────────────────────────────────
  addNewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 16,
    borderWidth: 2,
    borderStyle: 'solid',
    borderColor: BRAND_GREEN,
    marginBottom: 8,
  },
  addNewIconBox: {
    width: 44, height: 44,
    backgroundColor: LIGHT_GREEN,
    justifyContent: 'center', alignItems: 'center',
    marginRight: 14,
  },
  addNewTitle: { fontSize: 14, fontWeight: '900', color: '#111', marginBottom: 2, letterSpacing: 0.5 },
  addNewSub: { fontSize: 11, color: '#999', fontWeight: '700', letterSpacing: 0.3 },
  addNewChevron: {
    width: 30, height: 30,
    backgroundColor: LIGHT_GREEN,
    justifyContent: 'center', alignItems: 'center',
  },

  // ─── Section divider ──────────────────────────────────────────
  sectionRow: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 20, marginBottom: 12,
  },
  sectionLine: { flex: 1, height: 1.5, backgroundColor: '#EFEFEF' },
  sectionLabel: {
    fontSize: 10, fontWeight: '900', color: '#BDBDBD',
    letterSpacing: 1.8, marginHorizontal: 12,
  },

  // ─── Address card ──────────────────────────────────────────────
  addrCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 14,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: '#EBEBEB',
  },
  addrCardSelected: {
    borderColor: BRAND_GREEN,
    borderWidth: 2,
    backgroundColor: '#F6FEF9',
  },
  addrIconBox: {
    width: 46, height: 46,
    backgroundColor: '#F6FEF9',
    justifyContent: 'center', alignItems: 'center',
    marginRight: 13,
    borderWidth: 1,
    borderColor: LIGHT_GREEN,
  },
  addrIconBoxSelected: {
    backgroundColor: BRAND_GREEN,
    borderColor: BRAND_GREEN,
  },
  addrLabel: { fontSize: 13, fontWeight: '900', color: '#111', letterSpacing: 0.4 },
  addrLabelSelected: { color: BRAND_DARK },
  addrLine: { fontSize: 12, color: '#777', lineHeight: 17, fontWeight: '600' },
  addrActions: { flexDirection: 'row', alignItems: 'center', marginLeft: 8 },
  addrActionBtn: {
    width: 32, height: 32,
    backgroundColor: LIGHT_GREEN,
    justifyContent: 'center', alignItems: 'center',
    marginLeft: 6,
  },
  addrDeleteBtn: { backgroundColor: '#FEF2F2' },

  // Default badge
  defaultBadge: {
    backgroundColor: BRAND_GREEN,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  defaultBadgeText: {
    fontSize: 9, fontWeight: '900', color: '#FFF', letterSpacing: 1,
  },

  // ─── Empty state ───────────────────────────────────────────────
  emptyWrap: { alignItems: 'center', paddingVertical: 48 },
  emptyIconBox: {
    width: 80, height: 80,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: { fontSize: 13, fontWeight: '900', color: '#B0B0B0', marginBottom: 8, letterSpacing: 1.5 },
  emptySub: { fontSize: 11, color: '#CCC', textAlign: 'center', lineHeight: 18, paddingHorizontal: 30, fontWeight: '700', letterSpacing: 0.5 },

  // ─── Permission gate ──────────────────────────────────────────
  permGate: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#FAFAFA', padding: 40,
  },
  permIconBox: {
    width: 88, height: 88,
    backgroundColor: LIGHT_GREEN,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 28,
  },
  permTitle: {
    fontSize: 18, fontWeight: '900', color: '#111',
    letterSpacing: 0.5, marginBottom: 14, textAlign: 'center',
  },
  permSub: {
    fontSize: 13, fontWeight: '700', color: '#888',
    textAlign: 'center', lineHeight: 22, letterSpacing: 0.3, marginBottom: 36,
  },
  permBtn: {
    backgroundColor: BRAND_GREEN,
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 18, paddingHorizontal: 32,
  },
  permBtnText: {
    color: '#FFF', fontSize: 14, fontWeight: '900', letterSpacing: 1,
  },

  // ─── Map screen ───────────────────────────────────────────────
  mapScreen: { flex: 1, backgroundColor: '#E8EFEA' },

  floatingBack: {
    position: 'absolute', top: 50, left: 20, zIndex: 10,
    width: 48, height: 48, backgroundColor: '#FFF',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#111',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 10, elevation: 5,
  },
  floatingGPS: {
    position: 'absolute', top: 50, right: 20, zIndex: 10,
    width: 48, height: 48, backgroundColor: '#FFF',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: BRAND_GREEN,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 10, elevation: 5,
  },

  pinOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'center',
  },
  pinShadow: { width: 16, height: 4, backgroundColor: 'rgba(0,0,0,0.15)', marginTop: 2 },
  pinShadowRed: { backgroundColor: 'rgba(239,68,68,0.2)' },

  zonePill: {
    position: 'absolute', top: 120, alignSelf: 'center',
    backgroundColor: '#000', paddingHorizontal: 20, paddingVertical: 10,
    flexDirection: 'row', alignItems: 'center', zIndex: 10, gap: 6,
  },
  zonePillRed: { backgroundColor: '#EF4444' },
  zonePillText: { color: '#FFF', fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },

  storeMarker: { backgroundColor: '#111', padding: 4, borderWidth: 1, borderColor: '#FFF' },

  noMapFallback: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F2F5F2' },
  noMapText: { fontSize: 14, fontWeight: '900', color: '#AAA', marginTop: 12, letterSpacing: 0.5 },
  noMapSub: { fontSize: 12, color: '#CCC', marginTop: 6, textAlign: 'center', paddingHorizontal: 40, fontWeight: '700' },

  // ─── Bottom card ───────────────────────────────────────────────
  bottomCard: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFF',
    borderTopWidth: 4, borderTopColor: '#111',
  },
  dragZone: { width: '100%', height: 28, justifyContent: 'center', alignItems: 'center' },
  dragHandle: { width: 32, height: 4, backgroundColor: '#E2E8F0' },

  geocodedStrip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  geocodedIconWrap: {
    width: 40, height: 40,
    backgroundColor: '#F0FDF4',
    justifyContent: 'center', alignItems: 'center',
    marginRight: 14,
  },
  geocodedLabel: { fontSize: 10, fontWeight: '900', color: '#94A3B8', letterSpacing: 1.5, marginBottom: 2 },
  geocodedAddress: { fontSize: 13, fontWeight: '900', color: '#1E293B', letterSpacing: 0.2 },

  expandCTA: {
    backgroundColor: BRAND_GREEN, margin: 16, paddingVertical: 20,
    justifyContent: 'center', alignItems: 'center',
    flexDirection: 'row',
  },
  expandCTAText: { color: '#FFF', fontSize: 14, fontWeight: '900', letterSpacing: 2 },

  // ─── Form ──────────────────────────────────────────────────────
  formContent: { padding: 24, paddingBottom: 50 },
  formTitle: { fontSize: 20, fontWeight: '900', color: '#1E293B', marginBottom: 24, letterSpacing: 0.3 },
  twoCol: { flexDirection: 'row', marginBottom: 5 },
  inputBox: { marginBottom: 18 },
  inputLabel: { fontSize: 11, fontWeight: '900', color: '#94A3B8', marginBottom: 8, letterSpacing: 1.2 },
  inputText: {
    backgroundColor: '#F8FAFC', height: 54,
    borderWidth: 1.5, borderColor: '#E2E8F0',
    paddingHorizontal: 16, fontSize: 14, fontWeight: '800', color: '#1E293B',
    // Square inputs — no border radius
  },
  saveAsLabel: { fontSize: 11, fontWeight: '900', color: '#94A3B8', marginBottom: 12, letterSpacing: 1.2 },
  labelRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 20 },
  labelPill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F1F5F9', paddingVertical: 12, paddingHorizontal: 16,
    marginRight: 10, marginBottom: 10,
    borderWidth: 1.5, borderColor: '#E2E8F0',
    // Square pills — no border radius
  },
  labelPillActive: { backgroundColor: '#111', borderColor: '#111' },
  labelPillIcon: { marginRight: 8 },
  labelPillText: { fontSize: 12, fontWeight: '900', color: '#64748B', letterSpacing: 1 },
  labelPillTextActive: { color: '#FFF' },

  saveBtn: {
    backgroundColor: BRAND_GREEN, height: 62,
    justifyContent: 'center', alignItems: 'center',
    marginTop: 10,
    shadowColor: BRAND_GREEN,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25, shadowRadius: 12, elevation: 10,
  },
  saveBtnDisabled: { backgroundColor: '#CBD5E1', shadowOpacity: 0 },
  saveBtnText: { color: '#FFF', fontSize: 14, fontWeight: '900', letterSpacing: 2 },
});

export default AddressPickerScreen;