import React, { useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, Image, Platform, Modal, TextInput,
  ActivityIndicator, Alert, StatusBar
} from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useAddress } from '../context/AddressContext';
import { supabase } from '../lib/supabase';

const BRAND_GREEN = '#02844F';
const TEXT_DARK = '#0D3D3D';
const TEXT_MUTED = '#6B7280';
const BG_LIGHT = '#F4F7F7'; // Subtle texture-like light background

const AVATAR_MAP: any = {
  cool_rider: require('../../assets/cool_rider.png'),
  kadak_chai: require('../../assets/kadak_chai.png'),
  sizzling_samosa: require('../../assets/sizzling_samosa.png'),
  swagger_sandwich: require('../../assets/swagger_sandwich.png'),
};

const ProfileScreen = ({ navigation }: any) => {
  const { user, signOut } = useAuth();
  const { addresses, deleteAddress, updateAddress: editAddrInContext } = useAddress();
  const insets = useSafeAreaInsets();
  const { width } = React.useMemo(() => ({ width: 400 }), []); // Mock or just use Dimensions

  // States
  const [passModal, setPassModal] = useState(false);
  const [infoModal, setInfoModal] = useState<any>(null);
  const [addressModal, setAddressModal] = useState(false);
  const [editAddressData, setEditAddressData] = useState<any>(null);

  const [oldPassInput, setOldPassInput] = useState('');
  const [newPassInput, setNewPassInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    await signOut();
    navigation.reset({ index: 0, routes: [{ name: 'Onboarding' }] });
  };

  const updatePassword = async () => {
    if (!oldPassInput || !newPassInput) {
      Alert.alert('Missing Info', 'Please fill all fields.');
      return;
    }
    if (oldPassInput !== user?.password) {
      Alert.alert('Incorrect', 'Old password does not match.');
      return;
    }
    if (newPassInput.length < 6) {
      Alert.alert('Try Again', 'Password must be at least 6 characters.');
      return;
    }
    
    setLoading(true);
    try {
      const { error } = await supabase.from('users').update({ password: newPassInput }).eq('id', user?.id);
      if (error) throw error;
      Alert.alert('Success', 'Password updated successfully!');
      setPassModal(false);
      setOldPassInput('');
      setNewPassInput('');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditAddress = (addr: any) => {
    setEditAddressData(addr);
  };

  const confirmDeleteAddress = (id: string) => {
    Alert.alert('Delete Address', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteAddress(id) }
    ]);
  };

  const ProfileCard = ({ icon, title, subtitle, onPress, iconBg, iconColor, iconType = 'Feather' }: any) => {
    const IconComponent = iconType === 'Feather' ? Feather : iconType === 'Ionicons' ? Ionicons : MaterialIcons;
    return (
      <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
        <View style={[styles.cardIconBox, { backgroundColor: iconBg }]}>
          <IconComponent name={icon} size={22} color={iconColor} />
        </View>
        <View style={styles.cardTextContent}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardSubtitle}>{subtitle}</Text>
        </View>
        <Feather name="chevron-right" size={20} color="#D1D5DB" />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.mainContainer}>
      <StatusBar barStyle="dark-content" />

      {/* Header Bar with Back Button */}
      <View style={[styles.headerBar, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.backCircle} onPress={() => navigation.navigate('Home')}>
          <Feather name="arrow-left" size={22} color={TEXT_DARK} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* Profile Info Card (White with round corners) */}
        <View style={styles.profileInfoCard}>
          <View style={styles.avatarWrapper}>
            <View style={styles.avatarBorder}>
              {user?.avatar_url ? (
                <Image source={AVATAR_MAP[user.avatar_url]} style={styles.avatarImg} />
              ) : (
                <Feather name="user" size={40} color={BRAND_GREEN} />
              )}
            </View>
            {/* Simple Status Dot like in image */}
            <View style={styles.statusDot} />
          </View>
          <View style={styles.nameDetails}>
            <Text style={styles.userNameText}>{user?.name || 'Aayush singh'}</Text>
            <Text style={styles.userSubText}>{user?.email || 'meeraayush@gmail.com'}</Text>
            <Text style={styles.userSubText}>+91 {user?.phone?.replace('+91', '') || '8921761269'}</Text>
          </View>
        </View>

        {/* ACCOUNT SECTION */}
        <View style={styles.sectionWrapper}>
          <Text style={styles.sectionHeader}>ACCOUNT SETTINGS</Text>
          <ProfileCard
            icon="map-pin"
            title="Your Address"
            subtitle="Saved delivery spots"
            iconBg="#E6F4F1"
            iconColor="#0D8C73"
            onPress={() => setAddressModal(true)}
          />
          <ProfileCard
            icon="inbox"
            title="Orders"
            subtitle="History & Track orders"
            iconBg="#E6F0F9"
            iconColor="#2D7BC1"
            onPress={() => navigation.navigate('OrdersList')}
          />
          <ProfileCard
            icon="lock"
            title="Account Setting"
            subtitle="Change your password"
            iconBg="#F0EEF9"
            iconColor="#6C63FF"
            onPress={() => setPassModal(true)}
          />
        </View>

        {/* SUPPORT SECTION */}
        <View style={styles.sectionWrapper}>
          <Text style={styles.sectionHeader}>HELP & SUPPORT</Text>
          <ProfileCard
            icon="help-circle"
            title="Help and Support"
            subtitle="FAQs, returns & chat"
            iconBg="#FEF7E6"
            iconColor="#D99E2B"
            onPress={() => setInfoModal({ title: 'Support', text: 'Reach us at support@bitezy.in or call +91 98765-XXXXX. We are here 24/7!' })}
          />
          <ProfileCard
            icon="info"
            title="About Bitezy"
            subtitle="Version, terms & privacy"
            iconBg="#F3F4F6"
            iconColor="#4B5563"
            onPress={() => setInfoModal({ 
              title: 'About Bitezy', 
              text: 'Bitezy is your 10-minute pass to the city’s best flavors. We bring the heat, the crunch, and the sweet to your doorstep faster than a group chat drama. ⚡🍰\n\nVersion 1.1.0 (Production Ready)' 
            })}
          />
          <ProfileCard
            icon="description"
            title="Terms of Service"
            subtitle="The Bitezy legal basics"
            iconBg="#EEF2FF"
            iconColor="#4F46E5"
            iconType="MaterialIcons"
            onPress={() => setInfoModal({ 
              title: 'Terms of Service', 
              text: 'Welcome to Bitezy! By using our app, you agree to:\n\n1. Be 100% hyped for your delivery.\n2. Understand that "10 minutes" is our goal, not a legally binding contract (traffic is real, fam!).\n3. Keep your pin accurate—we aren\'t mind readers yet.\n4. No refunds for "I ordered too much and fell into a food coma."\n\nFull legal jargon available on our website!' 
            })}
          />
        </View>

        {/* LOGOUT BUTTON */}
        <TouchableOpacity style={styles.logoutBigBtn} onPress={handleLogout}>
          <MaterialIcons name="logout" size={22} color="#C53030" />
          <Text style={styles.logoutBigText}>LOGOUT</Text>
        </TouchableOpacity>

        <View style={styles.footerBranding}>
          <Text style={styles.footerMotto}>DELIVERING SNACKS & SMILES SINCE 2026</Text>
        </View>

      </ScrollView>

      {/* --- INFO MODAL --- */}
      <Modal animationType="fade" transparent visible={!!infoModal} onRequestClose={() => setInfoModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{infoModal?.title}</Text>
            <Text style={styles.modalText}>{infoModal?.text}</Text>
            <TouchableOpacity style={styles.modalClose} onPress={() => setInfoModal(null)}>
              <Text style={styles.modalCloseText}>CLOSE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* --- PASS MODAL --- */}
      <Modal animationType="slide" transparent visible={passModal} onRequestClose={() => setPassModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.passModalContent}>
            <View style={styles.passHeader}>
              <Text style={styles.modalTitle}>Change Password</Text>
              <TouchableOpacity onPress={() => setPassModal(false)}>
                <Feather name="x" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>
            <Text style={styles.passSub}>Ensure your security by verifying your identity.</Text>

            <View style={styles.inputWrap}>
              <Feather name="unlock" size={18} color="#94A3B8" />
              <TextInput
                style={styles.input}
                placeholder="Current Password"
                secureTextEntry
                value={oldPassInput}
                onChangeText={setOldPassInput}
              />
            </View>

            <View style={styles.inputWrap}>
              <Feather name="lock" size={18} color="#94A3B8" />
              <TextInput
                style={styles.input}
                placeholder="New Password (min 6 chars)"
                secureTextEntry
                value={newPassInput}
                onChangeText={setNewPassInput}
              />
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, loading && { opacity: 0.7 }]}
              onPress={updatePassword}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>SAVE PASSWORD</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* --- ADDRESS LIST MODAL --- */}
      <Modal animationType="slide" transparent visible={addressModal} onRequestClose={() => setAddressModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.addressModalContent}>
            <View style={styles.passHeader}>
              <Text style={styles.modalTitle}>Your Addresses</Text>
              <TouchableOpacity onPress={() => setAddressModal(false)}>
                <Feather name="x" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={{ maxHeight: 400 }}>
              {addresses.length === 0 ? (
                <Text style={styles.emptyAddrText}>No addresses saved yet.</Text>
              ) : (
                addresses.map((item) => (
                  <View key={item.id} style={styles.addrItem}>
                    <View style={styles.addrTextContainer}>
                      <Text style={styles.addrLabel}>{item.label}</Text>
                      <Text style={styles.addrLine} numberOfLines={1}>{item.address_line}</Text>
                    </View>
                    <View style={styles.addrActions}>
                      <TouchableOpacity 
                        style={styles.addrActionBtn} 
                        onPress={() => confirmDeleteAddress(item.id!)}
                      >
                        <Feather name="trash-2" size={16} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>

            {/* Add Address removed as requested */}
          </View>
        </View>
      </Modal>

    </View>
  );
};

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: BG_LIGHT },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9'
  },
  backCircle: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center'
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: TEXT_DARK },
  scrollContent: { paddingBottom: 60 },

  // Profile Info Card
  profileInfoCard: {
    backgroundColor: '#FFF',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 10, elevation: 2,
    marginBottom: 10
  },
  avatarWrapper: { position: 'relative' },
  avatarBorder: {
    width: 70, height: 70, borderRadius: 35,
    borderWidth: 2, borderColor: '#E5E7EB',
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#F3F4F6', overflow: 'hidden'
  },
  avatarImg: { width: '85%', height: '85%', resizeMode: 'contain' },
  statusDot: {
    position: 'absolute', bottom: 5, right: 5,
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: '#10B981', borderWidth: 2, borderColor: '#FFF'
  },
  nameDetails: { marginLeft: 16, flex: 1 },
  userNameText: { fontSize: 20, fontWeight: '900', color: TEXT_DARK, marginBottom: 2 },
  userSubText: { fontSize: 13, fontWeight: '600', color: '#6B7280', marginBottom: 1 },

  // Sections
  sectionWrapper: { paddingHorizontal: 20, marginBottom: 14 },
  sectionHeader: { fontSize: 16, fontWeight: '900', color: TEXT_DARK, marginBottom: 8, marginLeft: 4 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 1,
    borderWidth: 1, borderColor: '#F9FAFB'
  },
  cardIconBox: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  cardTextContent: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: TEXT_DARK, marginBottom: 2 },
  cardSubtitle: { fontSize: 12, fontWeight: '600', color: TEXT_MUTED },

  // Logout
  logoutBigBtn: {
    backgroundColor: '#FFF',
    marginHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 1
  },
  logoutBigText: { marginLeft: 8, fontSize: 16, fontWeight: '900', color: '#C53030' },

  // Branding
  footerBranding: { marginTop: 15, alignItems: 'center' },
  footerBrandName: { fontSize: 26, fontWeight: '900', color: '#D1D5DB', letterSpacing: 2 },
  footerMotto: { fontSize: 9, fontWeight: '800', color: '#CBD5E1', marginTop: 4, letterSpacing: 0.5 },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '100%', backgroundColor: '#FFF', borderRadius: 24, padding: 30, alignItems: 'center' },
  modalTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A', marginBottom: 15 },
  modalText: { fontSize: 15, fontWeight: '600', color: '#64748B', textAlign: 'left', lineHeight: 22, marginBottom: 25 },
  modalClose: { backgroundColor: BRAND_GREEN, paddingHorizontal: 30, paddingVertical: 12, borderRadius: 12 },
  modalCloseText: { color: '#FFF', fontWeight: '800', fontSize: 14 },

  passModalContent: { width: '100%', backgroundColor: '#FFF', borderRadius: 24, padding: 25 },
  passHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  passSub: { fontSize: 13, fontWeight: '600', color: '#64748B', marginBottom: 20, lineHeight: 20 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F8FAFA', borderRadius: 16,
    borderWidth: 1, borderColor: '#E2E8F0',
    paddingHorizontal: 15, height: 56, marginBottom: 20
  },
  input: { flex: 1, marginLeft: 12, fontSize: 15, fontWeight: '600', color: '#0F172A' },
  saveBtn: { backgroundColor: BRAND_GREEN, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  saveBtnText: { color: '#FFF', fontSize: 15, fontWeight: '900', letterSpacing: 0.5 },

  // Address Modal
  addressModalContent: { width: '100%', backgroundColor: '#FFF', borderRadius: 24, padding: 25 },
  emptyAddrText: { textAlign: 'center', color: '#64748B', marginVertical: 30, fontWeight: '600' },
  addrItem: { 
    flexDirection: 'row', alignItems: 'center', 
    paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' 
  },
  addrTextContainer: { flex: 1 },
  addrLabel: { fontSize: 15, fontWeight: '800', color: '#1E293B', marginBottom: 2 },
  addrLine: { fontSize: 13, color: '#64748B', fontWeight: '500' },
  addrActions: { flexDirection: 'row', alignItems: 'center' },
  addrActionBtn: { padding: 8, marginLeft: 5 },
  addNewAddrBtn: { 
    marginTop: 20, backgroundColor: '#F0FDF4', 
    paddingVertical: 15, borderRadius: 16, alignItems: 'center',
    borderWidth: 1, borderColor: '#DCFCE7'
  },
  addNewAddrText: { color: BRAND_GREEN, fontWeight: '900', fontSize: 14 },
});

export default ProfileScreen;