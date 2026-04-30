import { useState, useEffect, useMemo } from 'react';
import { useRestaurant } from '../context/RestaurantContext';
import { orderService } from '../services/orderService';
import { OrderDetailModal } from '../components/history/OrderDetailModal';
import { 
  Search, 
  Loader2, 
  TrendingUp, 
  CheckCircle2, 
  XCircle,
  Clock,
  User,
  Star
} from 'lucide-react';
import { format } from 'date-fns';

export const OrderHistory = () => {
  const { restaurant } = useRestaurant();
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;
  const [filters, setFilters] = useState({
    status: 'ALL',
    dateRange: 'ALL',
    search: ''
  });

  useEffect(() => {
    if (restaurant?.id) {
      setCurrentPage(1); // Reset page on filter change
      loadHistory();
    }
  }, [restaurant?.id, filters.status, filters.dateRange]);

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const data = await orderService.fetchOrderHistory(restaurant!.id, filters);
      setOrders(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return orders.slice(start, start + itemsPerPage);
  }, [orders, currentPage]);

  const totalPages = Math.ceil(orders.length / itemsPerPage);

  const stats = useMemo(() => {
    const total = orders.reduce((acc, o) => acc + (o.status === 'DELIVERED' ? (o.total_amount || 0) : 0), 0);
    const count = orders.length;
    const cancelled = orders.filter(o => o.status === 'CANCELLED').length;
    return { total, count, cancelled };
  }, [orders]);

  return (
    <div className="flex-1 overflow-y-auto px-4 md:px-8 pb-24 no-scrollbar bg-[#f9fafb]">
      {/* Boxy Header */}
      <div className="sticky top-0 z-10 bg-[#f9fafb] pb-4 pt-4 md:pt-8 -mx-4 md:-mx-8 px-4 md:px-8 mb-4 border-b border-gray-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
          <h1 className="text-xl md:text-2xl font-black uppercase text-gray-900 tracking-tight italic">Order History</h1>
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <input 
              type="text" 
              placeholder="Search ID or Phone..."
              className="pl-9 pr-4 py-2 bg-white border border-gray-200 rounded text-xs font-bold outline-none focus:border-brand-green w-full transition-all"
              value={filters.search}
              onChange={(e) => setFilters({...filters, search: e.target.value})}
              onKeyDown={(e) => e.key === 'Enter' && loadHistory()}
            />
          </div>
        </div>

        {/* Boxy Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-6">
           <div className="bg-white border border-gray-200 p-4 rounded flex items-center gap-4">
              <div className="bg-brand-green/10 p-2 rounded text-brand-green shrink-0">
                 <TrendingUp size={16} />
              </div>
              <div>
                 <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">Earnings</p>
                 <h3 className="text-lg font-black text-gray-900">₹{stats.total.toLocaleString()}</h3>
              </div>
           </div>
           <div className="bg-white border border-gray-200 p-4 rounded flex items-center gap-4">
              <div className="bg-blue-50 p-2 rounded text-blue-500 shrink-0">
                 <CheckCircle2 size={16} />
              </div>
              <div>
                 <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">Orders</p>
                 <h3 className="text-lg font-black text-gray-900">{stats.count}</h3>
              </div>
           </div>
           <div className="bg-white border border-gray-200 p-4 rounded flex items-center gap-4">
              <div className="bg-red-50 p-2 rounded text-red-500 shrink-0">
                 <XCircle size={16} />
              </div>
              <div>
                 <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">Cancelled</p>
                 <h3 className="text-lg font-black text-gray-900">{stats.cancelled}</h3>
              </div>
           </div>
        </div>

        {/* Boxy Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
           <div className="inline-flex bg-gray-100 p-1 rounded gap-1 overflow-x-auto no-scrollbar">
              <div className="flex gap-1 min-w-max">
                {['ALL', 'DELIVERED', 'CANCELLED'].map(s => (
                  <button 
                    key={s}
                    onClick={() => setFilters({...filters, status: s})}
                    className={`px-4 py-1.5 rounded-sm text-[10px] font-black uppercase tracking-widest transition-all ${filters.status === s ? 'bg-white text-brand-green shadow-sm text-brand-green' : 'text-gray-400 hover:text-gray-600'}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
           </div>

           <div className="inline-flex bg-gray-100 p-1 rounded gap-1 overflow-x-auto no-scrollbar">
              <div className="flex gap-1 min-w-max">
                {['ALL', 'TODAY', 'YESTERDAY'].map(d => (
                  <button 
                    key={d}
                    onClick={() => setFilters({...filters, dateRange: d})}
                    className={`px-4 py-2 rounded-sm text-[10px] font-black uppercase tracking-widest transition-all ${filters.dateRange === d ? 'bg-white text-brand-green shadow-sm text-brand-green' : 'text-gray-400 hover:text-gray-600'}`}
                  >
                    {d}
                  </button>
                ))}
              </div>
           </div>
        </div>
      </div>

      {/* Boxy Grid */}
      <div className="pb-12">
        {isLoading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-4">
             <Loader2 className="animate-spin text-brand-green" size={24} />
             <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest animate-pulse">Scanning History...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="py-24 border border-dashed border-gray-200 rounded flex flex-col items-center justify-center text-gray-400 gap-2">
             <p className="text-[10px] font-black uppercase tracking-widest italic">No orders found</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {paginatedOrders.map((order) => (
                <div 
                  key={order.id} 
                  className="bg-white border border-gray-200 rounded p-6 flex flex-col justify-between hover:border-brand-green transition-all group"
                >
                  <div>
                     <div className="flex justify-between items-start mb-4">
                        <span className={`px-2 py-1 rounded-sm text-[8px] font-black uppercase tracking-widest ${
                          order.status === 'DELIVERED' ? 'bg-brand-green text-white' : 
                          order.status === 'CANCELLED' ? 'bg-red-500 text-white' : 'bg-blue-500 text-white'
                        }`}>
                          {order.status}
                        </span>
                        <div className="text-right">
                           <p className="text-xs font-black text-gray-900">₹{order.total_amount}</p>
                           <p className="text-[8px] font-bold text-gray-400 uppercase tracking-tighter">{order.payment_mode}</p>
                        </div>
                     </div>

                     <div className="mb-6">
                        <h4 className="text-xs font-black text-gray-900 uppercase mb-2">#{order.id.slice(0, 8)}</h4>
                        <div className="space-y-1">
                           <div className="flex items-center gap-2 text-[10px] font-bold text-gray-600 uppercase">
                              <User size={10} className="text-gray-300" /> {order.user?.name || 'Guest'}
                           </div>
                           <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase">
                              <Clock size={10} className="text-gray-300" /> {format(new Date(order.created_at), 'hh:mm a')}
                           </div>
                        </div>
                     </div>
                  </div>

                  <div className="pt-4 border-t border-gray-50 flex items-center justify-between gap-3">
                     <button 
                       onClick={() => setSelectedOrder(order)}
                       className="flex-1 bg-gray-50 text-gray-800 border border-gray-200 py-2 rounded font-black text-[10px] uppercase tracking-widest hover:bg-brand-green hover:text-white hover:border-brand-green transition-all"
                     >
                       View Detail
                     </button>
                     {order.rating && (
                       <div className="bg-yellow-400 text-white px-2 py-2 rounded flex items-center gap-1 font-black text-[10px]">
                          {order.rating} <Star size={10} fill="currentColor" />
                       </div>
                     )}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination Implementation */}
            {totalPages > 1 && (
              <div className="mt-12 flex items-center justify-between bg-white border border-gray-200 p-4 rounded">
                 <button 
                   onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                   disabled={currentPage === 1}
                   className="px-4 py-2 border border-gray-200 rounded font-black text-[10px] uppercase tracking-widest text-gray-500 disabled:opacity-30 hover:bg-gray-50 transition-all cursor-pointer disabled:cursor-not-allowed"
                 >
                   Previous
                 </button>
                 
                 <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    Page <span className="text-gray-900">{currentPage}</span> of <span className="text-gray-900">{totalPages}</span>
                 </div>

                 <button 
                   onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                   disabled={currentPage === totalPages}
                   className="px-4 py-2 border border-gray-200 rounded font-black text-[10px] uppercase tracking-widest text-gray-500 disabled:opacity-30 hover:bg-gray-50 transition-all cursor-pointer disabled:cursor-not-allowed"
                 >
                   Next
                 </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal Integration */}
      {selectedOrder && (
        <OrderDetailModal 
          isOpen={true} 
          order={selectedOrder} 
          onClose={() => setSelectedOrder(null)} 
        />
      )}
    </div>
  );
};
