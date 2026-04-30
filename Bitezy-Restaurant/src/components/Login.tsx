import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useRestaurant } from '../context/RestaurantContext';
import { motion } from 'framer-motion';
import { Loader2, ChevronDown } from 'lucide-react';

export const Login = () => {
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { setRestaurant } = useRestaurant();

  useEffect(() => {
    fetchRestaurants();
  }, []);

  const fetchRestaurants = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('restaurants')
      .select('id, name, is_open, current_load');
    
    if (data) setRestaurants(data);
    if (error) setError('Failed to load restaurants. Check connection.');
    setLoading(false);
  };

  const handleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = restaurants.find(r => r.id === e.target.value);
    if (selected) {
      setRestaurant(selected);
      localStorage.setItem('bitezy_restaurant_id', selected.id);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#f9fafb]">
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white border-2 border-black w-full max-w-sm p-10 rounded-md shadow-sm text-center"
      >
        <div className="w-24 h-24 mx-auto mb-8 bg-white overflow-hidden flex items-center justify-center">
          <img src="/brandlogo.png" alt="Bitezy Logo" className="w-full h-full object-contain" />
        </div>
        
        <h1 className="text-3xl font-black text-gray-900 mb-2 uppercase tracking-tight italic">BITEZY RMS</h1>
        <p className="text-[10px] font-black text-gray-400 mb-10 uppercase tracking-[0.2em]">Operational Terminal Access</p>

        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="animate-spin text-brand-green" size={32} />
          </div>
        ) : (
          <div className="relative group">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block text-left">Select Station</label>
            <select 
              onChange={handleSelect}
              defaultValue=""
              className="w-full appearance-none bg-white border-2 border-black rounded-md px-5 py-4 text-gray-900 font-black uppercase text-xs tracking-widest focus:outline-none transition-all cursor-pointer shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
            >
              <option value="" disabled>Identification Required...</option>
              {restaurants.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
            <div className="absolute right-5 top-[3.25rem] -translate-y-1/2 pointer-events-none text-black">
              <ChevronDown size={18} strokeWidth={3} />
            </div>
          </div>
        )}

        {error && (
          <div className="mt-8 p-3 bg-red-50 border border-red-200 text-red-600 text-[10px] font-black uppercase tracking-widest">
            {error}
          </div>
        )}
      </motion.div>
    </div>
  );
};
