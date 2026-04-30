import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const RIDER_STORAGE_KEY = '@bitezy_active_rider';

type Rider = {
  id: string;
  name: string;
  is_available: boolean;
  phone?: string;
  vehicle_number?: string;
  image_url?: string;
};

type RiderContextType = {
  activeRider: Rider | null;
  setActiveRider: (rider: Rider | null) => void;
  activeCount: number;
  setActiveCount: (count: number) => void;
  isLoading: boolean;
};

const RiderContext = createContext<RiderContextType | undefined>(undefined);

export function RiderProvider({ children }: { children: React.ReactNode }) {
  const [activeRider, _setActiveRider] = useState<Rider | null>(null);
  const [activeCount, setActiveCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  // Re-hydrate session on boot
  useEffect(() => {
    const loadSession = async () => {
      try {
        const savedRider = await AsyncStorage.getItem(RIDER_STORAGE_KEY);
        if (savedRider) {
          _setActiveRider(JSON.parse(savedRider));
        }
      } catch (err) {
        console.error('Failed to re-hydrate session:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadSession();
  }, []);

  const setActiveRider = async (rider: Rider | null) => {
    try {
      if (rider) {
        await AsyncStorage.setItem(RIDER_STORAGE_KEY, JSON.stringify(rider));
      } else {
        await AsyncStorage.removeItem(RIDER_STORAGE_KEY);
      }
      _setActiveRider(rider);
    } catch (err) {
      console.error('Session persistence failed:', err);
    }
  };

  return (
    <RiderContext.Provider value={{ activeRider, setActiveRider, activeCount, setActiveCount, isLoading }}>
      {children}
    </RiderContext.Provider>
  );
}

export function useRider() {
  const context = useContext(RiderContext);
  if (context === undefined) {
    throw new Error('useRider must be used within a RiderProvider');
  }
  return context;
}
