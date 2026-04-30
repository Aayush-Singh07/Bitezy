import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useAddress } from './AddressContext';

type CartItem = {
  id: string;
  cart_id: string;
  item_id: string | null;
  combo_id: string | null;
  quantity: number;
  price: number;
  name: string;
  image_url: string | null;
  is_veg: boolean;
};

type CartContextType = {
  cartId: string | null;
  restaurantId: string | null; // Added to track current cart's restaurant
  items: CartItem[];
  addToCart: (item: any, quantity?: number) => Promise<void>;
  updateQuantity: (cartItemId: string, qty: number) => Promise<void>;
  clearCart: () => Promise<void>;
  cartTotal: number;
  deliveryFee: number;
  totalWithDelivery: number;
  nextTierAmount: number; 
  reorderItems: (items: any[], restaurantId: string) => Promise<void>;
};

const CartContext = createContext<CartContextType | null>(null);

export const CartProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const { selectedAddress } = useAddress();
  const [cartId, setCartId] = useState<string | null>(null);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [items, setItems] = useState<CartItem[]>([]);
  const lastAddrIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (user) {
      loadCart();
    } else {
      setCartId(null);
      setRestaurantId(null);
      setItems([]);
    }
  }, [user]);

  // Clear cart if address changes
  useEffect(() => {
    const handleAddressChange = async () => {
      if (selectedAddress && lastAddrIdRef.current && lastAddrIdRef.current !== selectedAddress.id) {
        if (items.length > 0) {
          console.log('Cart: Address changed, clearing cart to preserve hyperlocal zone integrity.');
          await clearCart();
        }
      }
      if (selectedAddress) {
        lastAddrIdRef.current = selectedAddress.id || null;
      }
    };
    handleAddressChange();
  }, [selectedAddress]);

  const loadCart = async () => {
    if (!user) return;
    try {
      const { data: cartData, error: cartError } = await supabase
        .from('carts')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (cartError) {
        console.error('Error fetching cart:', cartError);
        return;
      }
        
      if (cartData) {
        setCartId(cartData.id);
        setRestaurantId(cartData.restaurant_id);
        const { data: cartItems, error: itemsError } = await supabase
          .from('cart_items')
          .select('*, items(name, image_url, type), combos(name, image_url)')
          .eq('cart_id', cartData.id);
          
        if (itemsError) {
          console.error('Error fetching cart items:', itemsError);
          return;
        }

        if (cartItems) {
          setItems(cartItems.map((ci: any) => ({
            ...ci,
            price: Number(ci.price || 0),
            quantity: Number(ci.quantity || 1),
            name: ci.items?.name || ci.combos?.name || 'Item',
            image_url: ci.items?.image_url || ci.combos?.image_url || null,
            is_veg: ci.items?.type === 'veg' || ci.combos !== null // Default to veg for combos
          })));
        }
      }
    } catch (e) {
      console.error('Error in loadCart:', e);
    }
  };

  const addToCart = async (item: any, quantity: number = 1) => {
    if (!user) {
      console.log('Cart Error: No user logged in');
      return;
    }

    try {
      let activeCartId = cartId;

      // Ensure we are adding to a cart from the correct restaurant
      if (!activeCartId || restaurantId !== item.restaurant_id) {
        console.log('Cart Transition: Clearning old cart for user', user.id);
        
        // 1. Delete ANY existing carts for this user (enforces one restaurant per user)
        const { error: deleteError } = await supabase.from('carts').delete().eq('user_id', user.id);
        if (deleteError) {
          console.error('Faild to clear previous carts:', deleteError);
          // Proceed anyway if it's just a 404/not found, but if it's a real error, we might still hit the conflict
        }

        // 2. Create the new cart record
        const { data: newCart, error: cartError } = await supabase
          .from('carts')
          .insert({ user_id: user.id, restaurant_id: item.restaurant_id, total_amount: 0 })
          .select().single();
          
        if (cartError || !newCart) {
          console.error('Cart Error: Failed to create fresh cart.', cartError);
          return;
        }
        
        activeCartId = newCart.id;
        setCartId(newCart.id);
        setRestaurantId(newCart.restaurant_id);
        setItems([]); // Local sync
      }

      // Check if already in cart
      const existingItem = items.find(i => 
        (item.type === 'combo' && i.combo_id === item.id) || 
        (item.type !== 'combo' && i.item_id === item.id)
      );
      
      if (existingItem) {
        console.log('Cart: Item exists, updating quantity to', existingItem.quantity + quantity);
        await updateQuantity(existingItem.id, existingItem.quantity + quantity);
      } else {
        console.log('Cart: Inserting new item:', item.name || item.title);
        const { data: newItem, error: insertError } = await supabase
          .from('cart_items')
          .insert({
            cart_id: activeCartId,
            item_id: item.type === 'combo' ? null : item.id,
            combo_id: item.type === 'combo' ? item.id : null,
            quantity: Number(quantity),
            price: Number(item.price)
          })
          .select('*, items(name, image_url, type), combos(name, image_url)')
          .single();
          
        if (insertError) {
          console.error('Cart Error: Insert with select failed!', insertError);
          // Fallback: Just insert and update state manually
          console.log('Cart: Trying fallback insert...');
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('cart_items')
            .insert({
              cart_id: activeCartId,
              item_id: item.type === 'combo' ? null : item.id,
              combo_id: item.type === 'combo' ? item.id : null,
              quantity: Number(quantity),
              price: Number(item.price)
            })
            .select()
            .single();

          if (fallbackError) {
            console.error('Cart Error: Fallback failed too!', fallbackError);
            return;
          }

          if (fallbackData) {
            console.log('Cart: Fallback successful!');
            setItems([...items, { 
              ...fallbackData, 
              name: item.name || item.title,
              image_url: item.image || item.image_url || null,
              is_veg: item.type === 'veg' || item.type === 'combo'
            }]);
          }
          return;
        }

        if (newItem) {
          console.log('Cart: Item added successfully!');
          setItems([...items, { 
            ...newItem, 
            name: item.name || item.title,
            image_url: item.image || item.image_url || null,
            is_veg: item.type === 'veg' || item.type === 'combo'
          }]);
        }
      }
    } catch (e) {
      console.error('Error in addToCart:', e);
    }
  };

  const updateQuantity = async (cartItemId: string, qty: number) => {
    if (!cartId || !user) return;
    
    try {
      if (qty <= 0) {
        const { error } = await supabase.from('cart_items').delete().eq('id', cartItemId);
        if (error) console.error('Error deleting item:', error);
        else setItems(items.filter(i => i.id !== cartItemId));
      } else {
        const { error } = await supabase.from('cart_items').update({ quantity: qty }).eq('id', cartItemId);
        if (error) console.error('Error updating quantity:', error);
        else setItems(items.map(i => i.id === cartItemId ? { ...i, quantity: qty } : i));
      }
    } catch (e) {
      console.error('Error in updateQuantity:', e);
    }
  };

  const clearCart = async () => {
    if (!cartId || !user) return;
    try {
      const { error } = await supabase.from('cart_items').delete().eq('cart_id', cartId);
      if (error) console.error('Error clearing cart:', error);
      else {
        setItems([]);
        setCartId(null);
        setRestaurantId(null);
      }
    } catch (e) {
      console.error('Error in clearCart:', e);
    }
  };

  const cartTotal = items.reduce((sum, i) => {
    const p = Number(i.price) || 0;
    const q = Number(i.quantity) || 1;
    return sum + (p * q);
  }, 0);

  // Dynamic Delivery Logic:
  // < 49: 25
  // 49-89: 15
  // 89+: Free
  const deliveryFee = cartTotal <= 0 ? 0 : 
                     cartTotal < 49 ? 25 : 
                     cartTotal < 89 ? 15 : 0;

  const totalWithDelivery = Number(cartTotal) + Number(deliveryFee);

  const nextTierAmount = cartTotal <= 0 ? 89 :
                        cartTotal < 89 ? 89 - cartTotal : 0;

  const reorderItems = async (itemsList: any[], resId: string) => {
    if (!user) return;
    try {
      // 1. Clear old cart
      await supabase.from('carts').delete().eq('user_id', user.id);
      
      // 2. Create new cart
      const { data: newCart, error: cartError } = await supabase
        .from('carts')
        .insert({ user_id: user.id, restaurant_id: resId, total_amount: 0 })
        .select().single();
      
      if (cartError || !newCart) throw new Error("Failed to create reorder cart");

      // 3. Batch insert items
      const insertData = itemsList.map(item => ({
        cart_id: newCart.id,
        item_id: item.item_id,
        combo_id: item.combo_id,
        quantity: item.quantity,
        price: item.price
      }));

      const { error: itemsError } = await supabase.from('cart_items').insert(insertData);
      if (itemsError) throw itemsError;

      // 4. Update local state
      setCartId(newCart.id);
      setRestaurantId(newCart.restaurant_id);
      await loadCart();
    } catch (e) {
      console.error('Error in reorderItems:', e);
    }
  };

  return (
    <CartContext.Provider value={{ 
      cartId, restaurantId, items, addToCart, updateQuantity, clearCart, 
      cartTotal, deliveryFee, totalWithDelivery, nextTierAmount, reorderItems
    }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider");
  return context;
};
