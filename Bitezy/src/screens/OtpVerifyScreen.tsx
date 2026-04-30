/**
 * OtpVerifyScreen.tsx — Bitezy
 *
 * Verifies phone SMS OTP via Supabase.
 * On signup success → saves name, phone, email to public.users.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, KeyboardAvoidingView,
  Platform, StatusBar, Animated, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

const { width: W } = Dimensions.get('window');
const BRAND      = '#02844F';
const OTP_LEN    = 6;
const RESEND_SEC = 30;
const BOX_W      = Math.floor((Math.min(W, 420) - 40 - 5 * 10) / 6);

export default function OtpVerifyScreen({ navigation, route }: any) {
  const { phone, mode, name, email } = route.params ?? {};
  const insets = useSafeAreaInsets();

  const [otp,       setOtp]       = useState<string[]>(Array(OTP_LEN).fill(''));
  const [loading,   setLoading]   = useState(false);
  const [resending, setResending] = useState(false);
  const [timer,     setTimer]     = useState(RESEND_SEC);

  const refs = useRef<Array<TextInput | null>>(Array(OTP_LEN).fill(null));

  // Scale animations per box
  const scales = useRef(
    Array(OTP_LEN).fill(0).map(() => new Animated.Value(1)),
  ).current;

  const bounce = (i: number) => {
    Animated.sequence([
      Animated.timing(scales[i], { toValue: 0.88, duration: 70,  useNativeDriver: true }),
      Animated.spring(scales[i],  { toValue: 1,   friction: 3,   useNativeDriver: true }),
    ]).start();
  };

  // Countdown
  useEffect(() => {
    if (timer <= 0) return;
    const id = setInterval(() => setTimer(t => Math.max(0, t - 1)), 1000);
    return () => clearInterval(id);
  }, [timer]);

  // Auto-focus first box
  useEffect(() => {
    const t = setTimeout(() => refs.current[0]?.focus(), 400);
    return () => clearTimeout(t);
  }, []);

  const handleChange = useCallback((val: string, idx: number) => {
    // Paste support
    if (val.length > 1) {
      const digits = val.replace(/\D/g, '').slice(0, OTP_LEN).split('');
      const next   = Array(OTP_LEN).fill('');
      digits.forEach((d, i) => { next[i] = d; });
      setOtp(next);
      refs.current[Math.min(digits.length, OTP_LEN) - 1]?.focus();
      return;
    }
    const d = val.replace(/\D/g, '');
    setOtp(prev => {
      const next = [...prev]; next[idx] = d; return next;
    });
    if (d) {
      bounce(idx);
      if (idx < OTP_LEN - 1) refs.current[idx + 1]?.focus();
    }
  }, []);

  const handleBackspace = useCallback((key: string, idx: number) => {
    if (key === 'Backspace' && !otp[idx] && idx > 0) {
      setOtp(prev => { const n = [...prev]; n[idx - 1] = ''; return n; });
      refs.current[idx - 1]?.focus();
    }
  }, [otp]);

  const handleVerify = useCallback(async () => {
    const token = otp.join('');
    if (token.length < OTP_LEN) {
      Alert.alert('Incomplete OTP', 'Please enter all 6 digits.');
      return;
    }
    setLoading(true);
    try {
      // Verify SMS OTP
      const { data, error } = await supabase.auth.verifyOtp({
        phone,
        token,
        type: 'sms',
      });
      if (error) throw error;

      // Update user profile and activity timestamp
      if (data.user) {
        await supabase.from('users').upsert({
          id:          data.user.id,
          name:        name  || undefined,
          email:       email || undefined,
          phone:       phone || undefined,
          last_active: new Date().toISOString(),
        }, { onConflict: 'id' });
      }

      navigation.replace('Splash');
    } catch (e: any) {
      const msg = (e?.message ?? '').toLowerCase();
      if (msg.includes('expired') || msg.includes('invalid') || msg.includes('token')) {
        Alert.alert('Wrong code', 'OTP is incorrect or expired. Tap Resend to get a new one.');
      } else {
        Alert.alert('Error', e?.message || 'Verification failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [otp, phone, mode, name, email, navigation]);

  const handleResend = async () => {
    setResending(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone });
      if (error) throw error;
      setTimer(RESEND_SEC);
      setOtp(Array(OTP_LEN).fill(''));
      refs.current[0]?.focus();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not resend OTP.');
    } finally {
      setResending(false);
    }
  };

  const filled = otp.filter(Boolean).length;
  const maskedPhone = phone
    ? `${phone.slice(0, 3)}XXXXX${phone.slice(-2)}`
    : '';

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF" />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[s.inner, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>

          {/* Back */}
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.back}>
            <Feather name="arrow-left" size={18} color="#333" />
          </TouchableOpacity>

          {/* Header */}
          <View style={s.header}>
            <Text style={s.title}>VERIFY NUMBER</Text>
            <Text style={s.sub}>
              We've sent a 6-digit verification code to <Text style={s.phoneText}>{maskedPhone}</Text>
            </Text>
          </View>

          {/* OTP boxes */}
          <View style={s.boxRow}>
            {otp.map((digit, i) => (
              <Animated.View key={i} style={{ transform: [{ scale: scales[i] }] }}>
                <TextInput
                  ref={r => { refs.current[i] = r; }}
                  style={[
                    s.box,
                    digit && s.boxFilled,
                    i === filled && s.boxActive,
                  ]}
                  value={digit}
                  onChangeText={v => handleChange(v, i)}
                  onKeyPress={({ nativeEvent }) => handleBackspace(nativeEvent.key, i)}
                  keyboardType="number-pad"
                  maxLength={OTP_LEN}
                  selectTextOnFocus
                  textAlign="center"
                  returnKeyType={i === OTP_LEN - 1 ? 'done' : 'next'}
                  onSubmitEditing={i === OTP_LEN - 1 ? handleVerify : undefined}
                />
              </Animated.View>
            ))}
          </View>

          {/* Verify button */}
          <TouchableOpacity
            style={[s.btn, filled < OTP_LEN && s.btnDim]}
            onPress={handleVerify}
            disabled={loading || filled < OTP_LEN}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={s.btnTxt}>CONTINUE</Text>
            )}
          </TouchableOpacity>

          {/* Resend */}
          <View style={s.resendRow}>
            {timer > 0 ? (
              <Text style={s.resendTimer}>
                Resend code in <Text style={s.resendBold}>{timer}s</Text>
              </Text>
            ) : (
              <TouchableOpacity onPress={handleResend} disabled={resending}>
                {resending
                  ? <ActivityIndicator size="small" color={BRAND} />
                  : <Text style={s.resendLink}>RESEND CODE</Text>}
              </TouchableOpacity>
            )}
          </View>

          {/* Wrong number */}
          <View style={s.footer}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={s.changeRow}>
              <Text style={s.changeTxt}>
                Wrong number? <Text style={s.changeLink}>Change</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root:  { flex: 1, backgroundColor: '#FFF' },
  inner: { flex: 1, paddingHorizontal: 28 },

  back: {
    width: 36, height: 36, borderRadius: 8,
    backgroundColor: '#F5F5F7',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 32,
  },

  header:    { marginBottom: 40 },
  title:     { fontSize: 13, fontWeight: '900', color: '#111', marginBottom: 8, letterSpacing: 0.5 },
  sub:       { fontSize: 13, color: '#999', lineHeight: 22 },
  phoneText: { color: '#111', fontWeight: '800' },

  // OTP boxes
  boxRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 40,
  },
  box: {
    width: BOX_W, height: BOX_W + 12,
    borderRadius: 8, borderWidth: 1.5,
    borderColor: '#F0F0F0',
    backgroundColor: '#FAFAFA',
    fontSize: 24, fontWeight: '900', color: '#111',
    textAlign: 'center',
  },
  boxFilled: {
    borderColor: BRAND,
    backgroundColor: '#FFF',
  },
  boxActive: {
    borderColor: BRAND, borderWidth: 2,
    backgroundColor: '#FFF',
  },

  // Buttons
  btn: {
    backgroundColor: BRAND, height: 56, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 24,
    shadowColor: BRAND, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  },
  btnDim: {
    backgroundColor: '#CCC',
    shadowOpacity: 0, elevation: 0,
  },
  btnTxt: { color: '#FFF', fontSize: 13, fontWeight: '900', letterSpacing: 1.5 },

  resendRow:   { alignItems: 'center', marginBottom: 20 },
  resendTimer: { fontSize: 13, color: '#AAA' },
  resendBold:  { fontWeight: '800', color: '#555' },
  resendLink:  { fontSize: 11, fontWeight: '900', color: BRAND, letterSpacing: 1 },

  footer: { flex: 1, justifyContent: 'flex-end', paddingBottom: 20 },
  changeRow: { alignItems: 'center' },
  changeTxt: { fontSize: 13, color: '#BBB' },
  changeLink:{ color: BRAND, fontWeight: '900' },
});
