export interface User {
  id: string;
  name: string;
  phone: string;
  password: string;
  photo_url?: string;
  balance: number;
  total_earnings: number;
  blue_tick: boolean;
  badge_type?: string;
  is_blocked: boolean;
  vip_member: boolean;
  account_id?: string;
  created_at: string;
}

export interface Investment {
  id: string;
  user_id: string;
  amount: number;
  start_time: string;
  end_time: string;
  daily_rate: number;
  total_earned: number;
  is_active: boolean;
  is_claimed: boolean;
  created_at: string;
}

export interface DepositRequest {
  id: string;
  user_id: string;
  user_name: string;
  amount: number;
  screenshot?: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export interface WithdrawRequest {
  id: string;
  user_id: string;
  user_name: string;
  phone: string;
  recipient_name: string;
  network: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export interface VipRequest {
  id: string;
  user_id: string;
  user_name: string;
  phone: string;
  amount: number;
  plan_id?: string;
  plan_label?: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export interface Transfer {
  id: string;
  sender_id: string;
  sender_name: string;
  receiver_id: string;
  receiver_name: string;
  receiver_phone: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export interface VipPlan {
  id: string;
  label: string;
  price: number;
  months: number;
}

export interface AppSettings {
  payment_phone: string;
  payment_network: string;
  payment_name: string;
  whatsapp_number: string;
  apk_url?: string;
  vip_price?: number;
  vip_benefits?: string;
  vip_plans?: VipPlan[];
  referral_max?: number;
  referral_bonus?: number;
  apk_updated_at?: string;
  primary_color?: string;
  accent_color?: string;
  font_size?: string;
  font_family?: string;
  admin_name?: string;
  admin_photo?: string;
  notification_sound?: string;
  investment_days?: number;
}

export interface AppNotification {
  id: string;
  user_id: string | null;
  title: string;
  message: string;
  type: string;
  created_at: string;
}
