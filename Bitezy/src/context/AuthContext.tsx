import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type BitezyUser = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  last_active: string | null;
  avatar_url?: string | null;
  password?: string | null;
};

type AuthContextType = {
  user: BitezyUser | null;
  isLoading: boolean;
  signIn: (user: BitezyUser) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  signIn: async () => {},
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<BitezyUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSession();
  }, []);

  const loadSession = async () => {
    try {
      const savedUser = await AsyncStorage.getItem('@bitezy_user');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        setUser(parsed);
        // Async update last active
        supabase.from('users').update({ last_active: new Date().toISOString() }).eq('id', parsed.id).then();
      }
    } catch (e) {
      console.error('Failed to load session:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async (userData: BitezyUser) => {
    setUser(userData);
    await AsyncStorage.setItem('@bitezy_user', JSON.stringify(userData));
    await supabase.from('users').update({ last_active: new Date().toISOString() }).eq('id', userData.id);
  };

  const signOut = async () => {
    setUser(null);
    await AsyncStorage.removeItem('@bitezy_user');
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
