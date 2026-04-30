import { supabase } from '../lib/supabase';
import type { Restaurant } from '../context/RestaurantContext';

export const restaurantService = {
  async updateRestaurant(id: string, updates: Partial<Restaurant>) {
    const { data, error } = await supabase
      .from('restaurants')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};
