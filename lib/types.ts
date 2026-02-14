export interface MenuItem {
  name: string;
  category: "coffee" | "tea" | "pastry";
  sizes?: { small: number; large: number };
  price?: number; // flat price for pastries
  temperatureOptions: ("hot" | "iced")[];
  description?: string;
}

export interface OrderItem {
  name: string;
  size?: "Small" | "Large";
  temperature?: "Hot" | "Iced";
  milk: string;
  iceLevel: string;
  sweetness: string;
  modifications: string[];
  basePrice: number;
  modificationsPrice: number;
  totalPrice: number;
  quantity: number;
}

export interface Order {
  id: string;
  order_number: number;
  customer_name: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: "pending" | "in_progress" | "completed";
  created_at: string;
  completed_at: string | null;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  orderData?: Order;
}

export interface ConversationState {
  messages: ChatMessage[];
  currentOrder: Partial<OrderItem>[];
  orderConfirmed: boolean;
}
