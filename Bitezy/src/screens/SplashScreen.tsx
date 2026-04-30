/**
 * SplashScreen.tsx
 *
 * Flow:
 *   no session        → Onboarding
 *   session, no addr  → AddressPicker (full screen, first-time)
 *   session, has addr → Home
 *
 * Both animation AND auth must resolve before navigating.
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, StatusBar, Platform } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useAddress } from '../context/AddressContext';

const BRAND_GREEN = '#02844F';

const SplashScreen = ({ navigation }: any) => {
  const brandScale   = useRef(new Animated.Value(0.5)).current;
  const brandOpacity = useRef(new Animated.Value(0)).current;
  const taglineSlide = useRef(new Animated.Value(20)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const bgScale      = useRef(new Animated.Value(1)).current;

  const { user, isLoading } = useAuth();
  const { hasAddresses }       = useAddress();

  const [animDone, setAnimDone] = useState(false);

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(brandScale,   { toValue: 1, friction: 4, tension: 100, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(brandOpacity, { toValue: 1, duration: 500, useNativeDriver: Platform.OS !== 'web' }),
      ]),
      Animated.delay(100),
      Animated.parallel([
        Animated.timing(taglineSlide,   { toValue: 0, duration: 400, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(taglineOpacity, { toValue: 1, duration: 400, useNativeDriver: Platform.OS !== 'web' }),
      ]),
      Animated.delay(1100),
      Animated.parallel([
        Animated.timing(brandOpacity, { toValue: 0, duration: 350, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(bgScale,      { toValue: 1.5, duration: 550, useNativeDriver: Platform.OS !== 'web' }),
      ]),
    ]).start(() => setAnimDone(true));
  }, []);

  useEffect(() => {
    const checkNavigation = async () => {
      // 1. Wait for animation
      if (!animDone) return;

      // 2. Safety Timeout: If we've waited 6 seconds total, force move to Home/Onboarding
      // This prevents hangs due to network failures (ERR_NAME_NOT_RESOLVED)
      const timer = setTimeout(() => {
        console.warn('SplashScreen: Safety timeout reached. Forcing navigation.');
        if (!user) navigation.replace('Onboarding');
        else navigation.replace('Home');
      }, 6000);

      // 3. Normal resolving logic
      if (!isLoading) {
        // Wait for hasAddresses ONLY if we have a user
        if (user && hasAddresses === null) return;

        clearTimeout(timer);
        if (!user) {
          navigation.replace('Onboarding');
        } else if (hasAddresses === false) {
          // First timer — Go to Home but show picker modal automatically
          navigation.replace('Home', { promptAddress: true });
        } else {
          navigation.replace('Home');
        }
      }
    };

    checkNavigation();
  }, [animDone, isLoading, user, hasAddresses, navigation]);

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor={BRAND_GREEN} barStyle="light-content" />
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: BRAND_GREEN, transform: [{ scale: bgScale }] },
        ]}
      />
      <View style={styles.center}>
        <Animated.View
          style={[
            styles.brandWrapper,
            { opacity: brandOpacity, transform: [{ scale: brandScale }] },
          ]}
        >
          <View>
            <Text style={styles.brandName}>Bitezy</Text>
            <View style={styles.biteMark} />
          </View>
          <Animated.Text
            style={[
              styles.tagline,
              { opacity: taglineOpacity, transform: [{ translateY: taglineSlide }] },
            ]}
          >
            Bite in seconds
          </Animated.Text>
        </Animated.View>
      </View>
      <PulseDot />
    </View>
  );
};

const PulseDot = () => {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.6, duration: 600, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(pulse, { toValue: 1,   duration: 600, useNativeDriver: Platform.OS !== 'web' }),
      ])
    ).start();
  }, []);
  return (
    <View style={styles.footer}>
      <Animated.View style={[styles.dot, { transform: [{ scale: pulse }] }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: BRAND_GREEN },
  center:       { flex: 1, justifyContent: 'center', alignItems: 'center' },
  brandWrapper: { alignItems: 'center' },
  brandName: {
    fontSize: 68, fontWeight: '900', color: '#FFF', letterSpacing: -1.5,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10 },
      android: { elevation: 4 },
    }),
  },
  biteMark: {
    position: 'absolute', top: 8, left: -4,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: BRAND_GREEN,
  },
  tagline: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 18, fontWeight: '600', letterSpacing: 1.2, marginTop: -5,
  },
  footer: { paddingBottom: 60, alignItems: 'center' },
  dot:    { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.5)' },
});

export default SplashScreen;