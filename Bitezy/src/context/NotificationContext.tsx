import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { BitezyAlert } from '../components/BitezyAlert';

const BRAND_GREEN = '#02844F';

// Foreground Notification Configuration
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

type Notification = {
  title: string;
  body: string;
  type: 'ORDER' | 'SYSTEM';
  order_id?: string;
};

type NotificationContextType = {
  showNotification: (n: Notification) => void;
  activeOrder: any;
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [activeOrder, setActiveOrder] = useState<any>(null);
  const activeOrderRef = useRef<any>(null); // To avoid stale closures in real-time listener

  useEffect(() => {
    activeOrderRef.current = activeOrder;
  }, [activeOrder]);

  // Configure Android Sound Channel
  useEffect(() => {
    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: BRAND_GREEN,
        sound: 'joy.mp3', // Matches bundled asset in app.json
      });
    }
  }, []);

  const soundRef = useRef<Audio.Sound | null>(null);

  // 1. Fetch Latest Active Order (Strictly most recent)
  const fetchActiveOrder = async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*, restaurants(name)')
        .eq('user_id', user.id)
        .not('status', 'in', '("DELIVERED","CANCELLED")')
        .order('created_at', { ascending: false }) // Strictly newest first
        .limit(1)
        .maybeSingle(); // maybeSingle instead of single to handle 0 results gracefully
      
      if (!error && data) {
        setActiveOrder(data);
      } else {
        setActiveOrder(null);
      }
    } catch (e) {
      console.log('Fetch Order Error:', e);
    }
  };

  useEffect(() => {
    fetchActiveOrder();
  }, [user?.id]);

  // Preload sound
  useEffect(() => {
    const loadSound = async () => {
      try {
        const { sound } = await Audio.Sound.createAsync(
          { uri: 'https://assets.mixkit.co/sfx/preview/mixkit-crunchy-bite-707.mp3' } // Real "Crunch" Sfx
        );
        soundRef.current = sound;
      } catch (error) {
        console.error('Failed to load sound:', error);
      }
    };
    loadSound();

    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  const playSoundAndHaptic = async () => {
    try {
      // 🔊 Joyful Sync: Using the local joy.mp3 for a premium, branded experience
      const { sound } = await Audio.Sound.createAsync(
        require('../../assets/joy.mp3')
      );
      await sound.playAsync();

      // Cleanup
      setTimeout(() => {
        sound.unloadAsync();
      }, 4000);

      if (Platform.OS !== 'web') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.log('🔔 Notification Audio Error:', error);
    }
  };

  const showNotification = useCallback((n: Notification) => {
    // Custom In-App Banner and Sound removed as per user request.
    // The native OS Push Notification handles the visual/sound now.
  }, []);

  // Real-time listener for user alerts (Orders & System)
  useEffect(() => {
    if (!user?.id) {
      console.log('🔔 NotificationContext: No user ID, skipping subscription.');
      return;
    }

    console.log(`🔔 NotificationContext: Subscribing to order_updates for user ${user.id}`);

    // [New] Sync Push Token automatically on mount
    const syncToken = async () => {
      try {
        if (Platform.OS === 'web') return;
        
        // Use a small delay to avoid blocking the main thread during boot
        await new Promise(r => setTimeout(r, 1000));

        const { status } = await Notifications.getPermissionsAsync();
        if (status === 'granted') {
          const token = (await Notifications.getExpoPushTokenAsync({
            projectId: Constants.expoConfig?.extra?.eas?.projectId || '75685691-6c78-426d-a242-620921eca0e2',
          })).data;
          console.log('📲 Push Token Captured:', token);
          await supabase.from('users').update({ expo_push_token: token }).eq('id', user.id);
        }
      } catch (e) {
        console.warn('Sync Token Error:', e);
      }
    };
    syncToken();

    // 1. Listen for Order Status Changes
    const orderChannel = supabase.channel(`order_updates:${user.id}`)
      .on(
        'postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'orders', 
          filter: `user_id=eq.${user.id}` 
        }, 
        (payload) => {
          console.log('🔔 Received Real-time Payload:', payload);
          try {
            const currentOrderId = activeOrderRef.current?.id;
            
            // 1. Precise "Active Order" Tracking
            if (payload.eventType === 'INSERT') {
              // Always prioritise the newest order
              setActiveOrder(payload.new);
            } else if (payload.eventType === 'UPDATE') {
              const order: any = payload.new;
              // If the finished order matches our current one (or we find a delivered one), clear it
              if ((currentOrderId === order?.id || !currentOrderId) && (order?.status === 'DELIVERED' || order?.status === 'CANCELLED')) {
                setActiveOrder(null);
              } 
              // Only update if it's our currently tracked order
              else if (currentOrderId === order?.id || !currentOrderId) {
                setActiveOrder(order);
              }
            }

            const newStatus = (payload.new as any)?.status;
            const oldStatus = (payload.old as any)?.status;

            console.log(`🔔 Status Change Detected: ${oldStatus} -> ${newStatus}`);

            if (newStatus && newStatus !== oldStatus) {
              let title = '';
              let body = '';

              if (newStatus === 'ACCEPTED') {
                title = 'ORDER LOCKED! 🧤';
                body = 'The bakery secured the bag. Chef is warming up the oven!';
              } else if (newStatus === 'ARRIVED') {
                title = 'FINAL SPRINT! 🏁';
                body = 'Rider is at your door. The feast has arrived!';
              } else if (newStatus === 'CANCELLED') {
                title = 'OH NO! 💔';
                body = 'The bakery ran out of snacks. We\'re crying too. Refund is on the way.';
              }

              if (title) {
                console.log('🔔 Triggering UI Banner:', title);
                showNotification({ title, body, type: 'ORDER' });
              }
            }
          } catch (e) {
            console.error('Notification logic error:', e);
          }
        }
      )
      .subscribe((status) => {
        console.log('🔔 Subscription Status:', status);
      });

    return () => {
      console.log('🔔 Cleaning up notification channel.');
      supabase.removeChannel(orderChannel);
    };
  }, [user?.id]);

  return (
    <NotificationContext.Provider value={{ showNotification, activeOrder }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
