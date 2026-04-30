import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Linking, TextInput, ActivityIndicator } from 'react-native';
import { X, Navigation2, CheckCircle2, MapPin, Phone, MessageCircle, ShieldCheck } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence, interpolateColor } from 'react-native-reanimated';

type MissionProps = {
  mission: any;
  isVisible: boolean;
  onClose: () => void;
  onUpdate: () => void;
};

export default function MissionActionModal({ mission, isVisible, onClose, onUpdate }: MissionProps) {
  const [isLoading, setIsLoading] = useState(false);
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (isVisible && mission) {
      if (mission.prep_completed_at && mission.status !== 'DELIVERED') {
        pulse.value = withRepeat(withSequence(withTiming(1.05, { duration: 800 }), withTiming(1, { duration: 800 })), -1);
      } else {
        pulse.value = 1;
      }
    }
  }, [isVisible, mission?.prep_completed_at]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    backgroundColor: mission?.prep_completed_at ? '#f0fdf4' : '#fffbeb',
    borderColor: mission?.prep_completed_at ? '#02844F' : '#fbbf24',
  }));

  const updateStatus = async (status: string) => {
    setIsLoading(true);
    const updates: any = { status };
    if (status === 'DELIVERED') updates.delivered_at = new Date().toISOString();
    if (status === 'PICKED_UP') updates.picked_up_at = new Date().toISOString();
    
    const { error } = await supabase.from('orders').update(updates).eq('id', mission.id);
    if (!error) {
      onUpdate();
      if (status === 'DELIVERED') onClose();
    }
    setIsLoading(false);
  };

  const navigate = () => {
    const isPostPickup = ['PICKED_UP', 'ARRIVED_CUSTOMER'].includes(mission.status);
    const target = isPostPickup ? mission.address : mission.restaurant;
    if (!target) return;
    Linking.openURL(`google.navigation:q=${target.lat},${target.long}`);
  };

  if (!mission) return null;

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View>
              <Text style={styles.missionId}>ID: #{mission.id.slice(0, 8).toUpperCase()}</Text>
              <Text style={styles.payout}>₹15.00 Payout Estimate</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X color="#000" size={24} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
            {/* Status Radar */}
            <Animated.View style={[styles.radar, pulseStyle]}>
              <Text style={[styles.radarLabel, { color: mission.prep_completed_at ? '#02844F' : '#d97706' }]}>
                {mission.prep_completed_at ? 'PLEASE COLLECT' : 'WAIT OUTSIDE'}
              </Text>
              <Text style={styles.radarSub}>
                {mission.prep_completed_at ? 'Kitchen marked "Mission Ready"' : 'Kitchen is currently preparing order'}
              </Text>
            </Animated.View>

            {/* Navigation & Contacts */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>The Mission Path</Text>
              
              <View style={styles.pathNode}>
                <View style={[styles.nodeIcon, { backgroundColor: '#e8f5e9' }]}>
                  <MapPin color="#02844F" size={16} />
                </View>
                <View style={styles.nodeText}>
                  <Text style={styles.nodeTitle}>{mission.restaurant?.name}</Text>
                  <Text style={styles.nodeSub}>{mission.restaurant?.address}</Text>
                </View>
              </View>

              <View style={[styles.pathLine, { backgroundColor: mission.status === 'ACCEPTED' ? '#f3f4f6' : '#02844F' }]} />

              <View style={styles.pathNode}>
                <View style={[styles.nodeIcon, { backgroundColor: '#f3f4f6' }]}>
                  <Navigation2 color="#9ca3af" size={16} />
                </View>
                <View style={styles.nodeText}>
                  <Text style={styles.nodeTitle}>Customer Destination</Text>
                  <Text style={styles.nodeSub}>{mission.address?.address_line}</Text>
                </View>
              </View>

              <View style={styles.actionRow}>
                <TouchableOpacity onPress={navigate} style={styles.navLink}>
                  <Navigation2 color="#02844F" size={18} />
                  <Text style={styles.navLinkText}>NAVIGATE MISSION</Text>
                </TouchableOpacity>
                <View style={styles.contactGroup}>
                  <TouchableOpacity style={styles.contactBtn}><Phone color="#666" size={18} /></TouchableOpacity>
                  <TouchableOpacity style={styles.contactBtn}><MessageCircle color="#666" size={18} /></TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Logic Controls */}
            <View style={styles.footer}>
              {mission.status === 'ACCEPTED' && (
                <TouchableOpacity 
                   disabled={isLoading}
                   onPress={() => updateStatus('READY')}
                   style={styles.primaryBtn}
                >
                  {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>I HAVE ARRIVED AT STORE</Text>}
                </TouchableOpacity>
              )}

              {mission.status === 'READY' && mission.prep_completed_at && (
                <TouchableOpacity 
                   disabled={isLoading}
                   onPress={() => updateStatus('PICKED_UP')}
                   style={[styles.primaryBtn, { backgroundColor: '#000' }]}
                >
                  {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>ORDER COLLECTED</Text>}
                </TouchableOpacity>
              )}

              {mission.status === 'PICKED_UP' && (
                 <TouchableOpacity 
                    disabled={isLoading}
                    onPress={() => updateStatus('ARRIVED_CUSTOMER')}
                    style={styles.primaryBtn}
                 >
                   <Text style={styles.btnText}>I HAVE ARRIVED AT CUSTOMER</Text>
                 </TouchableOpacity>
              )}

              {mission.status === 'ARRIVED_CUSTOMER' && (
                 <TouchableOpacity 
                    disabled={isLoading}
                    onPress={() => updateStatus('DELIVERED')}
                    style={styles.primaryBtn}
                 >
                   {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>COMPLETE MISSION</Text>}
                 </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  content: { backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, height: '85%' },
  handle: { width: 40, height: 4, backgroundColor: '#e5e7eb', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  missionId: { fontSize: 11, fontWeight: '900', color: '#9ca3af', letterSpacing: 1 },
  payout: { fontSize: 18, fontWeight: '900', color: '#000', marginTop: 4 },
  closeBtn: { padding: 4 },
  scroll: { paddingBottom: 60 },
  radar: { padding: 24, borderRadius: 20, borderWidth: 1, alignItems: 'center', marginBottom: 24 },
  radarLabel: { fontSize: 24, fontWeight: '900', fontStyle: 'italic', letterSpacing: -0.5 },
  radarSub: { fontSize: 12, color: '#6b7280', fontWeight: '700', marginTop: 4, textAlign: 'center' },
  section: { marginBottom: 30 },
  sectionLabel: { fontSize: 10, fontWeight: '900', color: '#9ca3af', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 20 },
  pathNode: { flexDirection: 'row', gap: 16 },
  nodeIcon: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  nodeText: { flex: 1 },
  nodeTitle: { fontSize: 15, fontWeight: '900', color: '#000' },
  nodeSub: { fontSize: 12, color: '#6b7280', marginTop: 2, fontWeight: '600' },
  pathLine: { width: 2, height: 30, marginLeft: 17, marginVertical: 4 },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, paddingTop: 20, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  navLink: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  navLinkText: { fontSize: 13, fontWeight: '900', color: '#02844F', letterSpacing: 0.5 },
  contactGroup: { flexDirection: 'row', gap: 12 },
  contactBtn: { width: 40, height: 40, backgroundColor: '#f9fafb', borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#f3f4f6' },
  footer: { marginTop: 'auto' },
  primaryBtn: { height: 64, backgroundColor: '#02844F', borderRadius: 20, justifyContent: 'center', alignItems: 'center', elevation: 2 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
  otpBox: { gap: 16 },
  otpHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  otpTitle: { fontSize: 11, fontWeight: '900', color: '#02844F', letterSpacing: 1 },
  otpInput: { height: 70, backgroundColor: '#f9fafb', borderRadius: 20, textAlign: 'center', fontSize: 24, fontWeight: '900', color: '#000', borderWidth: 1, borderColor: '#f3f4f6' }
});
