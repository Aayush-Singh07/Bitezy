import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Platform } from 'react-native';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

const BRAND_GREEN = '#02844F';

interface ActiveOrderWidgetProps {
  order: any;
}

export const ActiveOrderWidget = ({ order }: ActiveOrderWidgetProps) => {
  const navigation = useNavigation<any>();
  
  // Animation Refs
  const slideAnim = useRef(new Animated.Value(150)).current;
  const pulseOpacity = useRef(new Animated.Value(1)).current;

  // 1. Entrance & Live Pulse Animation
  useEffect(() => {
    // Smooth Elevation Entrance
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 50,
      friction: 10
    }).start();

    // Subtle Branded Pulse
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseOpacity, { toValue: 0.4, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseOpacity, { toValue: 1, duration: 1000, useNativeDriver: true })
      ])
    );
    pulseLoop.start();
    return () => pulseLoop.stop();
  }, []);

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'PLACED':
        return { icon: 'lock-check', text: 'BITE LOCKED!', color: '#F57C00' };
      case 'ACCEPTED':
        return { icon: 'chef-hat', text: 'CHEF IS HYPED!', color: '#F57C00' };
      case 'PREPARING':
        return { icon: 'fire', text: 'MAGIC IN OVEN', color: '#EF4444' };
      case 'READY':
        return { icon: 'package-variant-closed', text: 'READY TO FLY', color: BRAND_GREEN };
      case 'ON_THE_WAY':
        return { icon: 'bike-fast', text: 'ZOOMING TO YOU', color: BRAND_GREEN };
      case 'ARRIVED':
        return { icon: 'door-open', text: 'OUTSIDE! OPEN UP!', color: BRAND_GREEN };
      default:
        return { icon: 'moped', text: 'LIVE TRACKING...', color: '#64748B' };
    }
  };

  const config = getStatusDisplay(order.status);

  const getShortETA = () => {
    if (!order.estimated_arrival_at) return '';
    const diff = Math.ceil((new Date(order.estimated_arrival_at).getTime() - new Date().getTime()) / 60000);
    return diff > 0 ? `${diff} MINS` : 'READY';
  };

  return (
    <Animated.View 
      style={[
        s.container,
        { transform: [{ translateY: slideAnim }] }
      ]}
    >
      <TouchableOpacity 
        activeOpacity={0.9} 
        onPress={() => navigation.navigate('OrderTracking', { orderId: order.id })}
        style={s.pill}
      >
        <View style={s.left}>
          <View style={s.iconBadge}>
             <MaterialCommunityIcons name={config.icon as any} size={16} color={BRAND_GREEN} />
          </View>
          <View style={s.info}>
            <Text style={s.statusLabel}>Live Status</Text>
            <Text style={s.statusValue}>{config.text}</Text>
          </View>
        </View>
        
        <View style={s.right}>
          <Text style={s.etaValue}>{getShortETA()}</Text>
          <Feather name="chevron-right" size={18} color="#FFF" />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const s = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 20,
    left: 15,
    right: 15,
    zIndex: 10000,
  },
  pill: {
    backgroundColor: BRAND_GREEN,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBadge: {
    width: 24,
    height: 24,
    backgroundColor: '#FFF',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  info: {},
  statusLabel: {
    color: '#E0F2F1',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  statusValue: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '900',
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  etaValue: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '900',
    marginRight: 4,
  },
});
