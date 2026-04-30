import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Modal, ScrollView } from 'react-native';
import { useRider } from '../../context/RiderContext';
import { supabase } from '../../lib/supabase';
import { Clock, MapPin, ChevronRight, CheckCircle2, Navigation2, X, History, Briefcase, Map, Phone } from 'lucide-react-native';
import { formatDistanceToNow, differenceInMinutes, format } from 'date-fns';
import * as Linking from 'expo-linking';
import VelocitySlider from '../../components/VelocitySlider';

export default function MissionsQueue() {
  const { activeRider } = useRider();
  const [missions, setMissions] = useState<any[]>([]);
  const [filter, setFilter] = useState<'ACTIVE' | 'HISTORY'>('ACTIVE');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMission, setSelectedMission] = useState<any>(null);

  const fetchMissions = async () => {
    if (!activeRider) return;
    
    let query = supabase
      .from('orders')
      .select('*, restaurants(*), addresses(*), users(*)')
      .eq('rider_id', activeRider.id);

    // Calculate Today IST Start (00:00 IST converted to UTC for DB query)
    const localNow = new Date();
    localNow.setHours(0, 0, 0, 0); 
    const startOfTodayIST = localNow.toISOString();

    if (filter === 'ACTIVE') {
      // PLACED, ACCEPTED, PREPARING, READY, ON_THE_WAY, ARRIVED
      const activeStatuses = ['PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'ON_THE_WAY', 'ARRIVED'];
      query = query
        .in('status', activeStatuses)
        .order('created_at', { ascending: true });
    } else {
      // DELIVERED or CANCELLED AND from today IST
      const pastStatuses = ['DELIVERED', 'CANCELLED'];
      query = query
        .in('status', pastStatuses)
        .gte('created_at', startOfTodayIST)
        .order('created_at', { ascending: false });
    }

    const { data } = await query;
    setMissions(data || []);
  };

  useEffect(() => {
    fetchMissions();
    const interval = setInterval(fetchMissions, 5000); // Poll every 5 seconds for high-frequency updates
    return () => clearInterval(interval);
  }, [activeRider, filter]);

  // Sync selected mission if it exists in the updated list to prevent stale modal data
  useEffect(() => {
    if (selectedMission) {
      const updated = missions.find(m => m.id === selectedMission.id);
      if (updated && JSON.stringify(updated) !== JSON.stringify(selectedMission)) {
        setSelectedMission(updated);
      }
    }
  }, [missions]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMissions();
    setRefreshing(false);
  };

  const getDuration = (start: string, end: string) => {
    if (!start || !end) return 'N/A';
    const mins = differenceInMinutes(new Date(end), new Date(start));
    return `${mins} MINS`;
  };

  const handleNavigate = async (lat: number, long: number, label: string) => {
    try {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${long}&travelmode=driving`;
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('NAVIGATION ERROR', 'GOOGLE MAPS NOT DETECTED ON THIS DEVICE');
      }
    } catch (err) {
      Alert.alert('SYSTEM ERROR', 'FAILED TO LAUNCH NAVIGATION TERMINAL');
    }
  };

  const handleCall = async (phone: string) => {
    if (!phone) return;
    try {
      const url = `tel:${phone}`;
      await Linking.openURL(url);
    } catch (err) {
      Alert.alert('CALL ERROR', 'SYSTEM DIALER IS UNAVAILABLE');
    }
  };

  const renderMissionCard = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={styles.card} 
      onPress={() => setSelectedMission(item)}
    >
      <View style={styles.cardInfo}>
        <View style={styles.cardHeaderRow}>
          <View style={[styles.statusTag, item.status === 'DELIVERED' ? styles.tagGreen : styles.tagAmber]}>
            <Text style={styles.tagText}>{item.status}</Text>
          </View>
          <Text style={styles.timeText}>{formatDistanceToNow(new Date(item.created_at))} AGO</Text>
        </View>
        
        <Text style={styles.restaurantName}>{item.restaurants?.name?.toUpperCase() || 'MISSION ASSIGNMENT'}</Text>
        
        <View style={styles.locRow}>
          <MapPin size={14} color="#02844F" />
          <Text style={styles.addressText} numberOfLines={1}>{item.addresses?.address_line || 'Operational Zone'}</Text>
        </View>
      </View>
      <ChevronRight color="#000" size={20} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.base}>
      {/* Industrial Header */}
      <View style={styles.brandHeader}>
        <View>
          <Text style={styles.brandText}>MISSION CONTROL</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{missions.length} TOTAL</Text>
          </View>
        </View>
        <View style={[styles.onlineBadge, !activeRider?.is_available && styles.offlineBadge]}>
          <View style={[styles.onlineDot, !activeRider?.is_available && styles.offlineDot]} />
          <Text style={styles.onlineText}>{activeRider?.is_available ? '🛰️ LIVE TRACKING' : 'OFFLINE'}</Text>
        </View>
      </View>

      {/* Industrial Sub-Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity 
          style={[styles.tabButton, filter === 'ACTIVE' && styles.tabButtonActive]}
          onPress={() => setFilter('ACTIVE')}
        >
          <Briefcase size={16} color={filter === 'ACTIVE' ? '#02844F' : '#9ca3af'} />
          <Text style={[styles.tabText, filter === 'ACTIVE' && styles.tabTextActive]}>ACTIVE</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tabButton, filter === 'HISTORY' && styles.tabButtonActive]}
          onPress={() => setFilter('HISTORY')}
        >
          <History size={16} color={filter === 'HISTORY' ? '#02844F' : '#9ca3af'} />
          <Text style={[styles.tabText, filter === 'HISTORY' && styles.tabTextActive]}>PAST</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={missions}
        keyExtractor={(item) => item.id}
        renderItem={renderMissionCard}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#02844F" />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>ZERO MISSIONS REGISTERED IN {filter}</Text>
          </View>
        }
      />

      {/* Analytical Mission Modal */}
      <Modal
        visible={!!selectedMission}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedMission(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{filter === 'ACTIVE' ? 'ORDER OVERVIEW' : 'ORDER DETAILS'}</Text>
              <TouchableOpacity onPress={() => setSelectedMission(null)}>
                <X color="#000" size={24} />
              </TouchableOpacity>
            </View>

            {selectedMission && (
              <View style={{ flex: 1 }}>
                <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
                  <View style={styles.idBox}>
                    <Text style={styles.idLabel}>ORDER ID</Text>
                    <Text style={styles.idValue}>{selectedMission.id.toUpperCase()}</Text>
                  </View>

                  {filter === 'ACTIVE' ? (
                    <View style={styles.activeContent}>
                      <View style={styles.radarSection}>
                        {selectedMission.status?.trim().toUpperCase() === 'READY' ? (
                          <View style={[styles.radarBox, styles.radarGreen]}>
                            <Text style={[styles.radarLabel, {color: '#02844f'}]}>PLEASE COLLECT YOUR ORDER</Text>
                            <Text style={styles.radarSub}>MEAL IS READY AT THE RESTAURANT COUNTER</Text>
                          </View>
                        ) : selectedMission.status?.trim().toUpperCase() === 'ON_THE_WAY' ? (
                          <View style={[styles.radarBox, styles.radarGreen]}>
                            <Text style={[styles.radarLabel, {color: '#02844f'}]}>IN TRANSIT TO CUSTOMER</Text>
                            <Text style={styles.radarSub}>NAVIGATE TO THE DELIVERY ADDRESS BELOW</Text>
                          </View>
                        ) : selectedMission.status?.trim().toUpperCase() === 'ARRIVED' ? (
                          <View style={[styles.radarBox, styles.radarGreen]}>
                            <Text style={[styles.radarLabel, {color: '#02844f'}]}>ARRIVED AT DESTINATION</Text>
                            <Text style={styles.radarSub}>HAND OVER THE MEAL TO THE CUSTOMER</Text>
                          </View>
                        ) : (
                          <View style={[styles.radarBox, styles.radarAmber]}>
                            <Text style={[styles.radarLabel, {color: '#d97706'}]}>WAIT OUTSIDE STORE</Text>
                            <Text style={styles.radarSub}>RESTAURANT IS PREPARING MEAL</Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.detailsGroup}>
                        <View style={styles.detailItem}>
                          <Text style={styles.detailLabel}>ORIGIN (RESTAURANT)</Text>
                          <Text style={styles.detailValue}>{selectedMission.restaurants?.name?.toUpperCase()}</Text>
                        </View>
                        {(selectedMission.status === 'ON_THE_WAY' || selectedMission.status === 'ARRIVED') && (
                          <View style={styles.detailItem}>
                            <Text style={styles.detailLabel}>DESTINATION (CUSTOMER)</Text>
                            <Text style={styles.detailValue}>{selectedMission.addresses?.address_line?.toUpperCase()}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  ) : (
                    <View style={styles.historyContent}>
                      <View style={styles.analyticsGrid}>
                        <View style={styles.analyticBox}>
                          <Text style={styles.idLabel}>FINAL STATUS</Text>
                          <Text style={[styles.idValue, { color: selectedMission.status === 'DELIVERED' ? '#02844F' : '#ef4444' }]}>
                            {selectedMission.status}
                          </Text>
                        </View>
                        <View style={styles.analyticBox}>
                          <Text style={styles.idLabel}>TOTAL TRANSIT</Text>
                          <Text style={styles.idValue}>
                            {getDuration(selectedMission.picked_up_at, selectedMission.delivered_at)}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.detailsGroup}>
                        <View style={styles.detailItem}>
                          <Text style={styles.detailLabel}>PICKUP LOG</Text>
                          <Text style={styles.detailValue}>
                            {selectedMission.picked_up_at ? format(new Date(selectedMission.picked_up_at), 'HH:mm:ss') : '--:--:--'}
                          </Text>
                        </View>
                        <View style={styles.detailItem}>
                          <Text style={styles.detailLabel}>DELIVERY LOG</Text>
                          <Text style={styles.detailValue}>
                            {selectedMission.delivered_at ? format(new Date(selectedMission.delivered_at), 'HH:mm:ss') : '--:--:--'}
                          </Text>
                        </View>
                        <View style={styles.detailItem}>
                          <Text style={styles.detailLabel}>DELIVERY RATING</Text>
                          <Text style={[styles.detailValue, {color: '#02844F'}]}>
                            {selectedMission.delivery_rating ? `${selectedMission.delivery_rating} / 5.0` : 'PENDING'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  )}
                </ScrollView>
                
                <View style={[styles.modalFooterFixed, { borderTopWidth: 0, marginTop: 0 }]}>
                  {filter === 'ACTIVE' ? (
                    <>
                      {selectedMission.status?.trim().toUpperCase() === 'READY' ? (
                        <View style={{ gap: 15 }}>
                          <TouchableOpacity 
                            style={styles.navActionMinimal}
                            onPress={() => handleNavigate(selectedMission.restaurants?.lat, selectedMission.restaurants?.long, 'RESTAURANT')}
                          >
                            <Map color="#02844F" size={16} />
                            <Text style={styles.navActionText}>GMAPS: NAVIGATE TO STORE</Text>
                          </TouchableOpacity>
                          
                          <VelocitySlider 
                            text="SWIPE TO COLLECT ORDER"
                            onComplete={async () => {
                              const updates = { 
                                status: 'ON_THE_WAY', 
                                picked_up_at: new Date().toISOString() 
                              };
                              const { error } = await supabase.from('orders').update(updates).eq('id', selectedMission.id);
                              if (!error) {
                                fetchMissions();
                              }
                            }}
                          />
                        </View>
                      ) : selectedMission.status?.trim().toUpperCase() === 'ON_THE_WAY' ? (
                        <View style={{ gap: 15 }}>
                          <TouchableOpacity 
                            style={styles.navActionMinimal}
                            onPress={() => handleNavigate(selectedMission.addresses?.lat, selectedMission.addresses?.long, 'CUSTOMER')}
                          >
                            <Map color="#02844F" size={16} />
                            <Text style={styles.navActionText}>GMAPS: NAVIGATE TO CUSTOMER</Text>
                          </TouchableOpacity>

                          <VelocitySlider 
                            text="SWIPE TO MARK ARRIVED"
                            onComplete={async () => {
                              const updates = { 
                                status: 'ARRIVED',
                                arrived_at: new Date().toISOString() 
                              };
                              const { error } = await supabase.from('orders').update(updates).eq('id', selectedMission.id);
                              if (!error) {
                                fetchMissions();
                              }
                            }}
                          />
                        </View>
                      ) : selectedMission.status?.trim().toUpperCase() === 'ARRIVED' ? (
                        <View style={{ gap: 15 }}>
                          <TouchableOpacity 
                            style={styles.navActionMinimal}
                            onPress={() => handleCall(selectedMission.users?.phone)}
                          >
                            <Phone color="#02844F" size={16} />
                            <Text style={styles.navActionText}>CALL CUSTOMER: {selectedMission.users?.name?.toUpperCase()}</Text>
                          </TouchableOpacity>

                          <VelocitySlider 
                            text="SWIPE TO COMPLETE MISSION"
                            color="#000"
                            onComplete={async () => {
                              const updates = { 
                                status: 'DELIVERED', 
                                delivered_at: new Date().toISOString() 
                              };
                              const { error } = await supabase.from('orders').update(updates).eq('id', selectedMission.id);
                              if (!error) {
                                fetchMissions();
                              }
                            }}
                          />
                        </View>
                      ) : (
                        <View style={{ gap: 15 }}>
                          <TouchableOpacity 
                            style={styles.navActionMinimal}
                            onPress={() => handleNavigate(selectedMission.restaurants?.lat, selectedMission.restaurants?.long, 'RESTAURANT')}
                          >
                            <Map color="#02844F" size={16} />
                            <Text style={styles.navActionText}>GMAPS: NAVIGATE TO STORE</Text>
                          </TouchableOpacity>
                          
                          <View style={[styles.sliderPlaceholder, { backgroundColor: '#f3f4f6' }]}>
                             <Clock color="#9ca3af" size={16} />
                             <Text style={[styles.navActionText, { color: '#9ca3af' }]}>AWAITING KITCHEN READINESS</Text>
                          </View>
                        </View>
                      )}
                    </>
                  ) : (
                    <TouchableOpacity style={[styles.actionButton, {backgroundColor: '#000'}]} onPress={() => setSelectedMission(null)}>
                      <Text style={styles.actionButtonText}>CLOSE RECORDS</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { flex: 1, backgroundColor: '#ffffff' },
  brandHeader: { height: 80, backgroundColor: '#02844F', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15, paddingTop: 20 },
  brandText: { color: '#ffffff', fontSize: 16, fontWeight: '900', letterSpacing: 1 },
  countBadge: { backgroundColor: 'rgba(0,0,0,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', alignSelf: 'flex-start' },
  countText: { color: '#ffffff', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  onlineBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 2, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  onlineDot: { width: 8, height: 8, borderRadius: 0, backgroundColor: '#4ade80' },
  offlineDot: { backgroundColor: '#9ca3af' },
  onlineText: { color: '#ffffff', fontSize: 10, fontWeight: '900', letterSpacing: 2 },
  offlineBadge: { borderColor: 'rgba(255,255,255,0.2)' },
  tabBar: { flexDirection: 'row', height: 50, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  tabButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabButtonActive: { borderBottomColor: '#02844F' },
  tabText: { fontSize: 11, fontWeight: '900', color: '#9ca3af', letterSpacing: 1 },
  tabTextActive: { color: '#02844F' },
  listContent: { padding: 15 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', padding: 20, borderWidth: 2, borderColor: '#000', marginBottom: 15 },
  cardInfo: { flex: 1 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  statusTag: { paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1 },
  tagGreen: { backgroundColor: '#dcfce7', borderColor: '#059669' },
  tagAmber: { backgroundColor: '#fffbeb', borderColor: '#d97706' },
  tagText: { fontSize: 8, fontWeight: '900', color: '#000' },
  timeText: { fontSize: 9, color: '#6b7280', fontWeight: '900' },
  restaurantName: { fontSize: 18, fontWeight: '900', color: '#000', marginBottom: 8 },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  addressText: { fontSize: 11, color: '#6b7280', fontWeight: '800' },
  emptyContainer: { padding: 60, alignItems: 'center' },
  emptyText: { color: '#d1d5db', fontWeight: '900', fontSize: 12, letterSpacing: 1, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', padding: 24, height: '55%', borderTopWidth: 4, borderTopColor: '#000' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  modalFooterFixed: { marginTop: 15, paddingTop: 15, borderTopWidth: 2, borderTopColor: '#f3f4f6', gap: 10 },
  idBox: { backgroundColor: '#f9fafb', padding: 12, borderWidth: 1, borderColor: '#f3f4f6', marginBottom: 24 },
  idLabel: { fontSize: 9, fontWeight: '900', color: '#9ca3af', marginBottom: 4 },
  idValue: { fontSize: 10, fontWeight: '900', color: '#000' },
  radarSection: { marginBottom: 30 },
  radarBox: { padding: 20, alignItems: 'center', borderWidth: 2, borderStyle: 'dashed' },
  radarAmber: { backgroundColor: '#fffbeb', borderColor: '#fde68a' },
  radarGreen: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  radarLabel: { fontSize: 18, fontWeight: '900', letterSpacing: 0 },
  radarSub: { fontSize: 10, color: '#6b7280', marginTop: 4, fontWeight: '900' },
  analyticsGrid: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  analyticBox: { flex: 1, backgroundColor: '#f9fafb', padding: 16, borderWidth: 1, borderColor: '#f3f4f6' },
  activeContent: { width: '100%' },
  historyContent: { width: '100%' },
  detailsGroup: { marginBottom: 30 },
  detailItem: { marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', paddingBottom: 12 },
  detailLabel: { fontSize: 10, color: '#9ca3af', fontWeight: '900', letterSpacing: 1, marginBottom: 8 },
  detailValue: { fontSize: 14, fontWeight: '900', color: '#000' },
  actionButton: { backgroundColor: '#02844F', height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, borderWidth: 2, borderColor: '#000' },
  completeBtn: { backgroundColor: '#000', marginTop: 12 },
  actionButtonText: { color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 1 },
  navActionMinimal: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderWidth: 2, borderColor: '#f3f4f6', backgroundColor: '#fff' },
  navActionText: { color: '#000', fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  sliderPlaceholder: { height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderWidth: 2, borderColor: '#f3f4f6', borderStyle: 'dashed' }
});
