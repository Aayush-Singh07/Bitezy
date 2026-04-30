import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

export type Address = {
  id?: string;
  label: string;
  address_line: string;
  lat: number;
  long: number;
  is_default?: boolean;
};

type AddressContextType = {
  selectedAddress: Address | null;
  setSelectedAddress: (addr: Address) => void;
  addresses: Address[];           // full list for picker
  hasAddresses: boolean | null;   // null = still checking
  saveAddress: (addr: Address) => Promise<void>;
  updateAddress: (id: string, addr: Partial<Address>) => Promise<void>;
  deleteAddress: (id: string) => Promise<void>;
  refreshAddresses: () => Promise<void>;
  selectAddress: (addr: Address) => Promise<void>;
};

const AddressContext = createContext<AddressContextType>({
  selectedAddress: null,
  setSelectedAddress: () => {},
  addresses: [],
  hasAddresses: null,
  saveAddress: async () => {},
  updateAddress: async () => {},
  deleteAddress: async () => {},
  refreshAddresses: async () => {},
  selectAddress: async () => {},
});

export const AddressProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [hasAddresses, setHasAddresses] = useState<boolean | null>(null);

  const refreshAddresses = async () => {
    if (!user) {
      setHasAddresses(false);
      setAddresses([]);
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        // Deduplicate by id just in case of any race condition
        const seen = new Set<string>();
        const mapped: Address[] = data
          .filter(a => {
            if (seen.has(a.id)) return false;
            seen.add(a.id);
            return true;
          })
          .map(a => ({
            id: a.id,
            label: a.label,
            address_line: a.address_line,
            lat: Number(a.lat),
            long: Number(a.long),
            is_default: a.is_default,
          }));
        setAddresses(mapped);
        setHasAddresses(true);
        // Auto-select default or most recent
        const defaultAddr = mapped.find(a => a.is_default) || mapped[0];
        setSelectedAddress(defaultAddr);
      } else {
        setAddresses([]);
        setHasAddresses(false);
      }
    } catch (err) {
      console.warn('AddressContext: Failed to refresh addresses, falling back to empty list.', err);
      setAddresses([]);
      setHasAddresses(false); // Crucial: allow SplashScreen to proceed
    }
  };

  const saveAddress = async (addr: Address) => {
    if (!user) return;
    // Clear previous defaults
    await supabase.from('addresses').update({ is_default: false }).eq('user_id', user.id);

    const { data, error } = await supabase
      .from('addresses')
      .insert({
        user_id: user.id,
        label: addr.label,
        address_line: addr.address_line,
        lat: addr.lat,
        long: addr.long,
        is_default: true,
      })
      .select()
      .single();

    if (error) throw error;

    // refreshAddresses fetches the full list from DB and sets selectedAddress —
    // no need to setSelectedAddress here, which would cause a duplicate render.
    if (data) {
      await refreshAddresses();
    }
  };

  const updateAddress = async (id: string, addr: Partial<Address>) => {
    if (!user) return;
    
    // If setting as default, clear others first
    if (addr.is_default) {
      await supabase.from('addresses').update({ is_default: false }).eq('user_id', user.id);
    }
    
    await supabase.from('addresses').update(addr).eq('id', id).eq('user_id', user.id);
    await refreshAddresses();
  };

  const deleteAddress = async (id: string) => {
    if (!user) return;
    await supabase.from('addresses').delete().eq('id', id).eq('user_id', user.id);
    await refreshAddresses();
  };

  const selectAddress = async (addr: Address) => {
    if (!user || !addr.id) return;
    try {
      // 1. Update local state immediately for snappy UI
      setSelectedAddress(addr);

      // 2. Synchronize to DB: Clear other defaults
      await supabase.from('addresses').update({ is_default: false }).eq('user_id', user.id);

      // 3. Set this one as default
      await supabase.from('addresses').update({ is_default: true }).eq('id', addr.id).eq('user_id', user.id);
      
      // 4. Refresh list to ensure badges sync
      await refreshAddresses();
    } catch (err) {
      console.error('Failed to sync address default:', err);
    }
  };

  useEffect(() => {
    if (user) {
      refreshAddresses();
    } else {
      setHasAddresses(null);
      setSelectedAddress(null);
      setAddresses([]);
    }
  }, [user]);

  return (
    <AddressContext.Provider
      value={{
        selectedAddress,
        setSelectedAddress,
        addresses,
        hasAddresses,
        saveAddress,
        updateAddress,
        deleteAddress,
        refreshAddresses,
        selectAddress,
      }}
    >
      {children}
    </AddressContext.Provider>
  );
};

export const useAddress = () => useContext(AddressContext);