import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { Trash2, X } from 'lucide-react';
import type { Order } from '../../types/order';

interface CancelOrderModalProps {
  order: Order | null;
  onClose: () => void;
  onConfirm: () => void;
}

const CancelSlider = ({ onConfirm }: { onConfirm: () => void }) => {
  const x = useMotionValue(0);
  const background = useTransform(x, [0, -80], ["#f3f4f6", "#ef4444"]);
  const opacity = useTransform(x, [0, -80], [0, 1]);

  const handleDragEnd = (_: any, info: any) => {
    if (info.offset.x < -80) {
      onConfirm();
    }
  };

  return (
    <div className="relative w-full h-16 bg-gray-100 border-2 border-black rounded-md overflow-hidden flex items-center justify-center">
      <motion.div 
        style={{ background }}
        className="absolute inset-0 transition-colors"
      />
      
      <div className="absolute inset-0 flex items-center justify-start pl-10 pointer-events-none">
        <motion.span style={{ opacity }} className="text-white font-black text-[10px] uppercase tracking-[0.2em]">Confirm Cancellation</motion.span>
      </div>

      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Slide Left to Terminate</span>
      </div>

      <motion.div
        drag="x"
        dragConstraints={{ left: -150, right: 0 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        style={{ x }}
        className="w-14 h-12 bg-white border-2 border-black rounded shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] z-10 cursor-grab active:cursor-grabbing flex items-center justify-center"
      >
        <Trash2 size={18} className="text-black/20" />
      </motion.div>
    </div>
  );
};

export const CancelOrderModal = ({ order, onClose, onConfirm }: CancelOrderModalProps) => {
  if (!order) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
        <motion.div 
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          className="bg-white border-2 border-black w-full max-w-sm p-8 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] rounded-md relative"
        >
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-black transition-colors"
          >
            <X size={20} />
          </button>

          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-red-50 border-2 border-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <Trash2 className="text-red-500" size={24} />
            </div>
            <h2 className="text-2xl font-black text-gray-900 uppercase italic tracking-tight mb-2">Terminate Order?</h2>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Identity Verification Required</p>
          </div>

          <div className="bg-gray-50 border border-gray-100 p-5 rounded mb-8">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] font-black text-gray-400 uppercase">Order ID</span>
              <span className="text-xs font-black uppercase italic text-gray-900">#{order.id.slice(0, 8)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black text-gray-400 uppercase">Impact Amount</span>
              <span className="text-xs font-black uppercase italic text-red-500">₹{order.total_amount}</span>
            </div>
          </div>

          <div className="space-y-4">
            <CancelSlider onConfirm={onConfirm} />
            <button 
              onClick={onClose}
              className="w-full py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-black transition-colors"
            >
              Abort Cancellation
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
