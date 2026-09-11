import React, { useRef, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
  StatusBar, Platform, Animated, Dimensions, ActivityIndicator
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';

const BRAND_GREEN = '#02844F';
const { width } = Dimensions.get('window');

const NoServiceScreen = ({ navigation }: any) => {
  const [isChecking, setIsChecking] = useState(false);
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Entry animation
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, tension: 80, friction: 8, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]).start();

    // Floating loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: -12, duration: 1800, useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND_GREEN} />

      {/* Back */}
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.replace('AddressPicker')}>
        <Feather name="arrow-left" size={22} color="#FFF" />
      </TouchableOpacity>

      <Animated.View style={[styles.content, { opacity: opacityAnim, transform: [{ scale: scaleAnim }] }]}>

        {/* Floating emoji */}
        <Animated.View style={{ transform: [{ translateY: floatAnim }] }}>
          <View style={styles.iconContainer}>
            <Text style={styles.mainEmoji}>🏍️</Text>
            <View style={styles.iconBadge}>
              <Feather name="clock" size={14} color="#FFF" />
            </View>
          </View>
        </Animated.View>

        {/* Branding Text */}
        <Text style={styles.headline}>MAIN BRANCH TEXT</Text>
        <Text style={styles.subHeadline}>But our engineers are actively working on it!</Text>
        <Text style={styles.subHeadline}>But we're coming fast. 🔥</Text>

        <View style={styles.divider} />

        <Text style={styles.body}>
          Bitezy is a hyperlocal 10-minute delivery zone — we serve within <Text style={styles.bodyBold}>750m</Text> of our bakeries.
        </Text>
        <Text style={styles.body2}>
          Your address is outside our current delivery radius. Try a nearby address or check back soon!
        </Text>

        {/* Simple React Native Flexbox Example */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-around',
            backgroundColor: 'rgba(255,255,255,0.12)',
            paddingVertical: 18,
            borderRadius: 20,
            marginBottom: 28,
            width: '100%'
          }}
        >
          <Text style={{ fontSize: 20, color: '#FFF' }}>1</Text>
          <Text style={{ fontSize: 20, color: '#FFF' }}>2</Text>
          <Text style={{ fontSize: 20, color: '#FFF' }}>3</Text>
        </View>

        {/* CTA */}
        <TouchableOpacity
          style={styles.ctaBtn}
          onPress={() => {
            setIsChecking(true);
            setTimeout(() => {
              setIsChecking(false);
              navigation.replace('AddressPicker');
            }, 2000);
          }}
          activeOpacity={0.85}
          disabled={isChecking}
        >
          {isChecking ? (
            <ActivityIndicator color={BRAND_GREEN} />
          ) : (
            <>
              <Feather name="map-pin" size={18} color={BRAND_GREEN} style={{ marginRight: 8 }} />
              <Text style={styles.ctaBtnText}>Try a Different Address</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.footNote}>
          🚀 We're expanding zone by zone. Tell your friends in your area — every request counts.
        </Text>

      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BRAND_GREEN },
  backBtn: {
    marginTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 8,
    marginLeft: 20, padding: 10, alignSelf: 'flex-start',
  },
  content: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 28, paddingBottom: 40,
  },

  iconContainer: { width: 120, height: 120, position: 'relative', alignItems: 'center', justifyContent: 'center', marginBottom: 32 },
  mainEmoji: { fontSize: 72 },
  iconBadge: {
    position: 'absolute', bottom: 8, right: 8,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#FF5252', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: BRAND_GREEN,
  },

  headline: { fontSize: 34, fontWeight: '900', color: '#FFF', textAlign: 'center', letterSpacing: -1 },
  subHeadline: { fontSize: 20, fontWeight: '700', color: 'rgba(255,255,255,0.85)', textAlign: 'center', marginTop: 6, marginBottom: 20 },

  divider: { width: 48, height: 3, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2, marginBottom: 20 },

  body: { fontSize: 15, color: 'rgba(255,255,255,0.8)', textAlign: 'center', lineHeight: 24, marginBottom: 8 },
  bodyBold: { color: '#FFF', fontWeight: '900' },
  body2: { fontSize: 14, color: 'rgba(255,255,255,0.65)', textAlign: 'center', lineHeight: 22, marginBottom: 28 },

  statsRow: {
    flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 20, paddingVertical: 18, paddingHorizontal: 10,
    marginBottom: 28, width: '100%',
  },
  statCard: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 20, fontWeight: '900', color: '#FFF', marginBottom: 2 },
  statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.65)', fontWeight: '600' },
  statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 4 },

  ctaBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FFF', height: 56, borderRadius: 16, width: '100%',
    marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 6,
  },
  ctaBtnText: { fontSize: 16, fontWeight: '900', color: BRAND_GREEN },

  footNote: { fontSize: 12, color: 'rgba(255,255,255,0.6)', textAlign: 'center', lineHeight: 20, paddingHorizontal: 10 },
});

export default NoServiceScreen;
