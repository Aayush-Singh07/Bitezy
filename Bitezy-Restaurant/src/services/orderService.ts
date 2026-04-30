import { supabase } from '../lib/supabase';
import type { OrderStatus } from '../types/order';

export const orderService = {
  async updateOrderStatus(orderId: string, status: OrderStatus) {
    const { data, error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', orderId)
      .select()
      .single();

    if (error) {
      console.error(`Error updating order ${orderId} to ${status}:`, error);
      throw error;
    }
    return data;
  },

  async markAllAsReady(restaurantId: string, orderIds: string[]) {
    const { error } = await supabase
      .from('orders')
      .update({ status: 'READY' })
      .eq('restaurant_id', restaurantId)
      .in('id', orderIds);

    if (error) {
      console.error('Error marking all as ready:', error);
      throw error;
    }
  },

  async fetchOrderHistory(restaurantId: string, filters: { status?: string, dateRange?: string, search?: string }) {
    let query = supabase
      .from('orders')
      .select(`
        *,
        user:users (name, phone),
        order_items (
          id, quantity, price,
          item:items(name),
          combo:combos(name)
        )
      `)
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false });

    if (filters.status && filters.status !== 'ALL') {
      query = query.eq('status', filters.status);
    }

    if (filters.dateRange === 'TODAY') {
      const today = new Date();
      today.setHours(0,0,0,0);
      query = query.gte('created_at', today.toISOString());
    } else if (filters.dateRange === 'YESTERDAY') {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0,0,0,0);
      const today = new Date();
      today.setHours(0,0,0,0);
      query = query.gte('created_at', yesterday.toISOString()).lt('created_at', today.toISOString());
    }

    const { data, error } = await query;
    if (error) throw error;
    
    // Client-side search for ID or Phone (since Supabase join filters are complex)
    if (filters.search) {
      const s = filters.search.toLowerCase();
      return data.filter((o: any) => 
        o.id.toLowerCase().includes(s) || 
        o.user?.phone?.toLowerCase().includes(s) ||
        o.user?.name?.toLowerCase().includes(s)
      );
    }

    return data;
  }
};
