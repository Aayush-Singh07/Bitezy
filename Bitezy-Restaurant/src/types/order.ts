export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
}

export type OrderStatus = 'PLACED' | 'ACCEPTED' | 'PREPARING' | 'READY' | 'ON_THE_WAY' | 'ARRIVED' | 'DELIVERED' | 'CANCELLED';

export interface Order {
  id: string;
  user_id: string;
  restaurant_id: string;
  rider_id: string | null;
  address_id: string;
  total_item_amount: number;
  delivery_fee: number;
  total_amount: number;
  status: OrderStatus;
  created_at: string;
  accepted_at: string | null;
  prep_started_at: string | null;
  prep_completed_at: string | null;
  order_items: OrderItem[];
  user?: {
    name: string;
    phone: string;
  };
}
