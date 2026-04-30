import React from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  Image, Dimensions, Pressable, Platform
} from 'react-native';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');
const BRAND_GREEN = '#02844F';

interface RestaurantDetailModalProps {
  visible: boolean;
  onClose: () => void;
  restaurant: any;
  isOpen: boolean;
  isManualOpen: boolean;
}

const formatTime = (t: string | null | undefined): string => {
  if (!t) return '';
  const [hStr, mStr] = t.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12} ${ampm}` : `${h12}:${mStr} ${ampm}`;
};

const RestaurantDetailModal = ({ visible, onClose, restaurant, isOpen, isManualOpen }: RestaurantDetailModalProps) => {
  if (!restaurant) return null;

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.dismiss} onPress={onClose} />
        <View style={styles.content}>
          <View style={styles.modalHeader}>
            <View style={styles.nameRow}>
              <Text style={styles.heroName}>{restaurant.name.toUpperCase()}</Text>
            </View>

            <View style={styles.badgeRow}>
              <View style={styles.statusPill}>
                <View style={[styles.statusDot, { backgroundColor: isOpen ? '#4ADE80' : '#F87171' }]} />
                <Text style={styles.statusPillText}>{isOpen ? 'OPEN' : !isManualOpen ? 'OPENING SOON' : 'CLOSED'}</Text>
              </View>
              <View style={styles.heroBadge}>
                <Ionicons name="shield-checkmark" size={10} color="#FFF" style={{ marginRight: 4 }} />
                <Text style={styles.heroBadgeText}>BITEZY VERIFIED</Text>
              </View>
            </View>
          </View>

          <View style={styles.body}>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <MaterialCommunityIcons name="clock-fast" size={18} color={BRAND_GREEN} />
                <Text style={styles.statValue}>10 MINS</Text>
                <Text style={styles.statLabel}>BAKE TIME</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Ionicons name="leaf" size={16} color={BRAND_GREEN} />
                <Text style={styles.statValue}>750M</Text>
                <Text style={styles.statLabel}>SNACK RADIUS</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <MaterialCommunityIcons name="shield-check" size={18} color={BRAND_GREEN} />
                <Text style={styles.statValue}>100%</Text>
                <Text style={styles.statLabel}>SAFETY SCORE</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <Feather name="clock" size={14} color="#64748B" />
              <Text style={styles.infoText}>
                Operational: {formatTime(restaurant.open_time)} - {formatTime(restaurant.close_time)}
              </Text>
            </View>

            <View style={styles.fssaiContainer}>
              <Image 
                source={{ uri: 'https://upload.wikimedia.org/wikipedia/en/thumb/0/09/FSSAI_logo.svg/1200px-FSSAI_logo.svg.png' }} 
                style={styles.fssaiLogo}
                resizeMode="contain"
              />
              <Text style={styles.fssaiText}>FSSAI Lic. No. 12224099000123</Text>
              <View style={styles.dot} />
              <Text style={styles.fssaiText}>BITEZY-ID: BZ-9821</Text>
            </View>

            <TouchableOpacity style={styles.actionBtn} onPress={onClose} activeOpacity={0.9}>
              <Text style={styles.actionBtnText}>SNACK NOW</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  dismiss: {
    flex: 1,
  },
  content: {
    backgroundColor: '#F8FAFC',
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    maxHeight: height * 0.9,
    overflow: 'hidden',
  },
  modalHeader: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
    marginRight: 8,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusPillText: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  heroBadge: {
    backgroundColor: BRAND_GREEN,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  heroBadgeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  heroName: {
    fontSize: 24,
    fontWeight: '900',
    color: '#1E293B',
    letterSpacing: -0.5,
    flex: 1,
    marginRight: 10,
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16, 
    alignItems: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderRadius: 16,
    paddingVertical: 15,
    paddingHorizontal: 15,
    marginBottom: 15,
    width: '100%',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: '50%',
    backgroundColor: '#F1F5F9',
    alignSelf: 'center',
  },
  statValue: {
    fontSize: 12,
    fontWeight: '900',
    color: '#1E293B',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: '#94A3B8',
    marginTop: 2,
    letterSpacing: 0.4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '700',
    marginLeft: 6,
  },
  fssaiContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 20,
    width: '100%',
    justifyContent: 'center',
  },
  fssaiLogo: {
    width: 30,
    height: 12,
    marginRight: 10,
    opacity: 0.8,
  },
  fssaiText: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '700',
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#CBD5E1',
    marginHorizontal: 8,
  },
  actionBtn: {
    backgroundColor: BRAND_GREEN,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    width: '100%',
    elevation: 2,
  },
  actionBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
});

export default RestaurantDetailModal;
