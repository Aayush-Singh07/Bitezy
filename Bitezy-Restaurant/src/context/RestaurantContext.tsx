import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export type Restaurant = {
  id: string;
  name: string;
  is_open: boolean;
  current_load: number;
  open_time: string | null;
  close_time: string | null;
  image_url: string | null;
  lat: number | null;
  long: number | null;
};

type RestaurantContextType = {
  restaurant: Restaurant | null;
  setRestaurant: (r: Restaurant | null) => void;
  isLoading: boolean;
  logout: () => void;
  refreshRestaurant: () => Promise<void>;
};

const RestaurantContext = createContext<RestaurantContextType>({
  restaurant: null,
  setRestaurant: () => {},
  isLoading: true,
  logout: () => {},
  refreshRestaurant: async () => {},
});

export const RestaurantProvider = ({ children }: { children: React.ReactNode }) => {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedId = localStorage.getItem('bitezy_restaurant_id');
    if (savedId) {
      fetchRestaurant(savedId);
    } else {
      setIsLoading(false);
    }
  }, []);

  const fetchRestaurant = async (id: string, silent = false) => {
    if (!silent) setIsLoading(true);
    const { data, error } = await supabase
      .from('restaurants')
      .select('id, name, is_open, current_load, open_time, close_time, image_url, lat, long')
      .eq('id', id)
      .single();

    if (data && !error) {
      setRestaurant(data);
      localStorage.setItem('bitezy_restaurant_id', id);
    } else if (error && !silent) {
      logout();
    }
    if (!silent) setIsLoading(false);
  };

  const logout = () => {
    setRestaurant(null);
    localStorage.removeItem('bitezy_restaurant_id');
  };

  const refreshRestaurant = async () => {
    const savedId = localStorage.getItem('bitezy_restaurant_id');
    if (savedId) await fetchRestaurant(savedId, true);
  };

  return (
    <RestaurantContext.Provider value={{ restaurant, setRestaurant, isLoading, logout, refreshRestaurant }}>
      {children}
    </RestaurantContext.Provider>
  );
};

export const useRestaurant = () => useContext(RestaurantContext);
