import { supabase } from '../lib/supabase';

export interface MenuItem {
  id?: string;
  restaurant_id: string;
  name: string;
  price: number;
  is_available: boolean;
  image_url?: string;
  description?: string;
  category?: string;
  type?: 'veg' | 'nonveg';
  gimmick_price?: number;
  is_high_protein?: boolean;
  highly_reordered?: boolean;
}

export interface Combo {
  id?: string;
  restaurant_id: string;
  name: string;
  price: number;
  items_json: any[];
  is_available: boolean;
  image_url?: string;
  description?: string;
  gimmick_price?: number;
  is_high_protein?: boolean;
  highly_reordered?: boolean;
}

export const menuService = {
  async fetchItems(restaurantId: string) {
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('name');
    if (error) throw error;
    return data;
  },

  async fetchCombos(restaurantId: string) {
    const { data, error } = await supabase
      .from('combos')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('name');
    if (error) throw error;
    return data;
  },

  async upsertItem(item: MenuItem) {
    const { data: updatedItem, error } = await supabase
      .from('items')
      .upsert(item)
      .select()
      .single();
    if (error) throw error;

    // Cascade: If newly saved item is unavailable, mark dependent combos unavailable
    if (updatedItem && updatedItem.is_available === false) {
      try {
        const { data: combos } = await supabase
          .from('combos')
          .select('*')
          .eq('restaurant_id', updatedItem.restaurant_id)
          .eq('is_available', true);
        
        if (combos && combos.length > 0) {
          const affectedCombos = combos.filter(c => 
            Array.isArray(c.items_json) && c.items_json.some((i: any) => i.name === updatedItem.name)
          );

          if (affectedCombos.length > 0) {
            const ids = affectedCombos.map(c => c.id);
            await supabase.from('combos').update({ is_available: false }).in('id', ids);
          }
        }
      } catch (err) {
        console.error('Upsert cascade failed:', err);
      }
    }
    return updatedItem;
  },

  async upsertCombo(combo: Combo) {
    const { data, error } = await supabase
      .from('combos')
      .upsert(combo)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteItem(id: string) {
    const { error } = await supabase.from('items').delete().eq('id', id);
    if (error) throw error;
  },

  async deleteCombo(id: string) {
    const { error } = await supabase.from('combos').delete().eq('id', id);
    if (error) throw error;
  },

  async toggleAvailability(table: 'items' | 'combos', id: string, status: boolean) {
    // 1. Update the target item/combo first
    const { error } = await supabase
      .from(table)
      .update({ is_available: status })
      .eq('id', id);
    if (error) throw error;

    // 2. Cascade logic: Item OUT -> Combo(s) OUT
    if (table === 'items' && status === false) {
      try {
        // Fetch the item name first
        const { data: item } = await supabase.from('items').select('name, restaurant_id').eq('id', id).single();
        if (item) {
          // Fetch all combos for this restaurant to check their items_json
          const { data: combos } = await supabase.from('combos').select('*').eq('restaurant_id', item.restaurant_id).eq('is_available', true);
          
          if (combos && combos.length > 0) {
            const affectedCombos = combos.filter(c => 
              Array.isArray(c.items_json) && c.items_json.some((i: any) => i.name === item.name)
            );

            if (affectedCombos.length > 0) {
              const ids = affectedCombos.map(c => c.id);
              await supabase.from('combos').update({ is_available: false }).in('id', ids);
            }
          }
        }
      } catch (err) {
        console.error('Cascade update failed:', err);
      }
    }
  }
};
