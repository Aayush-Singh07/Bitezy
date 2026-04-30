import { useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { useRider } from '../context/RiderContext';

export function useLocationTracker() {
  const { activeRider, activeCount } = useRider();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const updateLocation = async () => {
    // Industrial Guard: Do not ping GPS unless session is fully hydrated and rider is active
    if (!activeRider || !activeRider.id || !activeRider.is_available) return;

    try {
      // For web, we usually need user interaction for permissions, 
      // but we'll try-catch everything for safety.
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      console.log(`LAT: ${location.coords.latitude} | LONG: ${location.coords.longitude} | PUSHED`);

      const { error } = await supabase
        .from('riders')
        .update({
          lat: location.coords.latitude,
          long: location.coords.longitude
        })
        .eq('id', activeRider.id);

      if (error) console.error('Location Sync Error:', error.message);
    } catch (err) {
      // Silently fail to prevent app crash
    }
  };

  useEffect(() => {
    const startTracking = async () => {
      try {
        if (activeRider?.is_available) {
          // Request permissions if online
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === 'granted') {
            // Initial update
            updateLocation();
            
            // Set interval based on mission intensity
            const interval = activeCount > 0 ? 10000 : 30000;
            
            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = setInterval(updateLocation, interval);
          }
        } else {
          // Stop tracking if offline
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
        }
      } catch (err) {
        console.warn('Location Sentinel could not start:', err);
      }
    };

    startTracking();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeRider?.is_available, activeCount, activeRider?.id]);
}
