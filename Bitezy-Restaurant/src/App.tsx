import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { RestaurantProvider, useRestaurant } from './context/RestaurantContext';
import { Login } from './components/Login';
import { Sidebar } from './components/Sidebar';
import { LiveOrders } from './pages/LiveOrders';
import { OrderHistory } from './pages/OrderHistory';
import { Analytics } from './pages/Analytics';
import { ManageMenu } from './pages/ManageMenu';
import { Settings } from './pages/Settings';

import { OrderAlertProvider, useOrderAlerts } from './context/OrderAlertContext';

import { useState } from 'react';
import { Menu } from 'lucide-react';

const InteractionWrapper = ({ children }: { children: React.ReactNode }) => {
  const { markAsInteracted } = useOrderAlerts();
  
  useEffect(() => {
    const handleInteraction = () => {
      markAsInteracted();
      window.removeEventListener('mousedown', handleInteraction);
    };
    window.addEventListener('mousedown', handleInteraction);
    return () => window.removeEventListener('mousedown', handleInteraction);
  }, [markAsInteracted]);

  return <>{children}</>;
};

const MobileHeader = ({ onOpen }: { onOpen: () => void }) => {
  const { restaurant } = useRestaurant();
  return (
    <div className="md:hidden sticky top-0 z-40 bg-sidebar-bg text-white px-6 py-4 flex items-center justify-between shadow-lg">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-brand-green rounded-full flex items-center justify-center">
            <span className="text-white font-black text-sm">{restaurant?.name?.[0] || 'B'}</span>
        </div>
        <span className="font-black italic uppercase text-xs tracking-widest">{restaurant?.name || 'Bitezy RMS'}</span>
      </div>
      <button onClick={onOpen} className="p-2 -mr-2 text-white/70 hover:text-white">
        <Menu size={24} />
      </button>
    </div>
  );
};

const AuthenticatedLayout = ({ children }: { children: React.ReactNode }) => {
  const { restaurant } = useRestaurant();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <OrderAlertProvider restaurantId={restaurant?.id}>
      <InteractionWrapper>
        <div className="flex bg-[#f9fafb] h-screen overflow-hidden relative">
          <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
          <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden md:ml-64">
             <MobileHeader onOpen={() => setIsSidebarOpen(true)} />
             <main className="flex-1 overflow-hidden flex flex-col">
               {children}
             </main>
          </div>
        </div>
      </InteractionWrapper>
    </OrderAlertProvider>
  );
};

const AppRoutes = () => {
  const { restaurant, isLoading } = useRestaurant();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#e5e7eb] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#5d7560] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!restaurant) {
    return <Login />;
  }

  return (
    <AuthenticatedLayout>
      <Routes>
        <Route path="/live-orders" element={<LiveOrders />} />
        <Route path="/history" element={<OrderHistory />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/manage-menu" element={<ManageMenu />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/" element={<Navigate to="/live-orders" replace />} />
      </Routes>
    </AuthenticatedLayout>
  );
};

function App() {
  return (
    <RestaurantProvider>
      <Router>
        <AppRoutes />
      </Router>
    </RestaurantProvider>
  );
}

export default App;
