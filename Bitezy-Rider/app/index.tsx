import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useRider } from '../context/RiderContext';
import { Bike, ShieldCheck, ArrowRight, Eye, EyeOff } from 'lucide-react-native';

export default function RiderLogin() {
  const router = useRouter();
  const { setActiveRider } = useRider();
  
  const [phone, setPhone] = useState('+91');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handlePhoneChange = (text: string) => {
    if (!text.startsWith('+91')) {
      if (text.length < 3) {
        setPhone('+91');
      } else {
        setPhone('+91' + text.replace(/^\+91/, ''));
      }
    } else {
      setPhone(text);
    }
  };

  const handleLogin = async () => {
    if (!phone || !password) {
      Alert.alert('FIELD ERROR', 'PHONE AND PASSWORD ARE REQUIRED');
      return;
    }

    setLoading(true);
    try {
      // Direct query for MVP as requested: simple phone and password match
      const { data, error } = await supabase
        .from('riders')
        .select('*')
        .eq('phone', phone)
        .eq('password', password)
        .single();

      if (error || !data) {
        Alert.alert('AUTH FAILURE', 'INVALID PHONE OR PASSWORD');
      } else {
        setActiveRider(data);
        router.replace('/(tabs)/home');
      }
    } catch (err) {
      console.error('Login error:', err);
      Alert.alert('SYSTEM ERROR', 'CONNECTION FAILED');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.logoBox}>
              <Bike color="#ffffff" size={32} />
            </View>
            <Text style={styles.brandText}>BITEZY LOGIN</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>PHONE NUMBER</Text>
              <TextInput
                style={styles.input}
                placeholder="ENTER PHONE"
                placeholderTextColor="#9ca3af"
                value={phone}
                onChangeText={handlePhoneChange}
                keyboardType="phone-pad"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>TERMINAL PASSWORD</Text>
              <View style={styles.passwordWrapper}>
                <TextInput
                  style={[styles.input, { flex: 1, borderRightWidth: 0 }]}
                  placeholder="ENTER PASSWORD"
                  placeholderTextColor="#9ca3af"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity 
                  style={styles.eyeButton} 
                  onPress={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff color="#6b7280" size={20} /> : <Eye color="#6b7280" size={20} />}
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity 
              style={[styles.loginButton, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <Text style={styles.loginButtonText}>INITIATE SESSION</Text>
                  <ArrowRight color="#ffffff" size={20} />
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>INDUSTRIAL TERMINAL ACCESS • V1.2.0</Text>
            <Text style={styles.footerText}>© BITEZY LOGISTICS CORP</Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  content: { flex: 1, padding: 30, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 60 },
  logoBox: { width: 64, height: 64, backgroundColor: '#02844F', borderRadius: 0, justifyContent: 'center', alignItems: 'center', marginBottom: 16, borderWidth: 2, borderColor: '#000' },
  brandText: { fontSize: 32, fontWeight: '900', color: '#000', letterSpacing: 1 },
  subBrand: { fontSize: 10, fontWeight: '900', color: '#6b7280', letterSpacing: 3, marginTop: 4 },
  form: { width: '100%', backgroundColor: '#ffffff', padding: 24, borderWidth: 2, borderColor: '#000' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 30 },
  badgeText: { fontSize: 10, fontWeight: '900', color: '#02844F', letterSpacing: 1 },
  inputGroup: { marginBottom: 24 },
  label: { fontSize: 11, fontWeight: '900', color: '#6b7280', letterSpacing: 1, marginBottom: 10 },
  input: { height: 55, borderWidth: 2, borderColor: '#f3f4f6', backgroundColor: '#f9fafb', paddingHorizontal: 16, fontSize: 16, fontWeight: '700', color: '#000', borderRadius: 0 },
  passwordWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb', borderWidth: 2, borderColor: '#f3f4f6' },
  eyeButton: { paddingHorizontal: 15, height: '100%', justifyContent: 'center', backgroundColor: '#f9fafb' },
  loginButton: { height: 60, backgroundColor: '#02844F', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 10 },
  buttonDisabled: { opacity: 0.7 },
  loginButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '900', letterSpacing: 1 },
  footer: { position: 'absolute', bottom: 40, width: '100%', left: 0, alignItems: 'center' },
  footerText: { fontSize: 9, fontWeight: '900', color: '#d1d5db', letterSpacing: 1, marginBottom: 4 }
});
