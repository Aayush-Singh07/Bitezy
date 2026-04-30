import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Dimensions, TouchableOpacity } from 'react-native';
import { useRider } from '../../context/RiderContext';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'expo-router';
import { IndianRupee, Bike, TrendingUp, Award, CheckCircle2, ChevronRight } from 'lucide-react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, interpolateColor } from 'react-native-reanimated';

const { width } = Dimensions.get('window');

export default function HomeDashboard() {
  const { activeRider, setActiveCount: setGlobalActiveCount } = useRider();
  const [deliveredCount, setDeliveredCount] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [isOnline, setIsOnline] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  const router = useRouter();
  const progress = useSharedValue(0);

  const fetchStats = async () => {
    if (!activeRider) return;
    
    try {
      // Calculate Today IST Start (00:00 IST converted to UTC for DB query)
      const localNow = new Date();
      localNow.setHours(0, 0, 0, 0); 
      const startOfTodayIST = localNow.toISOString();
      
      // Latest Rider Status
      const { data: rData, error: rError } = await supabase
        .from('riders')
        .select('is_available')
        .eq('id', activeRider.id)
        .single();
      
      if (!rError) {
        setIsOnline(rData?.is_available || false);
      }

      // Delivered Missions (Payout eligibility: ONLY DELIVERED today IST)
      const { count: dCount, error: dError } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('rider_id', activeRider.id)
        .eq('status', 'DELIVERED')
        .gte('created_at', startOfTodayIST);

      if (dError) throw dError;

      // Active Missions (Placed -> Arrived)
      const activeStatuses = ['PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'ON_THE_WAY', 'ARRIVED'];
      const { count: aCount, error: aError } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('rider_id', activeRider.id)
        .in('status', activeStatuses);

      if (aError) throw aError;

      setDeliveredCount(dCount || 0);
      setActiveCount(aCount || 0);
      setGlobalActiveCount(aCount || 0);
    } catch (err) {
      console.warn('Dashboard Sync Failed:', err);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 10000); // Poll every 10 seconds for dashboard accuracy
    return () => clearInterval(interval);
  }, [activeRider]);

  useEffect(() => {
    const p = Math.min(deliveredCount / 30, 1);
    progress.value = withTiming(p, { duration: 1000 });
  }, [deliveredCount]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchStats();
    setRefreshing(false);
  };

  const payoutData = useMemo(() => {
    const base = deliveredCount * 15;
    let bonus = 0;
    if (deliveredCount >= 10) bonus += 100;
    if (deliveredCount >= 20) bonus += 150;
    if (deliveredCount >= 30) bonus += 200;

    let nextMilestone = 10;
    if (deliveredCount >= 30) nextMilestone = 30;
    else if (deliveredCount >= 20) nextMilestone = 30;
    else if (deliveredCount >= 10) nextMilestone = 20;

    return { total: base + bonus, base, bonus, nextMilestone };
  }, [deliveredCount]);

  const animatedProgressStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
    backgroundColor: interpolateColor(
      progress.value,
      [0, 0.33, 0.66, 1],
      ['#ef4444', '#f59e0b', '#10b981', '#02844F']
    )
  }));

  return (
    <View style={styles.base}>
      {/* Rectangular Minimalistic Header */}
      <View style={styles.brandHeader}>
        <Text style={styles.brandText}>BITEZY</Text>
        <View style={[styles.onlineBadge, !isOnline && styles.offlineBadge]}>
          <View style={[styles.onlineDot, !isOnline && styles.offlineDot]} />
          <Text style={styles.onlineText}>{isOnline ? '🛰️ LIVE TRACKING' : 'OFFLINE'}</Text>
        </View>
      </View>

      <ScrollView 
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#02844F" />}
      >
        <View style={styles.greetingSection}>
          <Text style={styles.greetText}>GREETINGS,</Text>
          <Text style={styles.riderName}>{activeRider?.name?.toUpperCase() || 'RIDER'}</Text>
          <Text style={styles.vehicleId}>VEHICLE: {activeRider?.vehicle_number || 'UP16-AB-1234'}</Text>
        </View>

        {/* High-Contrast Rectangular Stats */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, styles.payoutCard]}>
            <View style={styles.cardHeader}>
              <IndianRupee color="#02844F" size={20} />
              <Text style={styles.cardLabel}>TODAY'S PAYOUT</Text>
            </View>
            <Text style={styles.payoutValue}>₹{payoutData.total.toLocaleString('en-IN')}</Text>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownText}>BASE: ₹{payoutData.base}</Text>
              <Text style={styles.breakdownText}>|</Text>
              <Text style={[styles.breakdownText, { color: '#02844F' }]}>BONUS: ₹{payoutData.bonus}</Text>
            </View>
          </View>

          <View style={styles.statCard}>
            <View style={styles.cardHeader}>
              <Bike color="#000" size={20} />
              <Text style={styles.cardLabel}>COMPLETED</Text>
            </View>
            <Text style={styles.countValue}>{deliveredCount}</Text>
            <Text style={styles.countLabel}>MISSIONS TODAY</Text>
          </View>
        </View>

        {/* Boxy Incentive Bar */}
        <View style={styles.incentiveSection}>
          <View style={styles.incentiveHeader}>
            <View style={styles.incentiveTitleRow}>
              <TrendingUp color="#02844F" size={22} />
              <Text style={styles.incentiveTitle}>INCENTIVE PROGRESS</Text>
            </View>
            <Text style={styles.milestoneText}>{deliveredCount}/30</Text>
          </View>

          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressBar, animatedProgressStyle]} />
            
            <View style={styles.markersContainer}>
              <View style={[styles.marker, { left: '33.3%' }]}>
                <View style={[styles.markerDot, deliveredCount >= 10 && styles.markerDotActive]} />
                <Text style={styles.markerLabel}>10</Text>
              </View>
              <View style={[styles.marker, { left: '66.6%' }]}>
                <View style={[styles.markerDot, deliveredCount >= 20 && styles.markerDotActive]} />
                <Text style={styles.markerLabel}>20</Text>
              </View>
              <View style={[styles.marker, { right: 0 }]}>
                <View style={[styles.markerDot, deliveredCount >= 30 && styles.markerDotActive]} />
                <Text style={styles.markerLabel}>30</Text>
              </View>
            </View>
          </View>

          <View style={styles.incentiveFooter}>
            {deliveredCount < 30 ? (
              <Text style={styles.incentiveHint}>
                NEED <Text style={{color: '#02844F'}}>{payoutData.nextMilestone - deliveredCount}</Text> MORE FOR NEXT BONUS
              </Text>
            ) : (
              <View style={styles.maxBonusRow}>
                <Award color="#fbbf24" size={11} />
                <Text style={styles.maxBonusText}>MAX BONUS REACHED</Text>
              </View>
            )}
          </View>
        </View>

        {/* Active Missions Box */}
        <TouchableOpacity 
          style={styles.activeMissionsBox}
          onPress={() => router.push('/(tabs)/missions')}
        >
          <View style={styles.activeMissionsHeader}>
            <Text style={styles.activeMissionsTitle}>ACTIVE MISSIONS</Text>
            <View style={[styles.activeBadge, activeCount > 0 ? styles.activeBadgeGreen : styles.activeBadgeGrey]}>
              <Text style={styles.activeBadgeText}>{activeCount > 0 ? 'LIVE' : 'NONE'}</Text>
            </View>
          </View>
          <Text style={styles.activeMissionsCount}>{activeCount}</Text>
          <View style={styles.activeMissionsFooter}>
            <Text style={styles.viewMissionsText}>VIEW MISSION QUEUE</Text>
            <ChevronRight color="#02844F" size={16} />
          </View>
        </TouchableOpacity>

        <View style={styles.safetyCard}>
          <CheckCircle2 color="#02844F" size={20} />
          <View style={{flex: 1}}>
            <Text style={styles.safetyTitle}>TERMINAL INSTRUCTIONS:</Text>
            <Text style={styles.safetyText}>1. STAY ALERT. WEAR HELMET. FOLLOW ALL TRAFFIC LAWS.</Text>
            <Text style={styles.safetyText}>2. DO NOT USE PHONE WHILE RIDING YOUR VEHICLE.</Text>
            <Text style={styles.safetyText}>3. MAINTAIN PROPER HYGIENE AND BAG CLEANLINESS.</Text>
            <Text style={styles.safetyText}>4. MARK STATUS ONLY WHEN YOU ARRIVE AT DESTINATION.</Text>
          </View>
        </View>
        
        <View style={{height: 60}} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { flex: 1, backgroundColor: '#ffffff' },
  brandHeader: { height: 80, backgroundColor: '#02844F', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15, paddingTop: 20 },
  brandText: { color: '#ffffff', fontSize: 24, fontWeight: '900', letterSpacing: 1 },
  onlineBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 2, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  onlineDot: { width: 8, height: 8, borderRadius: 0, backgroundColor: '#4ade80' },
  offlineDot: { backgroundColor: '#9ca3af' },
  onlineText: { color: '#ffffff', fontSize: 10, fontWeight: '900', letterSpacing: 2 },
  offlineBadge: { borderColor: 'rgba(255,255,255,0.2)' },
  container: { flex: 1, padding: 15 },
  greetingSection: { marginBottom: 24, alignItems: 'flex-start' },
  greetText: { fontSize: 12, color: '#6b7280', fontWeight: '900', letterSpacing: 1 },
  riderName: { fontSize: 32, fontWeight: '900', color: '#000000', letterSpacing: -0.5, marginTop: 2 },
  vehicleId: { fontSize: 11, fontWeight: '900', color: '#02844F', letterSpacing: 1, marginTop: 2 },
  statsGrid: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  statCard: { flex: 1, backgroundColor: '#ffffff', padding: 16, borderRadius: 2, borderWidth: 2, borderColor: '#000000', alignItems: 'flex-start' },
  payoutCard: { flex: 1.4, borderColor: '#02844F' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  cardLabel: { fontSize: 9, fontWeight: '900', color: '#6b7280', letterSpacing: 1 },
  payoutValue: { fontSize: 32, fontWeight: '900', color: '#000000', marginBottom: 6 },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  breakdownText: { fontSize: 9, fontWeight: '900', color: '#9ca3af', letterSpacing: 1 },
  countValue: { fontSize: 32, fontWeight: '900', color: '#000000', marginBottom: 6 },
  countLabel: { fontSize: 10, fontWeight: '900', color: '#6b7280', letterSpacing: 1 },
  incentiveSection: { backgroundColor: '#ffffff', padding: 16, borderRadius: 2, borderWidth: 2, borderColor: '#000000', marginBottom: 24, alignItems: 'flex-start' },
  incentiveHeader: { flexDirection: 'row', width: '100%', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  incentiveTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  incentiveTitle: { fontSize: 15, fontWeight: '900', color: '#000000', letterSpacing: 1 },
  milestoneText: { fontSize: 13, fontWeight: '900', color: '#02844F' },
  progressTrack: { height: 16, width: '100%', backgroundColor: '#f3f4f6', borderRadius: 0, position: 'relative', marginBottom: 24 },
  progressBar: { height: '100%', borderRadius: 0 },
  markersContainer: { position: 'absolute', inset: 0, flexDirection: 'row' },
  marker: { position: 'absolute', top: -4, alignItems: 'center' },
  markerDot: { width: 2, height: 24, backgroundColor: '#000', borderRadius: 0 },
  markerDotActive: { backgroundColor: '#02844F' },
  markerLabel: { fontSize: 10, fontWeight: '900', color: '#000000', marginTop: 4 },
  incentiveFooter: { alignItems: 'flex-start', width: '100%' },
  incentiveHint: { fontSize: 11, color: '#000000', fontWeight: '900', letterSpacing: 1 },
  maxBonusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  maxBonusText: { fontSize: 11, fontWeight: '900', color: '#02844F', letterSpacing: 1 },
  safetyCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: '#f0fdf4', padding: 16, borderRadius: 2, borderWidth: 2, borderColor: '#02844F' },
  safetyTitle: { fontSize: 11, fontWeight: '900', color: '#02844F', letterSpacing: 1, marginBottom: 8 },
  safetyText: { fontSize: 10, color: '#000000', fontWeight: '900', letterSpacing: 0.5, marginBottom: 4 },
  activeMissionsBox: { backgroundColor: '#ffffff', padding: 16, borderRadius: 2, borderWidth: 2, borderColor: '#000000', marginBottom: 20 },
  activeMissionsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  activeMissionsTitle: { fontSize: 13, fontWeight: '900', color: '#000000', letterSpacing: 1 },
  activeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 0 },
  activeBadgeGreen: { backgroundColor: '#dcfce7', borderWidth: 1, borderColor: '#02844F' },
  activeBadgeGrey: { backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#9ca3af' },
  activeBadgeText: { fontSize: 9, fontWeight: '900', color: '#000' },
  activeMissionsCount: { fontSize: 42, fontWeight: '900', color: '#000000', marginBottom: 12 },
  activeMissionsFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  viewMissionsText: { fontSize: 10, fontWeight: '900', color: '#02844F', letterSpacing: 1 }
});
