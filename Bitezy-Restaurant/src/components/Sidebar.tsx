import { NavLink } from 'react-router-dom';
import { 
  ClipboardList, 
  History, 
  BarChart3, 
  UtensilsCrossed, 
  Settings, 
  Volume2,
  VolumeX,
  LogOut,
  X
} from 'lucide-react';
import { useRestaurant } from '../context/RestaurantContext';
import { useOrderAlerts } from '../context/OrderAlertContext';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
  const { logout, restaurant } = useRestaurant();
  const { placedOrders, isAudioEnabled, toggleAudio } = useOrderAlerts();

  const menuItems = [
    { name: 'Live Orders', path: '/live-orders', icon: <ClipboardList size={20} />, badge: placedOrders.length },
    { name: 'Order History', path: '/history', icon: <History size={20} /> },
    { name: 'Analytics', path: '/analytics', icon: <BarChart3 size={20} /> },
    { name: 'Manage Menu', path: '/manage-menu', icon: <UtensilsCrossed size={20} /> },
    { name: 'Settings', path: '/settings', icon: <Settings size={20} /> },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[45] md:hidden"
          onClick={onClose}
        />
      )}

      <div className={`
        sidebar w-64 h-screen fixed left-0 top-0 flex flex-col p-6 border-r border-white/5 z-50 transition-transform duration-300
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Mobile Close Button */}
        <button 
          onClick={onClose}
          className="md:hidden absolute top-4 right-4 text-white/50 hover:text-white"
        >
          <X size={20} />
        </button>

        {/* Logo Area */}
        <div className="flex items-center gap-3 mb-10 ml-1">
        <div className="w-9 h-9 bg-brand-green rounded-sm flex items-center justify-center overflow-hidden">
          <span className="text-white font-black text-lg uppercase tracking-tighter">
            {restaurant?.name?.[0] || 'B'}
          </span>
        </div>
        <h2 className="text-lg font-black text-white tracking-widest uppercase italic truncate max-w-[140px]">
          {restaurant?.name || 'Bitezy'}
        </h2>
      </div>

      {/* Primary Nav */}
      <nav className="flex-1 space-y-2">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={onClose}
            className={({ isActive }) => `
              flex items-center justify-between px-4 py-3 rounded-sm font-black transition-all uppercase tracking-[0.2em] text-[10px]
              ${isActive ? 'sidebar-active border-l-2 border-white' : 'text-white/40 hover:text-white hover:bg-white/5'}
            `}
          >
            <div className="flex items-center gap-3">
              {item.icon}
              <span>{item.name}</span>
            </div>
            {item.badge && item.badge > 0 && (
              <span className="bg-red-500 text-white w-4 h-4 rounded-none flex items-center justify-center text-[8px] font-black animate-pulse">
                {item.badge}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom Actions */}
      <div className="mt-auto space-y-4">
        {/* Sound Toggle */}
        <button 
          onClick={toggleAudio}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-sm transition-all font-black uppercase tracking-[0.2em] text-[10px] border ${isAudioEnabled ? 'bg-brand-green border-brand-green/20 text-white' : 'bg-transparent border-white/10 text-white/30 hover:text-white hover:border-white/20'}`}
        >
          {isAudioEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
          <span>Alerts: {isAudioEnabled ? 'On' : 'Off'}</span>
        </button>

        <button 
          onClick={logout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-sm text-white/20 hover:text-red-400 hover:bg-red-400/5 transition-all font-black uppercase tracking-[0.2em] text-[10px]"
        >
          <LogOut size={18} />
          <span>Logout</span>
        </button>
        
        <div className="pt-6 border-t border-white/5 opacity-20">
          <p className="text-[10px] uppercase tracking-[0.2em] font-bold">VER 1.0</p>
        </div>
      </div>
      </div>
    </>
  );
};
