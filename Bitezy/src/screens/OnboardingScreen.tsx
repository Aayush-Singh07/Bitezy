import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, KeyboardAvoidingView, ScrollView,
  Platform, StatusBar, Animated, Image, Modal, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

const BRAND = '#02844F';
const LIGHT_BG = '#F5F7F6';
type Mode = 'login' | 'signup';

const AVATARS = [
  { id: 'cool_rider', name: 'Cool Rider', img: require('../../assets/cool_rider.png') },
  { id: 'kadak_chai', name: 'Kadak Chai', img: require('../../assets/kadak_chai.png') },
  { id: 'sizzling_samosa', name: 'Sizzling Samosa', img: require('../../assets/sizzling_samosa.png') },
  { id: 'swagger_sandwich', name: 'Swagger Sandwich', img: require('../../assets/swagger_sandwich.png') },
];

const toE164 = (raw: string) => {
  const d = raw.replace(/\D/g, '');
  if (d.startsWith('91') && d.length === 12) return `+${d}`;
  if (d.length === 10) return `+91${d}`;
  return `+${d}`;
};

const FieldError = ({ msg }: { msg: string }) =>
  msg ? <Text style={s.fieldError}>{msg}</Text> : null;

export default function OnboardingScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();

  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[0].id);
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const emailRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const passRef = useRef<TextInput>(null);

  const clearErrors = () => setErrors({});
  const setError = (field: string, msg: string) => setErrors(prev => ({ ...prev, [field]: msg }));

  const toggleMode = () => {
    setMode(prev => prev === 'login' ? 'signup' : 'login');
    clearErrors();
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    const digits = phone.replace(/\D/g, '');
    if (mode === 'signup') {
      if (name.trim().length < 2) newErrors.name = 'Enter your full name';
      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRe.test(email.trim())) newErrors.email = 'Enter a valid email address';
    }
    if (digits.length !== 10) newErrors.phone = 'Enter a valid 10-digit mobile number';
    if (password.length < 6) newErrors.password = 'Password must be at least 6 characters';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const registerForPushNotificationsAsync = async (userId: string) => {
    if (Platform.OS === 'web') return;

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        console.warn('Failed to get push token for push notification!');
        return;
      }
      
      const token = (await Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig?.extra?.eas?.projectId || '75685691-6c78-426d-a242-620921eca0e2',
      })).data;

      // Save token to Supabase
      await supabase.from('users').update({ expo_push_token: token }).eq('id', userId);
    }
  };

  const handleAuth = async () => {
    if (!validate()) return;
    setLoading(true);
    const formatted = toE164(phone);
    try {
      if (mode === 'signup') {
        const { data: byPhone } = await supabase.from('users').select('id').eq('phone', formatted).maybeSingle();
        if (byPhone) { setError('phone', 'This number is already registered'); setLoading(false); return; }
        const { data: byEmail } = await supabase.from('users').select('id').eq('email', email.trim().toLowerCase()).maybeSingle();
        if (byEmail) { setError('email', 'This email is already registered'); setLoading(false); return; }
        const { data, error } = await supabase.from('users').insert({
          phone: formatted, 
          password, 
          name: name.trim(), 
          email: email.trim().toLowerCase(),
          avatar_url: selectedAvatar
        }).select().single();
        if (error) throw error;
        await registerForPushNotificationsAsync(data.id);
        await signIn(data);
        navigation.replace('Home', { promptAddress: true });
      } else {
        const { data: userByPhone } = await supabase.from('users').select('*').eq('phone', formatted).maybeSingle();
        if (!userByPhone) { setError('phone', 'No account found with this number'); setLoading(false); return; }
        if (userByPhone.password !== password) { setError('password', 'Incorrect password'); setLoading(false); return; }
        await registerForPushNotificationsAsync(userByPhone.id);
        await signIn(userByPhone);
        navigation.replace('Home', { promptAddress: true });
      }
    } catch (e: any) {
      setError('general', e?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPass = async () => {
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(forgotEmail.trim())) {
      Alert.alert("Error", "Please enter a valid email address.");
      return;
    }

    setForgotLoading(true);
    try {
      // 1. Check if email exists in 'users' table
      const { data, error } = await supabase
        .from('users')
        .select('name, email, password')
        .eq('email', forgotEmail.trim().toLowerCase())
        .maybeSingle();
      
      if (error) throw error;
      if (!data) {
        Alert.alert("Error", "No account found with this email. Are you sure you're one of us?");
        return;
      }

      // 2. Call Supabase Edge Function to send password
      const { data: funcData, error: funcError } = await supabase.functions.invoke('reset-password', {
        body: { email: data.email, name: data.name, password: data.password }
      });

      if (funcError) {
        // If the Edge Function returns a non-200 status, funcError will be populated
        const errMsg = funcError?.message || "Function error";
        console.error("Forgot Password Error:", funcError);
        Alert.alert("Error", `Major L! ${errMsg}. Double check that API key, fam.`);
        return;
      }

      // Check if Resend itself returned an error (for some SDK versions, funcError might be null for 400s)
      if (funcData?.error) {
        const detail = funcData.error?.message || JSON.stringify(funcData.error);
        Alert.alert("Error from Email Service", `Resend says: ${detail}. Most common is wrong API Key or trying to send to a non-verified email.`);
        return;
      }

      Alert.alert("Success! 📬", "Memory glitch? No worries, your password is sliding into your inbox with some Bitezy love.");
      setShowForgotModal(false);
      setForgotEmail('');
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Something went wrong! Please try again.");
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={LIGHT_BG} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={[s.inner, { paddingTop: insets.top + (mode === 'signup' ? 5 : 20), paddingBottom: insets.bottom + 20 }]}>
            
            {/* Bitten Logo — Only shown in LOGIN mode to save vertical space in SIGNUP mode */}
            {mode === 'login' && (
              <View style={s.logoContainer}>
                <View style={s.logoTextWrapper}>
                  <Text style={s.logoText}>Bitezy</Text>
                  <View style={s.biteMark} />
                </View>
                <Text style={s.logoTagline}>Bite in seconds</Text>
              </View>
            )}

            {/* Header Text */}
            <View style={[s.headerBox, mode === 'signup' && { marginBottom: 30 }]}>
               <Text style={s.titleText}>{mode === 'login' ? 'Welcome back' : 'Hangry yet?'}</Text>
               <Text style={s.subtitleText}>{mode === 'login' ? 'Ready for round two?' : "Let's secure the snacks"}</Text>
            </View>

            {/* Form Section */}
            <View style={s.formBox}>
              {mode === 'signup' && (
                <>
                  <Text style={s.fieldLabel}>CHOOSE YOUR CHARACTER</Text>
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false} 
                    style={{ marginBottom: 25 }}
                    contentContainerStyle={{ paddingBottom: 10 }}
                  >
                    {AVATARS.map((item) => (
                      <TouchableOpacity 
                        key={item.id} 
                        style={[s.avatarItem, selectedAvatar === item.id && s.avatarSelected]}
                        onPress={() => setSelectedAvatar(item.id)}
                      >
                        <Image source={item.img} style={s.avatarImg} />
                        {selectedAvatar === item.id && (
                          <View style={s.checked}>
                            <Ionicons name="checkmark-circle" size={18} color={BRAND} />
                          </View>
                        )}
                        <Text style={[s.avatarLabel, selectedAvatar === item.id && { color: BRAND }]}>{item.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  <Text style={s.fieldLabel}>FULL NAME</Text>
                  <View style={[s.inputWrap, errors.name && s.inputError]}>
                    <Feather name="user" size={18} color="#94A3B8" />
                    <TextInput 
                      style={s.input} 
                      placeholder="Enter your full name" 
                      placeholderTextColor="#CBD5E1" 
                      value={name} 
                      onChangeText={t => {setName(t); setError('name', '');}}
                      onSubmitEditing={() => emailRef.current?.focus()}
                    />
                  </View>
                  <FieldError msg={errors.name} />

                  <Text style={s.fieldLabel}>EMAIL ADDRESS</Text>
                  <View style={[s.inputWrap, errors.email && s.inputError]}>
                    <Feather name="mail" size={18} color="#94A3B8" />
                    <TextInput 
                      ref={emailRef}
                      style={s.input} 
                      placeholder="Enter your email address" 
                      placeholderTextColor="#CBD5E1" 
                      autoCapitalize="none"
                      keyboardType="email-address"
                      value={email} 
                      onChangeText={t => {setEmail(t); setError('email', '');}}
                      onSubmitEditing={() => phoneRef.current?.focus()}
                    />
                  </View>
                  <FieldError msg={errors.email} />
                </>
              )}

              <Text style={s.fieldLabel}>MOBILE NUMBER</Text>
              <View style={[s.inputWrap, errors.phone && s.inputError]}>
                <Feather name="phone" size={18} color="#94A3B8" />
                <Text style={s.prefix}>+91</Text>
                <TextInput 
                  ref={phoneRef}
                  style={s.input} 
                  placeholder="Enter your mobile number" 
                  placeholderTextColor="#CBD5E1" 
                  keyboardType="phone-pad"
                  maxLength={10}
                  value={phone} 
                  onChangeText={t => {setPhone(t); setError('phone', '');}}
                  onSubmitEditing={() => passRef.current?.focus()}
                />
              </View>
              <FieldError msg={errors.phone} />

              <Text style={s.fieldLabel}>PASSWORD</Text>
              <View style={[s.inputWrap, errors.password && s.inputError]}>
                <Feather name="lock" size={18} color="#94A3B8" />
                <TextInput 
                  ref={passRef}
                  style={s.input} 
                  placeholder="••••••••" 
                  placeholderTextColor="#CBD5E1" 
                  secureTextEntry={!showPass}
                  value={password} 
                  onChangeText={t => {setPassword(t); setError('password', '');}}
                />
                <TouchableOpacity onPress={() => setShowPass(!showPass)}>
                   <Feather name={showPass ? 'eye' : 'eye-off'} size={18} color="#CBD5E1" />
                </TouchableOpacity>
              </View>
              <FieldError msg={errors.password} />

              {mode === 'login' && (
                <TouchableOpacity 
                  style={s.forgotBtn} 
                  onPress={() => setShowForgotModal(true)}
                >
                  <Text style={s.forgotText}>Forgot Password?</Text>
                </TouchableOpacity>
              )}

              {/* General Error */}
              {errors.general && <Text style={s.generalError}>{errors.general}</Text>}

              {/* CTA Button */}
              <TouchableOpacity 
                style={[s.mainBtn, loading && {opacity: 0.8}]} 
                activeOpacity={0.9} 
                onPress={handleAuth}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="#FFF" /> : <Text style={s.mainBtnText}>{mode === 'login' ? 'SIGN IN' : 'CREATE ACCOUNT'}</Text>}
              </TouchableOpacity>



              {/* Switch Mode */}
              <TouchableOpacity style={s.switchModeBtn} onPress={toggleMode}>
                 <Text style={s.switchModeText}>
                   {mode === 'login' ? "Don't have an account? " : "Already have an account? "}
                   <Text style={{color: BRAND, fontWeight: '700'}}>{mode === 'login' ? 'Sign Up' : 'Sign In'}</Text>
                 </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Forgot Password Modal */}
      <Modal
        visible={showForgotModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowForgotModal(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Forgot Password?</Text>
              <TouchableOpacity onPress={() => setShowForgotModal(false)}>
                <Ionicons name="close" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>
            
            <Text style={s.modalSubtitle}>
              Memory glitch? Hunger is a real brain drain.
            </Text>

            <View style={s.inputWrap}>
              <Feather name="mail" size={18} color="#94A3B8" />
              <TextInput 
                style={s.input} 
                placeholder="Enter your email" 
                placeholderTextColor="#CBD5E1" 
                autoCapitalize="none"
                keyboardType="email-address"
                value={forgotEmail} 
                onChangeText={setForgotEmail}
              />
            </View>

            <TouchableOpacity 
              style={[s.mainBtn, forgotLoading && {opacity: 0.8}, {marginTop: 10}]} 
              activeOpacity={0.9} 
              onPress={handleForgotPass}
              disabled={forgotLoading}
            >
              {forgotLoading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={s.mainBtnText}>SEND PASSWORD</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: LIGHT_BG },
  scroll: { flexGrow: 1 },
  inner: { flex: 1, paddingHorizontal: 32 },

  logoContainer: { alignItems: 'center', marginBottom: 15 },
  logoTextWrapper: { position: 'relative' },
  logoText: { fontSize: 82, fontWeight: '900', color: BRAND, letterSpacing: -4 },
  
  // The bite mark! A circle with bg color that overlays the B
  biteMark: {
    position: 'absolute',
    top: 18,
    left: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: LIGHT_BG,
    zIndex: 1,
  },
  
  logoTagline: { fontSize: 20, color: '#64748B', fontWeight: '800', marginTop: 2 },

  headerBox: { alignItems: 'center', marginBottom: 20 },
  titleText: { fontSize: 32, fontWeight: '900', color: '#1E293B', textAlign: 'center' },
  subtitleText: { fontSize: 20, fontWeight: '700', color: BRAND, marginTop: 4, textAlign: 'center' },

  formBox: { width: '100%' },
  fieldLabel: { fontSize: 11, fontWeight: '900', color: '#94A3B8', marginBottom: 10, letterSpacing: 1 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', 
    backgroundColor: '#FFF', borderRadius: 16, 
    borderWidth: 1.5, borderColor: '#EDF2F1', 
    paddingHorizontal: 20, height: 60, marginBottom: 6
  },
  inputError: { borderColor: '#FECACA' },
  prefix: { fontSize: 16, fontWeight: '700', color: '#1E293B', marginLeft: 10, marginRight: 2 },
  input: { flex: 1, height: '100%', marginLeft: 12, fontSize: 16, color: '#1E293B', fontWeight: '600' },
  
  fieldError: { fontSize: 11, color: '#EF4444', marginTop: 2, marginBottom: 16, marginLeft: 6, fontWeight: '600' },
  generalError: { color: '#EF4444', textAlign: 'center', marginBottom: 15, fontWeight: '600' },

  mainBtn: { 
    backgroundColor: BRAND, height: 60, borderRadius: 16, 
    alignItems: 'center', justifyContent: 'center', 
    marginTop: 20, 
    ...Platform.select({
      ios: { shadowColor: BRAND, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 12 },
      android: { elevation: 6 },
      web: { boxShadow: `0px 8px 12px ${BRAND}40` }
    })
  },
  mainBtnText: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 1 },

  signupTaglineRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 25 },
  signupTaglineText: { fontSize: 14, fontWeight: '800', color: '#444', marginHorizontal: 8 },

  switchModeBtn: { marginTop: 18, alignItems: 'center', paddingBottom: 40 },
  switchModeText: { fontSize: 15, color: '#64748B', fontWeight: '600' },

  avatarItem: { 
    alignItems: 'center', 
    marginRight: 16, 
    width: 90, 
    height: 110, 
    borderRadius: 20, 
    backgroundColor: '#FFF', 
    padding: 10,
    borderWidth: 2,
    borderColor: 'transparent'
  },
  avatarSelected: { borderColor: BRAND, backgroundColor: '#F0FDF4' },
  avatarImg: { width: 60, height: 60, resizeMode: 'contain' },
  avatarLabel: { fontSize: 10, fontWeight: '800', color: '#94A3B8', marginTop: 8, textAlign: 'center' },
  checked: { position: 'absolute', top: 5, right: 5 },

  forgotBtn: { alignSelf: 'flex-end', marginTop: 8, paddingVertical: 4 },
  forgotText: { color: BRAND, fontWeight: '700', fontSize: 13 },

  modalOverlay: { 
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', 
    justifyContent: 'center', alignItems: 'center', padding: 24 
  },
  modalCard: { 
    backgroundColor: '#FFF', width: '100%', borderRadius: 24, padding: 24,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20 },
      android: { elevation: 10 },
      web: { boxShadow: '0px 10px 20px rgba(0,0,0,0.1)' }
    })
  },
  modalHeader: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 
  },
  modalTitle: { fontSize: 22, fontWeight: '900', color: '#1E293B' },
  modalSubtitle: { fontSize: 14, color: '#64748B', fontWeight: '600', lineHeight: 20, marginBottom: 20 },
});
