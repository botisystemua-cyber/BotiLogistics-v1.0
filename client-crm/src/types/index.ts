export type Screen = 'login' | 'home' | 'flights' | 'parcels' | 'orders' | 'chat' | 'tariffs' | 'profile' | 'booking' | 'parcel-ua-eu' | 'parcel-eu-ua';

export type Tab = 'home' | 'flights' | 'parcels' | 'orders' | 'chat';

export type OrderStatus = 'processing' | 'pending' | 'confirmed' | 'transit' | 'done' | 'cancelled';

export interface Flight {
  cal_id: string;
  city: string;
  from_city: string;
  to_city: string;
  date: string;
  direction: string;
  auto_name: string;
  max_seats: number;
  free_seats: number;
  occupied: number;
  status: string;
  free_list: string;
}

export interface ChatMessage {
  id: number;
  sender: 'manager' | 'user';
  text: string;
  time: string;
}
