import { motion } from 'framer-motion';
import { Clock, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Order, OrderStatus } from '../types/order';

interface OrderCardProps {
  order: Order;
  onAction: (id: string, status: OrderStatus) => void;
  onCancel: (order: Order) => void;
}

export const OrderCard = ({ order, onAction, onCancel }: OrderCardProps) => {
  const getStatusConfig = (status: OrderStatus) => {
    switch(status) {
      case 'PLACED': return { label: 'ACCEPT ORDER', color: 'bg-brand-green', textColor: 'text-white' };
      case 'ACCEPTED': return { label: 'START PREP', color: 'bg-orange-500', textColor: 'text-white' };
      case 'PREPARING': return { label: 'MARK READY', color: 'bg-gray-100', textColor: 'text-gray-600' };
      default: return { label: status, color: 'bg-gray-100', textColor: 'text-gray-400' };
    }
  };

  const config = getStatusConfig(order.status);

  return (
    <motion.div 
      layout 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }} 
      className="card flex flex-col hover:border-brand-green/50 transition-colors"
    >
      <div className="p-4 bg-gray-50/50 flex justify-between items-center border-b border-gray-100">
        <span className="font-mono font-bold text-gray-900 text-sm">#{order.id.slice(0, 4).toUpperCase()}</span>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => onCancel(order)}
            className="text-gray-300 hover:text-red-500 transition-colors p-1 -m-1"
          >
            <Trash2 size={16} />
          </button>
          <div className="w-px h-4 bg-gray-200"></div>
          <Clock size={16} className="text-gray-300" />
        </div>
      </div>
      <div className="p-5 flex-1 space-y-3">
        {order.order_items?.map((item: any, idx) => (
          <div key={idx} className="flex gap-3 text-sm font-medium text-gray-800">
            <span className="text-brand-green font-bold">{item.quantity}x</span>
            <span>{item.item?.name || item.combo?.name || 'Unknown Item'}</span>
          </div>
        ))}
      </div>
      <div className="p-5 pt-0 mt-auto flex flex-col gap-3">
        <button 
          onClick={() => onAction(order.id, order.status)} 
          className={`w-full py-3 rounded-md font-bold uppercase tracking-wider text-[10px] transition-all active:scale-95 ${config.color} ${config.textColor}`}
        >
          {config.label}
        </button>
        <span className="text-[10px] font-bold text-gray-400 text-center uppercase">
          {formatDistanceToNow(new Date(order.created_at))} ago
        </span>
      </div>
    </motion.div>
  );
};
