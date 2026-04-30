import { 
  X, 
  User, 
  Phone, 
  Star, 
  CheckCircle2
} from 'lucide-react';
import { format } from 'date-fns';

type OrderDetailModalProps = {
  order: any;
  isOpen: boolean;
  onClose: () => void;
};

export const OrderDetailModal = ({ order, isOpen, onClose }: OrderDetailModalProps) => {
  if (!isOpen || !order) return null;

  const timelineSteps = [
    { label: 'Received', time: order.created_at },
    { label: 'Accepted', time: order.accepted_at },
    { label: 'Cooking', time: order.prep_started_at },
    { label: 'Ready', time: order.prep_completed_at },
    { label: 'Picked Up', time: order.picked_up_at },
    { label: 'En-route', time: order.arrived_at },
    { label: 'Delivered', time: order.delivered_at },
    { label: 'Cancelled', time: order.cancelled_at }
  ].filter(step => step.time);

  return (
    <div 
      className="fixed inset-0 z-[60] flex items-center justify-end bg-black/20"
      onClick={onClose}
    >
      <div 
        className="h-full w-full max-w-lg bg-white shadow-2xl flex flex-col no-scrollbar overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Boxy Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-xl font-black text-gray-900 uppercase">Order Details</h2>
              <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${
                order.status === 'DELIVERED' ? 'bg-brand-green text-white' : 
                order.status === 'CANCELLED' ? 'bg-red-500 text-white' : 'bg-blue-500 text-white'
              }`}>
                {order.status}
              </span>
            </div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest italic">ID: #{order.id.slice(0, 12)}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded transition-all text-gray-400 border border-transparent hover:border-gray-200">
            <X size={20} />
          </button>
        </div>

        <div className="p-8 space-y-10 pb-24">
          {/* Simple Customer/Rating */}
          <section className="border-b border-gray-100 pb-8">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-gray-50 border border-gray-200 rounded flex items-center justify-center text-gray-300">
                  <User size={20} />
                </div>
                <div>
                  <h3 className="font-black text-gray-900 uppercase text-sm">{order.user?.name || 'Guest User'}</h3>
                  <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    <Phone size={10} /> {order.user?.phone || 'No phone'}
                  </div>
                </div>
              </div>
              {order.rating && (
                <div className="flex items-center gap-1 bg-yellow-400 text-white px-2 py-1 rounded font-black text-xs uppercase">
                  {order.rating} <Star size={10} fill="currentColor" />
                </div>
              )}
            </div>
            {order.rating_comment && (
              <div className="bg-gray-50 border border-gray-200 p-4 rounded text-gray-600 text-xs font-bold uppercase italic">
                "{order.rating_comment}"
              </div>
            )}
          </section>

          {/* Simple Updates */}
          <section>
            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6 px-1">Order Log</h4>
            <div className="space-y-4">
              {timelineSteps.map((step, idx) => (
                <div key={idx} className="flex items-center justify-between border border-gray-100 p-4 rounded">
                  <div className="flex items-center gap-3">
                    <div className="w-1 h-3 bg-brand-green/30" />
                    <span className="text-[10px] font-black text-gray-700 uppercase tracking-widest">{step.label}</span>
                  </div>
                  <span className="text-[10px] font-bold text-gray-400 tabular-nums">
                    {format(new Date(step.time), 'hh:mm a')}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Simple Bill */}
          <section className="bg-gray-50 border border-gray-200 rounded p-6">
             <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6 border-b border-gray-200 pb-2">Bill Summary</h4>
             <div className="space-y-4">
               {order.order_items?.map((oi: any, i: number) => (
                 <div key={i} className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] font-black text-gray-800 uppercase">{oi.item?.name || oi.combo?.name}</p>
                      <p className="text-[9px] font-bold text-gray-400 uppercase">Qty: {oi.quantity}</p>
                    </div>
                    <span className="text-[10px] font-black text-gray-900">₹{(oi.price * oi.quantity).toLocaleString()}</span>
                 </div>
               ))}
               
               <div className="h-px bg-gray-200 mt-4 mb-2" />
               
               <div className="space-y-1.5 pt-2">
                 <div className="flex justify-between text-[9px] font-bold text-gray-400 uppercase">
                   <span>Items</span>
                   <span>₹{(order.total_item_amount || 0).toLocaleString()}</span>
                 </div>
                 <div className="flex justify-between text-[9px] font-bold text-gray-400 uppercase">
                   <span>Delivery</span>
                   <span>₹{(order.delivery_fee || 0).toLocaleString()}</span>
                 </div>
                 <div className="flex justify-between pt-3">
                   <span className="text-[10px] font-black text-gray-900 uppercase">Total Paid</span>
                   <span className="text-sm font-black text-brand-green">₹{(order.total_amount || 0).toLocaleString()}</span>
                 </div>
               </div>
             </div>
          </section>

          {/* Simple Status */}
          <div className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded mb-12">
             <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Method: {order.payment_mode}</span>
             <CheckCircle2 size={16} className="text-brand-green" />
          </div>
        </div>
      </div>
    </div>
  );
};
