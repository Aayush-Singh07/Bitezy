import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, TouchableOpacity, Platform } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');
const BRAND_GREEN = '#02844F';

interface BitezyAlertProps {
  title: string;
  body: string;
  onClose: () => void;
}

export function BitezyAlert({ title, body, onClose }: BitezyAlertProps) {
  let insets: any;
  try {
    insets = useSafeAreaInsets();
  } catch (e) {
    insets = { top: 20, bottom: 0, left: 0, right: 0 };
  }
  
  const translateY = useRef(new Animated.Value(-200)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Elegant spring entry
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 12,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      })
    ]).start();

    const timer = setTimeout(() => {
      handleClose();
    }, 6000);

    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -200,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      })
    ]).start(() => onClose());
  };

  return (
    <Animated.View 
      style={[
        s.container, 
        { 
          transform: [{ translateY }], 
          opacity,
          top: insets.top + 8 
        }
      ]}
    >
      <TouchableOpacity activeOpacity={0.9} style={s.glassCard} onPress={handleClose}>
        <View style={s.iconWrapper}>
          <View style={s.innerIcon}>
            <MaterialCommunityIcons name="lightning-bolt" size={20} color="#FFF" />
          </View>
        </View>
        
        <View style={s.textContainer}>
          <Text style={s.titleText}>{title}</Text>
          <Text style={s.bodyText} numberOfLines={2}>{body}</Text>
        </View>

        <View style={s.actionHint}>
          <Feather name="chevron-up" size={14} color="rgba(255,255,255,0.4)" />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 10000,
    alignItems: 'center',
  },
  glassCard: {
    width: Math.min(width - 24, 420),
    backgroundColor: 'rgba(26, 31, 37, 0.96)', // Deep Slate Glass
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    
    // Premium Float Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 20,
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  innerIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: BRAND_GREEN,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
    marginLeft: 14,
  },
  titleText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 0.2,
  },
  bodyText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
    lineHeight: 16,
  },
  actionHint: {
    paddingLeft: 10,
    justifyContent: 'center',
  }
});
