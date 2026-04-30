import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getDistanceMeters } from '../lib/distance';
import { useAddress } from './AddressContext';

export type Restaurant = {
  id: string;
  name: string;
  lat: number;
  long: number;
  open_time: string;
  close_time: string;
  is_open: boolean;
  zone_id: string;
};

type RestaurantContextType = {
  nearestRestaurant: Restaurant | null;
  allRestaurants: Restaurant[];
  setNearestRestaurant: (r: Restaurant | null) => void;
  isCheckingZone: boolean;
};

const RestaurantContext = createContext<RestaurantContextType>({
  nearestRestaurant: null,
  allRestaurants: [],
  setNearestRestaurant: () => {},
  isCheckingZone: false,
});

export const DELIVERY_RADIUS_METERS = 750;

export const RestaurantProvider = ({ children }: { children: React.ReactNode }) => {
  const { selectedAddress } = useAddress();
  const [allRestaurants, setAllRestaurants] = useState<Restaurant[]>([]);
  const [nearestRestaurant, setNearestRestaurant] = useState<Restaurant | null>(null);
  const [isCheckingZone, setIsCheckingZone] = useState(false);

  // Fetch all restaurants once on mount
  useEffect(() => {
    supabase
      .from('restaurants')
      .select('*')
      .then(({ data }) => {
        if (data) {
          const mapped = (data as any[]).map(r => ({
            ...r,
            lat: Number(r.lat),
            long: Number(r.long),
          }));
          setAllRestaurants(mapped as Restaurant[]);
        }
      });
  }, []);

  // Recompute nearest restaurant whenever address or restaurant list changes
  useEffect(() => {
    if (!selectedAddress || allRestaurants.length === 0) return;

    setIsCheckingZone(true);
    let nearest: Restaurant | null = null;
    let minDist = Infinity;

    for (const r of allRestaurants) {
      const dist = getDistanceMeters(
        selectedAddress.lat, selectedAddress.long,
        r.lat, r.long
      );
      if (dist <= DELIVERY_RADIUS_METERS && dist < minDist) {
        nearest = r;
        minDist = dist;
      }
    }

    setNearestRestaurant(nearest);
    setIsCheckingZone(false);
  }, [selectedAddress, allRestaurants]);

  return (
    <RestaurantContext.Provider value={{ nearestRestaurant, allRestaurants, setNearestRestaurant, isCheckingZone }}>
      {children}
    </RestaurantContext.Provider>
  );
};

export const useRestaurant = () => useContext(RestaurantContext);
