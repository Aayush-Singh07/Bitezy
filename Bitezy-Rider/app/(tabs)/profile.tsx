import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, Alert, Image, ScrollView, Modal, FlatList, ActivityIndicator } from 'react-native';
import { useRider } from '../../context/RiderContext';
import { supabase } from '../../lib/supabase';
import { User, Phone, Bike, LogOut, ChevronRight, ShieldCheck, Contact, X, Wallet, ReceiptIndianRupee } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';

export default function RiderProfile() {
  const { activeRider, setActiveRider } = useRider();
  const router = useRouter();
  const [isOnline, setIsOnline] = useState(activeRider?.is_available || false);
  const [supportVisible, setSupportVisible] = useState(false);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [payoutHistory, setPayoutHistory] = useState<any[]>([]);
  const [lifetimeEarning, setLifetimeEarning] = useState(0);

  const fetchLifetimeStats = async () => {
    if (!activeRider) return;
    setLoadingHistory(true);
    
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('created_at, status')
        .eq('rider_id', activeRider.id)
        .eq('status', 'DELIVERED')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Group by IST Day
      const dailyGroups: { [key: string]: number } = {};
      data?.forEach(order => {
        // Assume created_at is UTC, convert to IST date string
        const date = new Date(order.created_at);
        // Offset for IST (+5:30)
        const istTime = new Date(date.getTime() + (5.5 * 60 * 60 * 1000));
        const dateStr = istTime.toISOString().split('T')[0];
        dailyGroups[dateStr] = (dailyGroups[dateStr] || 0) + 1;
      });

      let totalLife = 0;
      const historyItems = Object.entries(dailyGroups).map(([date, count]) => {
        const base = count * 15;
        let bonus = 0;
        if (count >= 10) bonus += 100;
        if (count >= 20) bonus += 150;
        if (count >= 30) bonus += 200;
        
        const total = base + bonus;
        totalLife += total;
        
        return {
          date,
          count,
          base,
          bonus,
          total
        };
      }).sort((a, b) => b.date.localeCompare(a.date));

      setPayoutHistory(historyItems);
      setLifetimeEarning(totalLife);
    } catch (err) {
      console.error('Failed to fetch lifetime stats:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchLifetimeStats();
    }, [activeRider])
  );

  const toggleAvailability = async (value: boolean) => {
    if (!activeRider) return;
    const { error } = await supabase
      .from('riders')
      .update({ is_available: value })
      .eq('id', activeRider.id);

    if (!error) {
      setIsOnline(value);
      setActiveRider({ ...activeRider, is_available: value });
    }
  };

  const handleLogout = () => {
    setActiveRider(null);
    router.replace('/');
  };

  const renderHistoryItem = ({ item }: { item: any }) => (
    <View style={styles.historyRow}>
      <View style={styles.historyMain}>
        <Text style={styles.historyDate}>{item.date}</Text>
        <Text style={styles.historySubtitle}>{item.count} MISSIONS COMPLETED</Text>
      </View>
      <View style={styles.historyDetail}>
        <Text style={styles.historyTotal}>₹{item.total}</Text>
        <Text style={styles.historySubDetail}>B: ₹{item.base} | I: ₹{item.bonus}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.base}>
      {/* Industrial Header */}
      <View style={styles.brandHeader}>
        <View>
          <Text style={styles.brandText}>ACCOUNT PROFILE</Text>
          <View style={styles.idBadge}>
            <Text style={styles.idText}>ID: {activeRider?.id?.slice(0, 8).toUpperCase()}</Text>
          </View>
        </View>
        <View style={[styles.onlineBadge, !isOnline && styles.offlineBadge]}>
          <View style={[styles.onlineDot, !isOnline && styles.offlineDot]} />
          <Text style={styles.onlineText}>{isOnline ? '🛰️ LIVE TRACKING' : 'OFFLINE'}</Text>
        </View>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
        
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarFrame}>
            {activeRider?.image_url ? (
              <Image source={{ uri: activeRider.image_url }} style={styles.avatarImage} />
            ) : (
              <View style={styles.placeholderAvatar}>
                <User color="#02844F" size={40} />
              </View>
            )}
          </View>
          <View style={styles.nameSection}>
            <Text style={styles.riderLabel}>ASSIGNED RIDER</Text>
            <Text style={styles.riderName}>{activeRider?.name?.toUpperCase()}</Text>
          </View>
        </View>

        {/* Lifetime Earnings Module */}
        <View style={styles.earningsModule}>
          <View style={styles.moduleHeader}>
            <Wallet color="#02844F" size={18} />
            <Text style={styles.moduleTitle}>LIFETIME EARNINGS</Text>
          </View>
          <Text style={styles.lifetimeValue}>₹{lifetimeEarning.toLocaleString('en-IN')}</Text>
          <Text style={styles.moduleHelper}>TOTAL PAYOUT ACCUMULATED SINCE JOINING</Text>
        </View>

        {/* Presence Module */}
        <View style={styles.industrialModule}>
          <View style={styles.moduleHeader}>
            <ShieldCheck color="#02844F" size={18} />
            <Text style={styles.moduleTitle}>TERMINAL STATUS</Text>
          </View>
          <View style={styles.toggleRow}>
            <Text style={styles.statusPrimary}>{isOnline ? 'ONLINE & VISIBLE' : 'OFFLINE / DISCONNECTED'}</Text>
            <Switch 
              value={isOnline} 
              onValueChange={toggleAvailability}
              trackColor={{ false: '#f3f4f6', true: '#dcfce7' }}
              thumbColor={isOnline ? '#02844F' : '#9ca3af'}
            />
          </View>
          <Text style={styles.moduleHelper}>
            {isOnline ? 'CONNECTED TO BITEZY FLEET. READY FOR MISSIONS.' : 'DISCONNECTED. GO ONLINE TO START EARNING.'}
          </Text>
        </View>

        {/* Data Cards */}
        <View style={styles.infoGrid}>
          <View style={styles.infoBox}>
            <View style={styles.boxTitleRow}>
              <Phone color="#6b7280" size={14} />
              <Text style={styles.boxTitle}>REGISTERED PHONE</Text>
            </View>
            <Text style={styles.boxValue}>{activeRider?.phone?.replace(/^\+91/, '') || 'NOT FOUND'}</Text>
          </View>

          <View style={styles.infoBox}>
            <View style={styles.boxTitleRow}>
              <Bike color="#6b7280" size={14} />
              <Text style={styles.boxTitle}>VEHICLE PLATE</Text>
            </View>
            <Text style={styles.boxValue}>{activeRider?.vehicle_number || 'PENDING'}</Text>
          </View>
        </View>

        {/* Action Menu */}
        <View style={styles.actionSection}>
          <TouchableOpacity style={styles.actionItem} onPress={() => setHistoryVisible(true)}>
            <View style={styles.actionLead}>
              <ReceiptIndianRupee color="#000" size={18} />
              <Text style={styles.actionText}>PAYOUT HISTORY</Text>
            </View>
            <ChevronRight color="#000" size={18} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionItem} onPress={() => setSupportVisible(true)}>
            <View style={styles.actionLead}>
              <Contact color="#000" size={18} />
              <Text style={styles.actionText}>FLEET SUPPORT CENTER</Text>
            </View>
            <ChevronRight color="#000" size={18} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionItem, styles.logoutItem]} onPress={handleLogout}>
            <View style={styles.actionLead}>
              <LogOut color="#ef4444" size={18} />
              <Text style={[styles.actionText, { color: '#ef4444' }]}>LOGOUT</Text>
            </View>
            <ChevronRight color="#ef4444" size={18} />
          </TouchableOpacity>
        </View>

        <Text style={styles.versionTag}>BITEZY VELOCITY • ELITE TERMINAL v1.2.0</Text>
      </ScrollView>

      {/* Support Modal */}
      <Modal visible={supportVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.supportModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>FLEET SUPPORT</Text>
              <TouchableOpacity onPress={() => setSupportVisible(false)}>
                <X color="#000" size={24} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.supportLabel}>CONTACT SUPPORT TEAM:</Text>
              <View style={styles.supportNumberBox}>
                <Phone color="#02844F" size={24} />
                <Text style={styles.supportNumber}>+91 98765 43210</Text>
              </View>
              <Text style={styles.supportNote}>AVAILABLE 24/7 FOR RIDER ASSISTANCE</Text>
              <TouchableOpacity style={styles.closeButton} onPress={() => setSupportVisible(false)}>
                <Text style={styles.closeButtonText}>DISMISS</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Payout History Modal */}
      <Modal visible={historyVisible} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.historyModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>PAYOUT LEDGER</Text>
              <TouchableOpacity onPress={() => setHistoryVisible(false)}>
                <X color="#000" size={24} />
              </TouchableOpacity>
            </View>
            
            {loadingHistory ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator color="#02844F" size="large" />
                <Text style={styles.loadingText}>SYNCING LEDGER...</Text>
              </View>
            ) : (
              <FlatList
                data={payoutHistory}
                keyExtractor={(item) => item.date}
                renderItem={renderHistoryItem}
                contentContainerStyle={styles.historyList}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>NO PAYOUT HISTORY FOUND</Text>
                  </View>
                }
              />
            )}

            <View style={styles.modalFooter}>
              <Text style={styles.footerNote}>B: BASE PAY | I: INCENTIVE BONUS</Text>
              <TouchableOpacity style={styles.closeButton} onPress={() => setHistoryVisible(false)}>
                <Text style={styles.closeButtonText}>DISMISS</Text>
              </TouchableOpacity>
            </View>
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
  idBadge: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', alignSelf: 'flex-start' },
  idText: { color: '#ffffff', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  onlineBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 2, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  onlineDot: { width: 8, height: 8, borderRadius: 0, backgroundColor: '#4ade80' },
  offlineDot: { backgroundColor: '#9ca3af' },
  onlineText: { color: '#ffffff', fontSize: 10, fontWeight: '900', letterSpacing: 2 },
  offlineBadge: { borderColor: 'rgba(255,255,255,0.2)' },
  container: { flex: 1, padding: 15 },
  profileCard: { flexDirection: 'row', gap: 20, backgroundColor: '#ffffff', padding: 20, borderWidth: 2, borderColor: '#000000', marginBottom: 20 },
  avatarFrame: { width: 80, height: 80, backgroundColor: '#f3f4f6', borderWidth: 2, borderColor: '#000000', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  placeholderAvatar: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  nameSection: { flex: 1, justifyContent: 'center' },
  riderLabel: { fontSize: 9, fontWeight: '900', color: '#6b7280', letterSpacing: 1, marginBottom: 4 },
  riderName: { fontSize: 24, fontWeight: '900', color: '#000000', letterSpacing: -0.5 },
  earningsModule: { backgroundColor: '#ffffff', padding: 20, borderLeftWidth: 6, borderLeftColor: '#000000', borderWidth: 2, borderColor: '#000000', marginBottom: 20 },
  lifetimeValue: { fontSize: 32, fontWeight: '900', color: '#02844F', marginBottom: 8 },
  industrialModule: { backgroundColor: '#ffffff', padding: 16, borderLeftWidth: 6, borderLeftColor: '#02844F', borderWidth: 2, borderColor: '#000000', marginBottom: 20 },
  moduleHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  moduleTitle: { fontSize: 11, fontWeight: '900', color: '#000000', letterSpacing: 1 },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  statusPrimary: { fontSize: 14, fontWeight: '900', color: '#000000' },
  moduleHelper: { fontSize: 10, color: '#6b7280', fontWeight: '900', letterSpacing: 0.5 },
  infoGrid: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  infoBox: { flex: 1, backgroundColor: '#ffffff', padding: 16, borderWidth: 2, borderColor: '#000000' },
  boxTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  boxTitle: { fontSize: 9, fontWeight: '900', color: '#6b7280', letterSpacing: 1 },
  boxValue: { fontSize: 13, fontWeight: '900', color: '#000000' },
  actionSection: { marginBottom: 30 },
  actionItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18, borderBottomWidth: 2, borderBottomColor: '#f3f4f6', backgroundColor: '#ffffff' },
  actionLead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  actionText: { fontSize: 12, fontWeight: '900', color: '#000000', letterSpacing: 1 },
  logoutItem: { backgroundColor: '#fff', borderTopWidth: 2, borderTopColor: '#000', marginTop: 10, borderWidth: 2, borderColor: '#000', borderBottomColor: '#000' },
  versionTag: { textAlign: 'center', fontSize: 9, fontWeight: '900', color: '#d1d5db', letterSpacing: 2, marginTop: 10 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  supportModal: { backgroundColor: '#ffffff', width: '100%', borderWidth: 2, borderColor: '#000', padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 2, borderBottomColor: '#000', paddingBottom: 15, marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '900', color: '#000', letterSpacing: 1 },
  modalBody: { alignItems: 'flex-start' },
  supportLabel: { fontSize: 10, fontWeight: '900', color: '#6b7280', letterSpacing: 1, marginBottom: 15 },
  supportNumberBox: { flexDirection: 'row', alignItems: 'center', gap: 15, marginBottom: 20 },
  supportNumber: { fontSize: 24, fontWeight: '900', color: '#000' },
  supportNote: { fontSize: 10, fontWeight: '900', color: '#02844F', letterSpacing: 1, marginBottom: 30 },
  closeButton: { backgroundColor: '#000', width: '100%', height: 50, justifyContent: 'center', alignItems: 'center' },
  closeButtonText: { color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 1 },
  historyModal: { backgroundColor: '#ffffff', width: '100%', height: '80%', borderWidth: 2, borderColor: '#000', padding: 20 },
  historyList: { paddingBottom: 20 },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  historyMain: { flex: 1 },
  historyDate: { fontSize: 14, fontWeight: '900', color: '#000', marginBottom: 4 },
  historySubtitle: { fontSize: 10, fontWeight: '900', color: '#6b7280', letterSpacing: 1 },
  historyDetail: { alignItems: 'flex-end' },
  historyTotal: { fontSize: 18, fontWeight: '900', color: '#02844F', marginBottom: 4 },
  historySubDetail: { fontSize: 9, fontWeight: '900', color: '#9ca3af', letterSpacing: 0.5 },
  modalFooter: { borderTopWidth: 2, borderTopColor: '#000', paddingTop: 15 },
  footerNote: { fontSize: 9, fontWeight: '900', color: '#9ca3af', textAlign: 'center', marginBottom: 15, letterSpacing: 1 },
  modalLoading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 10, fontWeight: '900', color: '#6b7280', marginTop: 15, letterSpacing: 2 },
  emptyContainer: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#9ca3af', fontWeight: '900', fontSize: 11, letterSpacing: 1 }
});
