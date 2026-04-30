import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Order } from '../types/order';

export const useLiveOrders = (restaurantId: string | undefined) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    if (!restaurantId) return;

    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          id,
          quantity,
          price,
          item:items(name),
          combo:combos(name)
        ),
        user:users (
          name,
          phone
        )
      `)
      .eq('restaurant_id', restaurantId)
      .in('status', ['PLACED', 'ACCEPTED', 'PREPARING', 'READY'])
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching orders:', error);
    } else {
      const formatted = data.map((order: any) => ({
        ...order,
        order_items: order.order_items.map((oi: any) => ({
          ...oi,
          name: oi.item?.name || oi.combo?.name || 'Unknown Item'
        }))
      }));
      setOrders(formatted as unknown as Order[]);
    }
    setIsLoading(false);
  }, [restaurantId]);

  useEffect(() => {
    fetchOrders();

    if (!restaurantId) return;

    // REAL-TIME SUBSCRIPTION
    const channel = supabase
      .channel(`live-orders-${restaurantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            fetchOrders();
          } else if (payload.eventType === 'UPDATE') {
            const updatedOrder = payload.new as Order;
            
            if (!['PLACED', 'ACCEPTED', 'PREPARING', 'READY'].includes(updatedOrder.status)) {
              setOrders(prev => prev.filter(o => o.id !== updatedOrder.id));
            } else {
              setOrders(prev => prev.map(o => o.id === updatedOrder.id ? { ...o, ...updatedOrder } : o));
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantId, fetchOrders]);

  return { orders, isLoading, refresh: fetchOrders };
};
