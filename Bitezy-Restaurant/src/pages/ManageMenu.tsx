import { useState, useEffect } from 'react';
import { useRestaurant } from '../context/RestaurantContext';
import { menuService, type MenuItem, type Combo } from '../services/menuService';
import { MenuCard } from '../components/MenuCard';
import { ItemModal } from '../components/menu/ItemModal';
import { ComboModal } from '../components/menu/ComboModal';
import { Plus, Package } from 'lucide-react';

export const ManageMenu = () => {
  const { restaurant } = useRestaurant();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [combos, setCombos] = useState<Combo[]>([]);
  const [activeTab, setActiveTab] = useState<'items' | 'combos'>('items');
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [isComboModalOpen, setIsComboModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [editingCombo, setEditingCombo] = useState<Combo | null>(null);
  const [categories, setCategories] = useState<string[]>(['Savory', 'Sweet', 'Bakery', 'Drinks']);

  useEffect(() => { if (restaurant?.id) loadData(); }, [restaurant?.id]);

  const loadData = async () => {
    if (!restaurant?.id) return;
    const [fetchedItems, fetchedCombos] = await Promise.all([
      menuService.fetchItems(restaurant.id), 
      menuService.fetchCombos(restaurant.id)
    ]);
    setItems(fetchedItems);
    setCombos(fetchedCombos);
    const uniqueCats = Array.from(new Set([...categories, ...fetchedItems.map(i => i.category || 'Other')]));
    setCategories(uniqueCats.filter(Boolean));
  };

  const handleDelete = async (type: 'items' | 'combos', id: string) => {
    if (confirm(`Are you sure you want to delete this ${type === 'items' ? 'item' : 'combo'}?`)) {
      if (type === 'items') await menuService.deleteItem(id);
      else await menuService.deleteCombo(id);
      loadData();
    }
  };

  const groupedItems = items.reduce((acc, item) => {
    const cat = item.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {} as Record<string, MenuItem[]>);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#f9fafb]">
      {/* Scrollable Container */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 pb-12 no-scrollbar">
        {/* Sticky Header */}
        <div className="sticky top-0 z-10 bg-[#f9fafb] pb-2 pt-4 md:pt-4 -mx-4 md:-mx-8 px-4 md:px-8 mb-4 border-b border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h1 className="text-xl md:text-2xl font-bold uppercase text-gray-900 tracking-tight italic">Manage Menu</h1>
          <div className="flex gap-2">
            <button onClick={() => { setEditingItem(null); setIsItemModalOpen(true); }} className="flex-1 md:flex-none bg-brand-green text-white px-4 py-2.5 rounded-md font-bold flex items-center justify-center gap-2 hover:bg-brand-hover transition-all uppercase text-[9px] tracking-wider">
              <Plus size={14} /> Add Item
            </button>
            <button onClick={() => { setEditingCombo(null); setIsComboModalOpen(true); }} className="flex-1 md:flex-none bg-white text-gray-800 border border-gray-200 px-4 py-2.5 rounded-md font-bold flex items-center justify-center gap-2 hover:bg-gray-50 transition-all uppercase text-[9px] tracking-wider">
              <Package size={14} /> Add Combo
            </button>
          </div>
        </div>

        {/* Tabs - Segmented Control Pill */}
        <div className="mb-4">
          <div className="inline-flex bg-gray-100 p-1 rounded-md gap-1">
            <button 
              onClick={() => setActiveTab('items')} 
              className={`px-4 py-2 rounded-sm font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === 'items' ? 'bg-white text-brand-green shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
            >
              Items ({items.length})
            </button>
            <button 
              onClick={() => setActiveTab('combos')} 
              className={`px-4 py-2 rounded-sm font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === 'combos' ? 'bg-white text-brand-green shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
            >
              Combos ({combos.length})
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {activeTab === 'items' ? (
            Object.entries(groupedItems).sort().map(([category, catItems]) => (
              <div key={category} className="space-y-2">
                <div className="flex items-center gap-4">
                  <h2 className="text-lg font-extrabold uppercase tracking-tight text-gray-900">{category}</h2>
                  <div className="h-px flex-1 bg-gray-100"></div>
                </div>
                {/* Horizontal Scroll Row */}
                <div className="flex gap-6 overflow-x-auto pb-4 -mx-2 px-2 snap-x scroll-smooth no-scrollbar">
                  {catItems.map(item => (
                    <div key={item.id} className="min-w-[300px] max-w-[300px] snap-start">
                      <MenuCard data={item} onEdit={() => { setEditingItem(item); setIsItemModalOpen(true); }} onDelete={() => handleDelete('items', item.id!)} />
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {combos.map(combo => (
                <MenuCard key={combo.id} data={combo} onEdit={() => { setEditingCombo(combo); setIsComboModalOpen(true); }} onDelete={() => handleDelete('combos', combo.id!)} />
              ))}
            </div>
          )}
        </div>
      </div>

      <ItemModal 
        isOpen={isItemModalOpen} 
        onClose={() => setIsItemModalOpen(false)} 
        onSave={loadData} 
        initialData={editingItem} 
        categories={categories} 
        addCategory={(cat: string) => setCategories([...categories, cat])} 
      />
      <ComboModal 
        isOpen={isComboModalOpen} 
        onClose={() => setIsComboModalOpen(false)} 
        onSave={loadData} 
        initialData={editingCombo} 
        availableItems={items} 
      />
    </div>
  );
};
