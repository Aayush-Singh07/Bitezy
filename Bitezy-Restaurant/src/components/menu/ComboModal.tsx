import { useState, useEffect } from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import { menuService, type Combo, type MenuItem } from '../../services/menuService';
import { BitezyModal } from '../BitezyModal';
import { Check } from 'lucide-react';

interface ComboModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  initialData: Combo | null;
  availableItems: MenuItem[];
}

export const ComboModal = ({ isOpen, onClose, onSave, initialData, availableItems }: ComboModalProps) => {
  const { restaurant } = useRestaurant();
  const [formData, setFormData] = useState<any>({ 
    name: '', price: '', gimmick_price: '', items_json: [], description: '', image_url: '', is_available: true 
  });

  useEffect(() => {
    if (initialData) setFormData(initialData);
    else setFormData({ 
      name: '', 
      price: '', 
      gimmick_price: '', 
      items_json: [], 
      description: '', 
      image_url: '', 
      is_available: true,
      is_high_protein: false,
      highly_reordered: false
    });
  }, [initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurant?.id) return;
    await menuService.upsertCombo({ 
      ...formData, 
      restaurant_id: restaurant.id, 
      price: parseInt(formData.price),
      gimmick_price: formData.gimmick_price ? parseInt(formData.gimmick_price) : null,
      is_high_protein: !!formData.is_high_protein,
      highly_reordered: !!formData.highly_reordered
    });
    onSave(); 
    onClose();
  };

  const toggleItemInCombo = (itemName: string) => {
    const exists = formData.items_json.find((i: any) => i.name === itemName);
    if (exists) setFormData({ ...formData, items_json: formData.items_json.filter((i: any) => i.name !== itemName) });
    else setFormData({ ...formData, items_json: [...formData.items_json, { name: itemName, qty: 1 }] });
  };

  return (
    <BitezyModal isOpen={isOpen} onClose={onClose} title={initialData ? 'Edit Combo' : 'Add Combo'}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">Name</label>
            <input 
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded outline-none" 
              value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required 
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">Selling Price (₹)</label>
            <input 
              type="number" 
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded outline-none" 
              value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} required 
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">Gimmick Price (₹)</label>
            <input 
              type="number" 
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded outline-none" 
              value={formData.gimmick_price || ''} onChange={e => setFormData({...formData, gimmick_price: e.target.value})} 
              placeholder="MRP / Original Price"
            />
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">Status</label>
            <select 
              className={`w-full px-4 py-3 border rounded outline-none font-bold ${formData.is_available ? 'bg-white border-brand-green text-brand-green' : 'bg-red-50 border-red-200 text-red-500'}`} 
              value={formData.is_available ? 'true' : 'false'} 
              onChange={e => setFormData({...formData, is_available: e.target.value === 'true'})}
            >
              <option value="true">Available</option>
              <option value="false">Out of Stock</option>
            </select>
          </div>
        </div>

        {/* Special Tags */}
        <div className="grid grid-cols-2 gap-4">
          <label className={`flex items-center gap-3 p-3 border rounded cursor-pointer transition-all ${formData.is_high_protein ? 'bg-brand-green/5 border-brand-green' : 'bg-white border-gray-100'}`}>
            <input 
              type="checkbox" 
              className="accent-brand-green"
              checked={formData.is_high_protein} 
              onChange={e => setFormData({...formData, is_high_protein: e.target.checked})} 
            />
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-700">High Protein</span>
          </label>
          <label className={`flex items-center gap-3 p-3 border rounded cursor-pointer transition-all ${formData.highly_reordered ? 'bg-brand-green/5 border-brand-green' : 'bg-white border-gray-100'}`}>
            <input 
              type="checkbox" 
              className="accent-brand-green"
              checked={formData.highly_reordered} 
              onChange={e => setFormData({...formData, highly_reordered: e.target.checked})} 
            />
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-700">Popular (Highly Reordered)</span>
          </label>
        </div>

        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 block">Included Products</label>
          <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-3 border border-gray-200 rounded-lg bg-gray-50">
            {availableItems.map((item: any) => {
              const isSelected = formData.items_json.find((i: any) => i.name === item.name);
              return (
                <button 
                  type="button" 
                  key={item.id} 
                  onClick={() => toggleItemInCombo(item.name)} 
                  className={`flex items-center justify-between px-3 py-2.5 rounded text-[9px] font-bold transition-all border ${isSelected ? 'bg-white border-brand-green text-brand-green' : 'bg-transparent border-transparent text-gray-400'}`}
                >
                  <span className="truncate">{item.name}</span>{isSelected && <Check size={12} />}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">Summary</label>
          <textarea 
            rows={2} 
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded outline-none text-[10px]" 
            value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} 
          />
        </div>
        <button 
          className="w-full py-4 bg-brand-green text-white font-bold rounded shadow-lg uppercase tracking-widest text-[10px]"
        >
          Save Combo
        </button>
      </form>
    </BitezyModal>
  );
};
