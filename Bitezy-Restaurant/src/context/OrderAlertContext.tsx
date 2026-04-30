import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { Order } from '../types/order';

interface OrderAlertContextType {
  placedOrders: Order[];
  isAudioEnabled: boolean;
  toggleAudio: () => void;
  markAsInteracted: () => void;
}

const OrderAlertContext = createContext<OrderAlertContextType | undefined>(undefined);

export const OrderAlertProvider = ({ children, restaurantId }: { children: React.ReactNode, restaurantId?: string }) => {
  const [placedOrders, setPlacedOrders] = useState<Order[]>([]);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [hasInteracted, setHasInteracted] = useState(false);
  const audioIntervalRef = useRef<any>(null);

  const fetchPlacedOrders = useCallback(async () => {
    if (!restaurantId) return;
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (id, quantity, price, item:items(name), combo:combos(name)),
        user:users (name, phone)
      `)
      .eq('restaurant_id', restaurantId)
      .eq('status', 'PLACED')
      .order('created_at', { ascending: false });

    if (!error && data) {
      const formatted = data.map((order: any) => ({
        ...order,
        order_items: order.order_items.map((oi: any) => ({
          ...oi,
          name: oi.item?.name || oi.combo?.name || 'Unknown Item'
        }))
      }));
      setPlacedOrders(formatted as unknown as Order[]);
    }
  }, [restaurantId]);

  // Handle Beep Logic (Web Audio API Synthesizer)
  useEffect(() => {
    if (placedOrders.length > 0 && isAudioEnabled && hasInteracted) {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      const playBeep = () => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, audioCtx.currentTime); 
        gain.gain.setValueAtTime(0.05, audioCtx.currentTime); // Very subtle
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
      };

      if (!audioIntervalRef.current) {
        playBeep();
        audioIntervalRef.current = setInterval(playBeep, 2000); // Persistent but subtle
      }

      return () => {
        if (audioIntervalRef.current) {
          clearInterval(audioIntervalRef.current);
          audioIntervalRef.current = null;
        }
        audioCtx.close();
      };
    } else {
      if (audioIntervalRef.current) {
        clearInterval(audioIntervalRef.current);
        audioIntervalRef.current = null;
      }
    }
  }, [placedOrders.length, isAudioEnabled, hasInteracted]);

  useEffect(() => {
    if (!restaurantId) return;

    fetchPlacedOrders();

    const channel = supabase
      .channel('global-order-alerts')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` },
        () => fetchPlacedOrders()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantId, fetchPlacedOrders]);

  const toggleAudio = () => setIsAudioEnabled(prev => !prev);
  const markAsInteracted = () => setHasInteracted(true);

  return (
    <OrderAlertContext.Provider value={{ placedOrders, isAudioEnabled, toggleAudio, markAsInteracted }}>
      {children}
    </OrderAlertContext.Provider>
  );
};

export const useOrderAlerts = () => {
  const context = useContext(OrderAlertContext);
  if (!context) throw new Error('useOrderAlerts must be used within OrderAlertProvider');
  return context;
};
