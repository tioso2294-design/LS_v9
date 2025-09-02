import { createClient } from '@supabase/supabase-js';

// Debug environment variables
console.log('🔍 Environment Check:', {
  url: import.meta.env.VITE_SUPABASE_URL ? 'Set' : 'Missing',
  key: import.meta.env.VITE_SUPABASE_ANON_KEY ? 'Set' : 'Missing',
  urlValue: import.meta.env.VITE_SUPABASE_URL?.substring(0, 30) + '...',
  keyValue: import.meta.env.VITE_SUPABASE_ANON_KEY?.substring(0, 20) + '...'
});

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables:', {
    VITE_SUPABASE_URL: supabaseUrl ? 'Present' : 'Missing',
    VITE_SUPABASE_ANON_KEY: supabaseAnonKey ? 'Present' : 'Missing'
  });
  throw new Error(`Missing Supabase environment variables. Please check your .env file.
    Required: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
    Current URL: ${supabaseUrl || 'undefined'}
    Current Key: ${supabaseAnonKey ? 'Set' : 'undefined'}`);
}

console.log('✅ Creating Supabase client with URL:', supabaseUrl);

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  global: {
    headers: {
      'X-Client-Info': 'voya-loyalty-app'
    }
  }
});
// Database types
export interface Database {
  public: {
    Tables: {
      restaurants: {
        Row: {
          id: string;
          name: string;
          owner_id: string;
          slug: string;
          settings: any;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          owner_id: string;
          slug: string;
          settings?: any;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          owner_id?: string;
          slug?: string;
          settings?: any;
          created_at?: string;
          updated_at?: string;
        };
      };
      customers: {
        Row: {
          id: string;
          restaurant_id: string;
          first_name: string;
          last_name: string;
          email: string;
          phone?: string;
          date_of_birth?: string;
          total_points: number;
          lifetime_points: number;
          current_tier: 'bronze' | 'silver' | 'gold';
          tier_progress: number;
          visit_count: number;
          total_spent: number;
          last_visit?: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          first_name: string;
          last_name: string;
          email: string;
          phone?: string;
          date_of_birth?: string;
          total_points?: number;
          lifetime_points?: number;
          current_tier?: 'bronze' | 'silver' | 'gold';
          tier_progress?: number;
          visit_count?: number;
          total_spent?: number;
          last_visit?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          restaurant_id?: string;
          first_name?: string;
          last_name?: string;
          email?: string;
          phone?: string;
          date_of_birth?: string;
          total_points?: number;
          lifetime_points?: number;
          current_tier?: 'bronze' | 'silver' | 'gold';
          tier_progress?: number;
          visit_count?: number;
          total_spent?: number;
          last_visit?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      rewards: {
        Row: {
          id: string;
          restaurant_id: string;
          name: string;
          description?: string;
          points_required: number;
          category: string;
          image_url?: string;
          min_tier: 'bronze' | 'silver' | 'gold';
          is_active: boolean;
          total_available?: number;
          total_redeemed: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          name: string;
          description?: string;
          points_required: number;
          category: string;
          image_url?: string;
          min_tier?: 'bronze' | 'silver' | 'gold' | 'platinum';
          is_active?: boolean;
          total_available?: number;
          total_redeemed?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          restaurant_id?: string;
          name?: string;
          description?: string;
          points_required?: number;
          category?: string;
          image_url?: string;
          min_tier?: 'bronze' | 'silver' | 'gold';
          is_active?: boolean;
          total_available?: number;
          total_redeemed?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      branches: {
        Row: {
          id: string;
          restaurant_id: string;
          name: string;
          location: string;
          staff_password: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          name: string;
          location: string;
          staff_password: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          restaurant_id?: string;
          name?: string;
          location?: string;
          staff_password?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      transactions: {
        Row: {
          id: string;
          restaurant_id: string;
          branch_id?: string;
          customer_id: string;
          type: 'purchase' | 'bonus' | 'referral' | 'signup' | 'redemption';
          points: number;
          amount_spent?: number;
          description?: string;
          reward_id?: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          branch_id?: string;
          customer_id: string;
          type: 'purchase' | 'bonus' | 'referral' | 'signup' | 'redemption';
          points: number;
          amount_spent?: number;
          description?: string;
          reward_id?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          restaurant_id?: string;
          branch_id?: string;
          customer_id?: string;
          type?: 'purchase' | 'bonus' | 'referral' | 'signup' | 'redemption';
          points?: number;
          amount_spent?: number;
          description?: string;
          reward_id?: string;
          created_at?: string;
        };
      };
      reward_redemptions: {
        Row: {
          id: string;
          restaurant_id: string;
          customer_id: string;
          reward_id: string;
          points_used: number;
          status: 'pending' | 'used' | 'expired';
          redeemed_at: string;
          used_at?: string;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          customer_id: string;
          reward_id: string;
          points_used: number;
          status?: 'pending' | 'used' | 'expired';
          redeemed_at?: string;
          used_at?: string;
        };
        Update: {
          id?: string;
          restaurant_id?: string;
          customer_id?: string;
          reward_id?: string;
          points_used?: number;
          status?: 'pending' | 'used' | 'expired';
          redeemed_at?: string;
          used_at?: string;
        };
      };
    };
  };
}