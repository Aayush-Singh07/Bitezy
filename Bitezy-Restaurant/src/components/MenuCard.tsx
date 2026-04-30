import { Edit2, Trash2, Layers } from 'lucide-react';

interface MenuCardProps {
  data: any;
  onEdit: () => void;
  onDelete: () => void;
}

export const MenuCard = ({ data, onEdit, onDelete }: MenuCardProps) => {
  return (
    <div className={`card overflow-hidden flex flex-col group transition-all ${!data.is_available ? 'opacity-50' : ''}`}>
      <div className="relative h-40 bg-gray-50 border-b border-gray-100">
        {data.image_url ? 
          <img src={data.image_url} alt={data.name} className="w-full h-full object-cover" /> : 
          <div className="w-full h-full flex items-center justify-center text-gray-200"><Layers size={32} /></div>
        }
        {!data.is_available && (
          <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
            <span className="bg-red-500 text-white px-3 py-1 rounded text-[9px] font-bold uppercase tracking-wider shadow-lg">Out of Stock</span>
          </div>
        )}
      </div>
      <div className="p-4 flex-1 flex flex-col">
        <div className="flex justify-between items-start mb-1">
           <h3 className="font-bold text-gray-900 text-sm line-clamp-1">{data.name}</h3>
           <div className="flex flex-col items-end">
             <span className="text-brand-green font-bold text-sm">₹{data.price}</span>
             {data.gimmick_price && (
               <span className="text-[10px] text-gray-400 line-through">₹{data.gimmick_price}</span>
             )}
           </div>
        </div>
        <p className="text-[10px] font-medium text-gray-400 line-clamp-2 mb-4 h-6 leading-relaxed">{data.description || 'No description provided.'}</p>
        
        <div className="mt-auto flex gap-2">
          <button onClick={onEdit} className="flex-1 bg-white hover:bg-gray-50 py-2.5 rounded border border-gray-200 text-[10px] font-bold text-gray-700 transition-all uppercase tracking-wider">
            <Edit2 size={12} className="inline mr-1" /> Edit
          </button>
          <button onClick={onDelete} className="px-3 py-2.5 rounded border border-red-100 text-red-400 hover:bg-red-50 transition-all">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
