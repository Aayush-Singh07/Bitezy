import { useState, useEffect } from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import { menuService, type MenuItem } from '../../services/menuService';
import { BitezyModal } from '../BitezyModal';
import { Plus } from 'lucide-react';

interface ItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  initialData: MenuItem | null;
  categories: string[];
  addCategory: (category: string) => void;
}

export const ItemModal = ({ isOpen, onClose, onSave, initialData, categories, addCategory }: ItemModalProps) => {
  const { restaurant } = useRestaurant();
  const [formData, setFormData] = useState<any>({ 
    name: '', price: '', gimmick_price: '', category: '', type: 'veg', description: '', image_url: '', is_available: true 
  });

  useEffect(() => {
    if (initialData)    setFormData(initialData);
    else 
      setFormData({ 
        name: '', 
        price: '', 
        gimmick_price: '', 
        category: categories[0] || '', 
        type: 'veg', 
        description: '', 
        image_url: '', 
        is_available: true,
        is_high_protein: false,
        highly_reordered: false
      });
  }, [initialData, categories]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurant?.id) return;
    await menuService.upsertItem({ 
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

  return (
    <BitezyModal isOpen={isOpen} onClose={onClose} title={initialData ? 'Edit Item' : 'Add Item'}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">Name</label>
            <input 
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand-green transition-all" 
              value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required 
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">Price (₹)</label>
            <input 
              type="number" 
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand-green transition-all" 
              value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} required 
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">Gimmick Price (₹)</label>
            <input 
              type="number" 
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand-green transition-all" 
              value={formData.gimmick_price || ''} onChange={e => setFormData({...formData, gimmick_price: e.target.value})} 
              placeholder="MRP / Original Price"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">Type</label>
            <select 
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded outline-none" 
              value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}
            >
              <option value="veg">Veg</option>
              <option value="nonveg">Non-Veg</option>
            </select>
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
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">Category</label>
            <div className="flex gap-2">
              <select 
                className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded outline-none" 
                value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}
              >
                {categories.map((c: string) => <option key={c} value={c}>{c}</option>)}
              </select>
              <button 
                type="button" 
                onClick={() => { const p = prompt('New Category Name:'); if(p) { addCategory(p); setFormData({...formData, category: p}); } }} 
                className="px-3 bg-gray-100 rounded text-gray-500"
              >
                <Plus size={16} />
              </button>
            </div>
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
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">Description</label>
          <textarea 
            rows={2} 
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded outline-none text-xs leading-relaxed" 
            value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} 
          />
        </div>
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">Image URL</label>
          <input 
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded outline-none text-[10px] font-mono" 
            value={formData.image_url} onChange={e => setFormData({...formData, image_url: e.target.value})} 
            placeholder="https://..." 
          />
        </div>
        <button 
          className="w-full py-4 bg-brand-green text-white font-bold rounded shadow-lg uppercase tracking-widest text-xs hover:bg-brand-hover transition-all"
        >
          {initialData ? 'Update Item' : 'Create Item'}
        </button>
      </form>
    </BitezyModal>
  );
};
