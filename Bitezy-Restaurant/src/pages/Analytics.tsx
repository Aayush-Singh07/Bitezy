import { useState, useEffect } from 'react';
import { useRestaurant } from '../context/RestaurantContext';
import { analyticsService } from '../services/analyticsService';
import { 
  Clock, 
  Trash2, 
  Package, 
  Loader2, 
  BarChart3,
  Award,
  Zap,
  Target,
  Users,
  Info
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie
} from 'recharts';

const COLORS = ['#02844F', '#f87171', '#60a5fa', '#fbbf24'];

export const Analytics = () => {
  const { restaurant } = useRestaurant();
  const [data, setData] = useState<any>(null);
  const [ops, setOps] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeInfo, setActiveInfo] = useState<string | null>(null);

  const metricInfo: Record<string, { title: string, body: string, formula: string }> = {
    AOV: {
      title: 'Average Order Value',
      body: 'The average amount spent per delivered order. High AOV indicates effective upselling of combos.',
      formula: 'Revenue / Total Delivered Orders'
    },
    EARNINGS: {
      title: 'Gross Earnings',
      body: 'Total revenue collected from all successfully delivered orders. This is your core income.',
      formula: 'Sum(Delivered total_amount)'
    },
    VOLUME: {
      title: 'Total Volume',
      body: 'The total count of orders received by the restaurant, including those currently in progress.',
      formula: 'Count(All Orders)'
    },
    LOST: {
      title: 'Revenue Lost',
      body: 'Money that was nearly yours but lost due to cancellations. High leakage suggests prep delays.',
      formula: 'Sum(Cancelled total_amount)'
    },
    RETENTION: {
      title: 'Retention Score',
      body: 'The percentage of your business driven by loyal, returning customers vs. one-time trials.',
      formula: '(Returning User Orders / Total Orders) * 100'
    },
    HEARTBEAT: {
      title: 'Hourly Heartbeat',
      body: 'A 24-hour distribution of when your orders arrive. Used for optimizing staff shifts.',
      formula: 'Orders grouped by Hour(created_at)'
    },
    LOYALTY: {
      title: 'Customer Loyalty',
      body: 'A breakdown of your unique user base. Healthy brands have 30%+ returning fans.',
      formula: 'Count(Unique users with >1 order)'
    },
    PREP: {
      title: 'Kitchen Prep Speed',
      body: 'Average time your kitchen takes to cook. Target is under 15 minutes for Zomato-grade speed.',
      formula: 'Avg(Food Ready - Kitchen Started)'
    },
    CYCLE: {
      title: 'Total Delivery Cycle',
      body: 'The complete time from order acceptance to doorstep delivery. Includes rider transit.',
      formula: 'Avg(Delivered At - Accepted At)'
    },
    HERO: {
      title: 'Hero Products',
      body: 'Your top 5 items by frequency. These products drive your brand visibility.',
      formula: 'Sum(Quantity) grouped by Item/Combo'
    }
  };

  useEffect(() => {
    if (restaurant?.id) {
      loadAnalytics();
    }
  }, [restaurant?.id]);

  const loadAnalytics = async () => {
    setIsLoading(true);
    try {
      const [performance, operations, productIntel] = await Promise.all([
        analyticsService.getPerformanceOverview(restaurant!.id),
        analyticsService.getOperationalMetrics(restaurant!.id),
        analyticsService.getProductIntelligence(restaurant!.id)
      ]);
      setData(performance);
      setOps(operations);
      setProducts(productIntel);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const InfoModal = ({ type }: { type: string }) => {
    const info = metricInfo[type];
    if (!info) return null;
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setActiveInfo(null)}>
        <div className="bg-white border-2 border-brand-green w-full max-w-sm p-6 rounded shadow-2xl relative" onClick={e => e.stopPropagation()}>
           <button onClick={() => setActiveInfo(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-900 font-bold uppercase text-[10px]">Close</button>
           <h4 className="text-xs font-black text-brand-green uppercase tracking-widest mb-4 flex items-center gap-2">
              <Info size={14} /> {info.title}
           </h4>
           <p className="text-[10px] font-bold text-gray-700 uppercase leading-relaxed mb-4">{info.body}</p>
           <div className="bg-gray-50 border border-gray-100 p-3 rounded">
              <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Calculation Logic:</p>
              <p className="text-[9px] font-bold text-gray-900 italic">{info.formula}</p>
           </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-[#f9fafb]">
        <Loader2 className="animate-spin text-brand-green" size={32} />
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest animate-pulse">Accessing Data Vault...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 md:px-8 pb-32 no-scrollbar bg-[#f9fafb]">
      {/* Boxy Header */}
      <div className="sticky top-0 z-10 bg-[#f9fafb]/80 backdrop-blur-md pb-4 pt-4 md:pt-8 -mx-4 md:-mx-8 px-4 md:px-8 mb-4 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
           <BarChart3 className="text-brand-green" size={24} />
           <h1 className="text-xl md:text-2xl font-black uppercase text-gray-900 tracking-tight">Analytics</h1>
        </div>
        <div className="flex items-center gap-4 bg-white border border-gray-200 px-4 py-2 rounded shadow-sm w-fit">
           <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
              AOV <button onClick={() => setActiveInfo('AOV')} className="text-gray-300 hover:text-brand-green transition-colors cursor-pointer"><Info size={10} /></button> :
           </span>
           <span className="text-sm font-black text-gray-900 uppercase tracking-tighter">₹{data?.avgOrderValue}</span>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4 md:gap-8">
        
        {/* Main Revenue Area Chart */}
        <div className="col-span-12 xl:col-span-8 bg-white border border-gray-200 rounded p-4 md:p-8">
           <div className="flex justify-between items-start mb-8">
              <div>
                 <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1 italic flex items-center gap-2">
                    Earnings Pulse <button onClick={() => setActiveInfo('EARNINGS')} className="text-gray-300 hover:text-brand-green transition-colors cursor-pointer"><Info size={10} /></button>
                 </p>
                 <h2 className="text-4xl font-black text-gray-900">₹{data?.earnings.toLocaleString()}</h2>
              </div>
              <div className="text-right">
                 <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-1">Time Series</p>
                 <p className="text-[10px] font-black text-brand-green uppercase">Last 30 Days</p>
              </div>
           </div>
           
           <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                 <AreaChart data={data?.dailyTrend}>
                    <defs>
                       <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#02844F" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#02844F" stopOpacity={0}/>
                       </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1f1" />
                    <XAxis 
                       dataKey="name" 
                       axisLine={false} 
                       tickLine={false} 
                       tick={{fontSize: 8, fontWeight: 900, fill: '#94a3b8'}} 
                       dy={10}
                    />
                    <YAxis 
                       axisLine={false} 
                       tickLine={false} 
                       tick={{fontSize: 8, fontWeight: 900, fill: '#94a3b8'}}
                    />
                    <Tooltip 
                       contentStyle={{backgroundColor: '#111827', border: 'none', borderRadius: '4px', color: '#fff'}}
                       itemStyle={{fontSize: '10px', fontWeight: '900', color: '#fff', textTransform: 'uppercase'}}
                       labelStyle={{fontSize: '8px', color: '#94a3b8', marginBottom: '4px'}}
                    />
                    <Area type="monotone" dataKey="value" stroke="#02844F" strokeWidth={3} fillOpacity={1} fill="url(#colorVal)" />
                 </AreaChart>
              </ResponsiveContainer>
           </div>
        </div>

        {/* High-Impact Quick Stats */}
        <div className="col-span-12 xl:col-span-4 grid grid-cols-1 sm:grid-cols-3 xl:grid-cols-1 gap-6">
           <div className="bg-white border border-gray-200 rounded p-6 flex items-center justify-between group hover:border-brand-green transition-all">
              <div>
                 <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
                    Total Volume <button onClick={() => setActiveInfo('VOLUME')} className="text-gray-300 hover:text-brand-green transition-colors cursor-pointer"><Info size={10} /></button>
                 </p>
                 <h4 className="text-2xl font-black text-gray-900">{data?.totalOrders}</h4>
              </div>
              <div className="w-12 h-12 bg-gray-50 flex items-center justify-center rounded text-blue-500 group-hover:bg-blue-50">
                 <Package size={20} />
              </div>
           </div>
           <div className="bg-white border border-gray-200 rounded p-6 flex items-center justify-between group hover:border-red-500 transition-all">
              <div>
                 <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
                    Revenue Lost <button onClick={() => setActiveInfo('LOST')} className="text-gray-300 hover:text-brand-green transition-colors cursor-pointer"><Info size={10} /></button>
                 </p>
                 <h4 className="text-2xl font-black text-red-500">₹{data?.cancelledVolume.toLocaleString()}</h4>
              </div>
              <div className="w-12 h-12 bg-gray-50 flex items-center justify-center rounded text-red-500 group-hover:bg-red-50 border-gray-100">
                 <Trash2 size={20} />
              </div>
           </div>
           <div className="bg-black text-white rounded p-6 shadow-xl relative overflow-hidden">
              <div className="relative z-10">
                 <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
                    Retention Score <button onClick={() => setActiveInfo('RETENTION')} className="text-gray-500 hover:text-brand-green transition-colors cursor-pointer"><Info size={10} /></button>
                 </p>
                 <div className="flex items-center gap-3">
                    <h4 className="text-2xl font-black italic">
                       {Math.round((data?.retention?.[0]?.value / (data?.totalOrders || 1)) * 100)}% 
                    </h4>
                    <span className="text-[8px] font-black text-brand-green uppercase tracking-widest bg-brand-green/10 px-2 py-1 rounded">Growth</span>
                 </div>
                 <p className="text-[8px] mt-4 font-bold text-gray-500 uppercase">Returning Customers Index</p>
              </div>
              <Target className="absolute right-[-10px] bottom-[-10px] text-white/5" size={100} />
           </div>
        </div>

        {/* Peak Hours Heartbeat */}
        <div className="col-span-12 lg:col-span-7 bg-white border border-gray-200 rounded p-4 md:p-8">
           <div className="flex items-center gap-3 mb-8">
              <div className="bg-yellow-50 p-2 rounded text-yellow-500"><Zap size={18} /></div>
              <h4 className="text-[10px] font-black text-gray-900 uppercase tracking-[0.2em] flex items-center gap-2">
                 Hourly Heartbeat (24h) <button onClick={() => setActiveInfo('HEARTBEAT')} className="text-gray-300 hover:text-brand-green transition-colors cursor-pointer"><Info size={10} /></button>
              </h4>
           </div>
           <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={data?.hourlyData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1f1" />
                    <XAxis 
                       dataKey="label" 
                       axisLine={false} 
                       tickLine={false} 
                       tick={{fontSize: 7, fontWeight: 900, fill: '#94a3b8'}}
                    />
                    <Tooltip 
                       cursor={{fill: '#f9fafb'}}
                       contentStyle={{backgroundColor: '#111827', border: 'none', borderRadius: '4px'}}
                       itemStyle={{fontSize: '10px', fontWeight: '900', color: '#fff'}}
                       labelStyle={{fontSize: '8px', color: '#94a3b8'}}
                    />
                    <Bar dataKey="orders" radius={[2, 2, 0, 0]}>
                       {data?.hourlyData.map((_: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={data.hourlyData[index].orders > 5 ? '#02844F' : '#e2e8f0'} />
                       ))}
                    </Bar>
                 </BarChart>
              </ResponsiveContainer>
           </div>
        </div>

        {/* Loyalty Donut Chart */}
        <div className="col-span-12 lg:col-span-5 bg-white border border-gray-200 rounded p-4 md:p-8 flex flex-col items-center">
           <div className="w-full flex items-center gap-3 mb-8">
              <div className="bg-blue-50 p-2 rounded text-blue-500"><Users size={18} /></div>
              <h4 className="text-[10px] font-black text-gray-900 uppercase tracking-[0.2em] flex items-center gap-2">
                 Customer Loyalty <button onClick={() => setActiveInfo('LOYALTY')} className="text-gray-300 hover:text-brand-green transition-colors cursor-pointer"><Info size={10} /></button>
              </h4>
           </div>
           <div className="h-48 w-full flex items-center justify-center relative">
              <ResponsiveContainer width="100%" height="100%">
                 <PieChart>
                    <Pie
                       data={data?.retention}
                       innerRadius={60}
                       outerRadius={80}
                       paddingAngle={5}
                       dataKey="value"
                    >
                       {data?.retention.map((_: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                       ))}
                    </Pie>
                    <Tooltip />
                 </PieChart>
              </ResponsiveContainer>
              <div className="absolute flex flex-col items-center">
                 <p className="text-[10px] font-black text-gray-300 uppercase">Users</p>
                 <span className="text-xl font-black">{data?.retention?.[0]?.value + data?.retention?.[1]?.value}</span>
              </div>
           </div>
           <div className="w-full mt-6 flex justify-center gap-8">
              {data?.retention.map((r: any, i: number) => (
                <div key={i} className="flex items-center gap-2">
                   <div className="w-2 h-2 rounded-full" style={{backgroundColor: COLORS[i]}} />
                   <span className="text-[8px] font-black text-gray-500 uppercase">{r.name} ({r.value})</span>
                </div>
              ))}
           </div>
        </div>

        {/* Operational Pulse Bars */}
        <div className="col-span-12 lg:col-span-7 bg-white border border-gray-200 rounded p-4 md:p-8">
           <div className="flex items-center gap-3 mb-8">
              <Clock size={18} className="text-brand-green" />
              <h4 className="text-[10px] font-black text-gray-900 uppercase tracking-[0.2em]">Operational Speed</h4>
           </div>
           <div className="space-y-10">
              <div>
                 <div className="flex justify-between mb-3 items-end">
                    <div>
                       <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1 flex items-center gap-1">
                          Kitchen Prep <button onClick={() => setActiveInfo('PREP')} className="text-gray-300 hover:text-brand-green transition-colors cursor-pointer"><Info size={10} /></button>
                       </p>
                       <span className="text-lg font-black text-gray-900 italic">{ops?.avgPrepTime}<span className="text-xs text-gray-300 not-italic ml-1">mins</span></span>
                    </div>
                    <span className="text-[8px] font-black text-brand-green uppercase bg-green-50 px-2 py-1">Ideal Range: 10-15m</span>
                 </div>
                 <div className="h-1.5 bg-gray-50 rounded-full overflow-hidden border border-gray-100">
                    <div 
                      className={`h-full transition-all duration-1000 ${ops?.avgPrepTime > 15 ? 'bg-orange-400' : 'bg-brand-green'}`} 
                      style={{ width: `${Math.min((ops?.avgPrepTime / 30) * 100, 100)}%` }} 
                    />
                 </div>
              </div>
              <div>
                 <div className="flex justify-between mb-3 items-end">
                    <div>
                       <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1 flex items-center gap-1">
                          Total Delivery Cycle <button onClick={() => setActiveInfo('CYCLE')} className="text-gray-300 hover:text-brand-green transition-colors cursor-pointer"><Info size={10} /></button>
                       </p>
                       <span className="text-lg font-black text-gray-900 italic">{ops?.avgDeliveryTime}<span className="text-xs text-gray-300 not-italic ml-1">mins</span></span>
                    </div>
                    <span className="text-[8px] font-black text-blue-500 uppercase bg-blue-50 px-2 py-1">Benchmark: 30-45m</span>
                 </div>
                 <div className="h-1.5 bg-gray-50 rounded-full overflow-hidden border border-gray-100">
                    <div 
                      className="bg-blue-500 h-full transition-all duration-1000" 
                      style={{ width: `${Math.min((ops?.avgDeliveryTime / 60) * 100, 100)}%` }} 
                    />
                 </div>
              </div>
           </div>
        </div>

        {/* Hero Products Feed */}
        <div className="col-span-12 lg:col-span-5 bg-white border border-gray-200 rounded p-4 md:p-8">
           <div className="flex items-center gap-3 mb-8">
              <Award size={18} className="text-brand-green" />
              <h4 className="text-[10px] font-black text-gray-900 uppercase tracking-[0.2em] flex items-center gap-2">
                 Hero Products <button onClick={() => setActiveInfo('HERO')} className="text-gray-300 hover:text-brand-green transition-colors cursor-pointer"><Info size={10} /></button>
              </h4>
           </div>
           
           <div className="space-y-5">
              {products.map((p, i) => (
                <div key={i} className="flex items-center justify-between group p-3 border border-transparent hover:border-gray-50 hover:bg-gray-50 transition-all rounded">
                   <div className="flex items-center gap-4">
                      <span className="text-xs font-black text-gray-200">#0{i+1}</span>
                      <div>
                         <p className="text-[10px] font-black text-gray-800 uppercase leading-none">{p.name}</p>
                         <p className="text-[8px] font-bold text-gray-300 uppercase mt-1 tracking-tighter">Velocity Rising</p>
                      </div>
                   </div>
                   <div className="bg-white px-3 py-1.5 border border-gray-100 text-[10px] font-black text-brand-green uppercase group-hover:bg-brand-green group-hover:text-white group-hover:border-brand-green transition-all shadow-sm">
                      {p.qty} Sold
                   </div>
                </div>
              ))}
           </div>
        </div>
      </div>

      {activeInfo && <InfoModal type={activeInfo} />}
    </div>
  );
};
