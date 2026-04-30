import { useState } from 'react';
import { useRestaurant } from '../context/RestaurantContext';
import { useLiveOrders } from '../hooks/useLiveOrders';
import { OrderCard } from '../components/OrderCard';
import { orderService } from '../services/orderService';
import { Loader2 } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import type { Order, OrderStatus } from '../types/order';
import { OrderAlertModal } from '../components/live/OrderAlertModal';
import { CancelOrderModal } from '../components/live/CancelOrderModal';

export const LiveOrders = () => {
  const { restaurant } = useRestaurant();
  const { orders, isLoading } = useLiveOrders(restaurant?.id);
  const [activeTab, setActiveTab] = useState<OrderStatus>('PLACED');
  const [cancellingOrder, setCancellingOrder] = useState<Order | null>(null);

  const handleAction = async (orderId: string, currentStatus: OrderStatus) => {
    let nextStatus: OrderStatus = currentStatus;
    if (currentStatus === 'PLACED') nextStatus = 'ACCEPTED';
    else if (currentStatus === 'ACCEPTED') nextStatus = 'PREPARING';
    else if (currentStatus === 'PREPARING') nextStatus = 'READY';
    if (nextStatus !== currentStatus) {
      await orderService.updateOrderStatus(orderId, nextStatus);
      // Auto-switch to next tab if it's a logical progression
      if (nextStatus !== 'READY') setActiveTab(nextStatus);
    }
  };

  const confirmCancel = async () => {
    if (!cancellingOrder) return;
    await orderService.updateOrderStatus(cancellingOrder.id, 'CANCELLED');
    setCancellingOrder(null);
  };

  const getStatusCount = (status: OrderStatus) => orders.filter(o => o.status === status).length;

  const filteredOrders = orders.filter(o => o.status === activeTab);

  if (isLoading) return (
    <div className="h-screen flex items-center justify-center">
      <Loader2 className="animate-spin text-brand-green" size={32} />
    </div>
  );

  const StatusTabs = () => (
    <div className="flex bg-gray-100 p-1 rounded-md gap-1 w-full md:w-fit overflow-x-auto no-scrollbar mb-8">
      <div className="flex gap-1 min-w-max">
        {(['PLACED', 'ACCEPTED', 'PREPARING', 'READY'] as OrderStatus[]).map((status) => (
          <button
            key={status}
            onClick={() => setActiveTab(status)}
            className={`px-5 py-2 rounded-sm font-black text-[10px] uppercase tracking-[0.2em] transition-all flex items-center gap-2 ${activeTab === status ? 'bg-white text-brand-green shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
          >
            {status}
            <span className={`px-1.5 py-0.5 rounded text-[8px] ${activeTab === status ? 'bg-brand-green text-white' : 'bg-gray-200 text-gray-500'}`}>
              {getStatusCount(status)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto px-4 md:px-8 pb-32 no-scrollbar bg-[#f9fafb]">
      <OrderAlertModal />

      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-[#f9fafb]/80 backdrop-blur-md pb-4 pt-4 md:pt-8 -mx-4 md:-mx-8 px-4 md:px-8 mb-4 border-b border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4 md:gap-6">
          <h1 className="text-xl md:text-2xl font-black text-gray-900 uppercase tracking-tight italic">LIVE ORDERS</h1>
          <div className="h-6 md:h-8 w-px bg-gray-200"></div>
          <div className="bg-brand-green/10 px-3 py-1 rounded border border-brand-green/20">
            <span className="text-[10px] font-black text-brand-green uppercase tracking-widest leading-none block">{orders.length} TOTAL</span>
          </div>
        </div>
      </div>

      <StatusTabs />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <AnimatePresence mode="popLayout">
          {filteredOrders.map((order) => (
            <OrderCard 
              key={order.id} 
              order={order} 
              onAction={handleAction} 
              onCancel={(o) => setCancellingOrder(o)}
            />
          ))}
          {filteredOrders.length === 0 && (
            <div className="col-span-full py-16 bg-white border border-gray-100 rounded flex flex-col items-center justify-center text-gray-400 gap-4">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center">
                <Loader2 className="animate-pulse text-gray-200" size={32} />
              </div>
              <div className="text-center">
                <p className="font-black uppercase text-[10px] tracking-[0.3em] text-gray-300">No {activeTab} Orders</p>
                <p className="text-[9px] font-bold text-gray-200 uppercase mt-2">Operational Pipeline Clear</p>
              </div>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Store Status Overlay */}
      <div className="fixed bottom-6 right-0 left-0 md:left-auto md:right-6 flex justify-center md:block px-6 z-40">
        <div className="bg-white px-5 py-3 rounded shadow-2xl border border-gray-200 flex items-center gap-4 w-full max-w-xs md:w-auto">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Status</span>
          <div className="flex-1 md:flex-none flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded border border-gray-100">
            <div className={`w-2 h-2 rounded-full ${restaurant?.is_open ? 'bg-brand-green animate-pulse' : 'bg-red-500'}`} />
            <span className="text-xs font-black text-gray-900 uppercase italic">{restaurant?.is_open ? 'Armed' : 'Standby'}</span>
          </div>
        </div>
      </div>

      <CancelOrderModal 
        order={cancellingOrder}
        onClose={() => setCancellingOrder(null)}
        onConfirm={confirmCancel}
      />
    </div>
  );
};
