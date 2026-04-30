import { useState, useEffect } from 'react';
import { useRestaurant } from '../context/RestaurantContext';
import { restaurantService } from '../services/restaurantService';
import { Loader2, Save, Globe, Clock, MapPin, Image as ImageIcon, Check } from 'lucide-react';

export const Settings = () => {
  const { restaurant, setRestaurant, refreshRestaurant } = useRestaurant();
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [formData, setFormData] = useState<any>({
    name: '',
    is_open: false,
    open_time: '',
    close_time: '',
    image_url: '',
    lat: '',
    long: '',
  });

  useEffect(() => {
    refreshRestaurant();
  }, []);

  useEffect(() => {
    if (restaurant) {
      setFormData({
        name: restaurant.name || '',
        is_open: restaurant.is_open || false,
        open_time: restaurant.open_time?.slice(0, 5) || '',
        close_time: restaurant.close_time?.slice(0, 5) || '',
        image_url: restaurant.image_url || '',
        lat: restaurant.lat || '',
        long: restaurant.long || '',
      });
    }
  }, [restaurant]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurant?.id) return;

    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const updated = await restaurantService.updateRestaurant(restaurant.id, {
        ...formData,
        lat: formData.lat ? parseFloat(formData.lat) : null,
        long: formData.long ? parseFloat(formData.long) : null,
      });
      setRestaurant(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Error updating settings:', error);
      alert('Failed to save settings. Check console for details.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!restaurant) return (
    <div className="h-screen flex items-center justify-center">
      <Loader2 className="animate-spin text-brand-green" size={32} />
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto px-8 pb-24">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-[#f9fafb] pb-6 pt-8 -mx-8 px-8 mb-8 border-b border-gray-200 flex items-center justify-between">
        <h1 className="text-2xl font-bold uppercase text-gray-900 tracking-tight">Store Settings</h1>
        <button 
          onClick={handleSubmit}
          disabled={isSaving}
          className="bg-brand-green text-white px-6 py-2.5 rounded-md font-bold flex items-center gap-2 hover:bg-brand-hover transition-all uppercase text-[10px] tracking-wider disabled:opacity-50"
        >
          {isSaving ? <Loader2 size={16} className="animate-spin" /> : saveSuccess ? <Check size={16} /> : <Save size={16} />}
          {isSaving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save Changes'}
        </button>
      </div>

      <div className="max-w-4xl space-y-8">
        {/* General Management */}
        <section className="bg-white border border-gray-200 rounded-lg p-8">
          <div className="flex items-center gap-3 mb-6">
            <Globe size={18} className="text-brand-green" />
            <h2 className="text-sm font-black uppercase tracking-widest text-gray-900">General Management</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 block">Restaurant Name</label>
              <input 
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand-green transition-all font-bold" 
                value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} 
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 block">Store Status</label>
              <button 
                type="button"
                onClick={() => setFormData({...formData, is_open: !formData.is_open})}
                className={`w-full flex items-center justify-between px-4 py-3 border rounded transition-all ${formData.is_open ? 'bg-white border-brand-green text-brand-green shadow-sm' : 'bg-red-50 border-red-200 text-red-500'}`}
              >
                <span className="font-bold text-xs uppercase tracking-wider">{formData.is_open ? 'ONLINE' : 'OFFLINE'}</span>
                <div className={`w-3 h-3 rounded-full ${formData.is_open ? 'bg-brand-green' : 'bg-red-500'} animate-pulse`} />
              </button>
            </div>
          </div>
        </section>

        {/* Operational Hours */}
        <section className="bg-white border border-gray-200 rounded-lg p-8">
          <div className="flex items-center gap-3 mb-6">
            <Clock size={18} className="text-brand-green" />
            <h2 className="text-sm font-black uppercase tracking-widest text-gray-900">Operational Hours</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 block">Opening Time</label>
              <input 
                type="time"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand-green transition-all" 
                value={formData.open_time} onChange={e => setFormData({...formData, open_time: e.target.value})} 
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 block">Closing Time</label>
              <input 
                type="time"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand-green transition-all" 
                value={formData.close_time} onChange={e => setFormData({...formData, close_time: e.target.value})} 
              />
            </div>
          </div>
        </section>

        {/* Store Appearance */}
        <section className="bg-white border border-gray-200 rounded-lg p-8">
          <div className="flex items-center gap-3 mb-6">
            <ImageIcon size={18} className="text-brand-green" />
            <h2 className="text-sm font-black uppercase tracking-widest text-gray-900">Store Appearance</h2>
          </div>
          
          <div className="space-y-6">
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 block">Header Image URL</label>
              <input 
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand-green transition-all font-mono text-xs" 
                value={formData.image_url} onChange={e => setFormData({...formData, image_url: e.target.value})} 
                placeholder="https://images.unsplash.com/..."
              />
            </div>
            {formData.image_url && (
              <div className="relative h-40 rounded-lg overflow-hidden border border-gray-100">
                <img src={formData.image_url} alt="Store" className="w-full h-full object-cover" />
              </div>
            )}
          </div>
        </section>

        {/* Store Location */}
        <section className="bg-white border border-gray-200 rounded-lg p-8">
          <div className="flex items-center gap-3 mb-6">
            <MapPin size={18} className="text-brand-green" />
            <h2 className="text-sm font-black uppercase tracking-widest text-gray-900">Store Location</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 block">Latitude</label>
              <input 
                type="number" step="any"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand-green transition-all font-mono text-xs" 
                value={formData.lat} onChange={e => setFormData({...formData, lat: e.target.value})} 
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 block">Longitude</label>
              <input 
                type="number" step="any"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand-green transition-all font-mono text-xs" 
                value={formData.long} onChange={e => setFormData({...formData, long: e.target.value})} 
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
