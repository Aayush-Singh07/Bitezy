import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { useState, useEffect } from 'react';
import { useOrderAlerts } from '../../context/OrderAlertContext';
import { orderService } from '../../services/orderService';
import type { Order } from '../../types/order';

const ActionSlider = ({ onAccept, onReject }: { onAccept: () => void, onReject: () => void }) => {
  const x = useMotionValue(0);
  const background = useTransform(
    x,
    [-100, 0, 100],
    ["#ef4444", "#f3f4f6", "#02844F"]
  );
  const opacityL = useTransform(x, [0, -80], [0, 1]);
  const opacityR = useTransform(x, [0, 80], [0, 1]);

  const handleDragEnd = (_: any, info: any) => {
    if (info.offset.x > 80) {
      onAccept();
    } else if (info.offset.x < -80) {
      onReject();
    }
  };

  return (
    <div className="relative w-full h-16 bg-gray-100 border-2 border-black rounded-md overflow-hidden flex items-center justify-center">
      <motion.div 
        style={{ background }}
        className="absolute inset-0 transition-colors"
      />
      
      {/* Action Hints */}
      <div className="absolute inset-0 flex justify-between items-center px-10 pointer-events-none">
        <motion.span style={{ opacity: opacityL }} className="text-white font-black text-[10px] uppercase tracking-widest">Reject</motion.span>
        <motion.span style={{ opacity: opacityR }} className="text-white font-black text-[10px] uppercase tracking-widest">Accept</motion.span>
      </div>

      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Authorize</span>
      </div>

      <motion.div
        drag="x"
        dragConstraints={{ left: -120, right: 120 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        style={{ x }}
        className="w-14 h-12 bg-white border-2 border-black rounded shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] z-10 cursor-grab active:cursor-grabbing flex items-center justify-center"
      >
        <div className="flex gap-1">
          <div className="w-1 h-4 bg-black/10 rounded-full" />
          <div className="w-1 h-4 bg-black/10 rounded-full" />
          <div className="w-1 h-4 bg-black/10 rounded-full" />
        </div>
      </motion.div>
    </div>
  );
};

export const OrderAlertModal = () => {
  const { placedOrders } = useOrderAlerts();
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (placedOrders.length > 0) {
      setActiveOrder(placedOrders[0]);
    } else {
      setActiveOrder(null);
    }
  }, [placedOrders]);

  if (!activeOrder) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white border-2 border-black w-full max-w-sm p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-md"
        >
          <div className="mb-6">
             <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 italic">Identification Req</p>
             <h2 className="text-xl font-black text-gray-900 uppercase italic">ORDER #{activeOrder.id.slice(0, 8)}</h2>
          </div>

          <div className="space-y-3 mb-8 bg-gray-50/50 p-4 rounded border border-gray-100">
             {activeOrder.order_items.map((oi, i) => (
                <div key={i} className="flex justify-between items-center text-[10px] font-black uppercase tracking-tight">
                   <div className="flex gap-2 items-center">
                      <span className="bg-brand-green/10 text-brand-green px-1.5 py-0.5 rounded leading-none">{oi.quantity}x</span>
                      <span>{oi.name}</span>
                   </div>
                   <span className="text-gray-400">₹{oi.price}</span>
                </div>
             ))}
             <div className="pt-3 border-t border-gray-200 flex justify-between items-center text-xs font-black uppercase italic">
                <span>Total Amount</span>
                <span className="text-brand-green">₹{activeOrder.total_amount}</span>
             </div>
          </div>

          <ActionSlider 
            onAccept={() => orderService.updateOrderStatus(activeOrder.id, 'ACCEPTED')}
            onReject={() => orderService.updateOrderStatus(activeOrder.id, 'CANCELLED')}
          />
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

