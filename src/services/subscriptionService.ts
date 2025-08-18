import { supabase } from '../lib/supabase';

export interface Subscription {
  id: string;
  user_id: string;
  plan_type: 'trial' | 'monthly' | 'semiannual' | 'annual';
  status: 'active' | 'expired' | 'cancelled' | 'past_due';
  stripe_subscription_id?: string;
  stripe_customer_id?: string;
  current_period_start: string;
  current_period_end: string;
  billing_period_text?: string;
  billing_period_accurate?: boolean;
  created_at: string;
  updated_at: string;
}

export interface PlanFeatures {
  maxCustomers: number;
  maxBranches: number;
  advancedAnalytics: boolean;
  prioritySupport: boolean;
  customBranding: boolean;
  apiAccess: boolean;
}

export class SubscriptionService {
  static async createSubscription(
    userId: string,
    planType: 'trial' | 'monthly' | 'semiannual' | 'annual',
    stripeSubscriptionId?: string,
    stripeCustomerId?: string
  ): Promise<Subscription> {
    try {
      // Calculate proper period dates
      const now = new Date();
      const periodStart = now.toISOString();
      let periodEnd: Date;

      switch (planType) {
        case 'trial':
          periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
          break;
        case 'monthly':
          periodEnd = new Date(now);
          periodEnd.setMonth(periodEnd.getMonth() + 1); // Exact 1 month
          break;
        case 'semiannual':
          periodEnd = new Date(now);
          periodEnd.setMonth(periodEnd.getMonth() + 6); // Exact 6 months
          break;
        case 'annual':
          periodEnd = new Date(now);
          periodEnd.setFullYear(periodEnd.getFullYear() + 1); // Exact 1 year
          break;
        default:
          periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      }

      // Use the database function for consistent handling
      const { error } = await supabase.rpc('handle_subscription_webhook', {
        p_user_id: userId,
        p_plan_type: planType,
        p_status: 'active',
        p_stripe_subscription_id: stripeSubscriptionId || null,
        p_stripe_customer_id: stripeCustomerId || null,
        p_period_start: periodStart,
        p_period_end: periodEnd.toISOString()
      });

      if (error) {
        throw new Error(`Failed to create subscription: ${error.message}`);
      }

      // Fetch the created subscription
      const subscription = await this.getUserSubscription(userId);
      if (!subscription) {
        throw new Error('Failed to retrieve created subscription');
      }

      return subscription;
    } catch (error: any) {
      console.error('Error creating subscription:', error);
      throw error;
    }
  }

  static async getUserSubscription(userId: string): Promise<Subscription | null> {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching subscription:', error);
        return null;
      }
      
      return data;
    } catch (error: any) {
      console.error('Error fetching user subscription:', error);
      return null;
    }
  }

  static async checkSubscriptionAccess(userId: string): Promise<{
    hasAccess: boolean;
    subscription: Subscription | null;
    features: PlanFeatures;
    daysRemaining?: number;
  }> {
    try {
      const subscription = await this.getUserSubscription(userId);
      
      if (!subscription) {
        // New user - give trial access
        return {
          hasAccess: true,
          subscription: null,
          features: this.getTrialFeatures(),
          daysRemaining: 30
        };
      }

      const now = new Date();
      const endDate = new Date(subscription.current_period_end);
      
      // Calculate access based on subscription status and period
      let hasAccess = false;
      
      if (subscription.status === 'active') {
        hasAccess = endDate > now;
      } else if (subscription.status === 'cancelled') {
        // Cancelled subscriptions keep access until period end
        hasAccess = endDate > now;
      } else if (subscription.status === 'past_due') {
        // Grace period for past due
        hasAccess = endDate > now;
      }

      const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

      return {
        hasAccess,
        subscription,
        features: this.getPlanFeatures(subscription.plan_type),
        daysRemaining
      };
    } catch (error: any) {
      console.error('Error checking subscription access:', error);
      // Fallback to allow access during errors
      return {
        hasAccess: true,
        subscription: null,
        features: this.getTrialFeatures(),
        daysRemaining: 30
      };
    }
  }

  static async updateSubscriptionFromWebhook(
    userId: string,
    planType: 'trial' | 'monthly' | 'semiannual' | 'annual',
    status: 'active' | 'expired' | 'cancelled' | 'past_due',
    stripeSubscriptionId?: string,
    stripeCustomerId?: string,
    periodStart?: string,
    periodEnd?: string
  ): Promise<void> {
    try {
      const { error } = await supabase.rpc('handle_subscription_webhook', {
        p_user_id: userId,
        p_plan_type: planType,
        p_status: status,
        p_stripe_subscription_id: stripeSubscriptionId || null,
        p_stripe_customer_id: stripeCustomerId || null,
        p_period_start: periodStart || null,
        p_period_end: periodEnd || null
      });

      if (error) {
        throw new Error(error.message);
      }
    } catch (error: any) {
      console.error('Error updating subscription from webhook:', error);
      throw error;
    }
  }

  static async cancelSubscription(userId: string): Promise<void> {
    try {
      const { error } = await supabase.rpc('cancel_subscription_gracefully', {
        p_user_id: userId
      });

      if (error) {
        throw new Error(error.message);
      }
    } catch (error: any) {
      console.error('Error cancelling subscription:', error);
      throw error;
    }
  }

  static async reactivateSubscription(userId: string): Promise<void> {
    try {
      const { error } = await supabase.rpc('reactivate_subscription', {
        p_user_id: userId
      });

      if (error) {
        throw new Error(error.message);
      }
    } catch (error: any) {
      console.error('Error reactivating subscription:', error);
      throw error;
    }
  }

  static getPlanFeatures(planType: 'trial' | 'monthly' | 'semiannual' | 'annual'): PlanFeatures {
    switch (planType) {
      case 'trial':
        return this.getTrialFeatures();
      case 'monthly':
        return {
          maxCustomers: -1,
          maxBranches: -1,
          advancedAnalytics: true,
          prioritySupport: true,
          customBranding: false,
          apiAccess: false
        };
      case 'semiannual':
        return {
          maxCustomers: -1,
          maxBranches: -1,
          advancedAnalytics: true,
          prioritySupport: true,
          customBranding: true,
          apiAccess: true
        };
      case 'annual':
        return {
          maxCustomers: -1,
          maxBranches: -1,
          advancedAnalytics: true,
          prioritySupport: true,
          customBranding: true,
          apiAccess: true
        };
      default:
        return this.getTrialFeatures();
    }
  }

  private static getTrialFeatures(): PlanFeatures {
    return {
      maxCustomers: 100,
      maxBranches: 1,
      advancedAnalytics: false,
      prioritySupport: false,
      customBranding: false,
      apiAccess: false
    };
  }

  static async getSubscriptionStats(): Promise<{
    total: number;
    active: number;
    trial: number;
    paid: number;
    revenue: number;
    churnRate: number;
  }> {
    try {
      // Get all subscriptions
      const { data: subscriptions, error } = await supabase
        .from('subscriptions')
        .select('plan_type, status, created_at');

      if (error) {
        console.error('Error fetching subscription stats:', error);
        return { total: 0, active: 0, trial: 0, paid: 0, revenue: 0, churnRate: 0 };
      }

      const total = subscriptions?.length || 0;
      const active = subscriptions?.filter(s => s.status === 'active').length || 0;
      const trial = subscriptions?.filter(s => s.plan_type === 'trial').length || 0;
      const paid = subscriptions?.filter(s => s.plan_type !== 'trial' && s.status === 'active').length || 0;
      const cancelled = subscriptions?.filter(s => s.status === 'cancelled').length || 0;
      
      // Calculate total revenue generated
      let totalRevenue = 0;
      subscriptions?.forEach(sub => {
        if (sub.plan_type !== 'trial' && (sub.status === 'active' || sub.status === 'expired' || sub.status === 'cancelled')) {
          switch (sub.plan_type) {
            case 'monthly':
              totalRevenue += 2.99;
              break;
            case 'semiannual':
              totalRevenue += 9.99;
              break;
            case 'annual':
              totalRevenue += 19.99;
              break;
          }
        }
      });
      
      const churnRate = total > 0 ? (cancelled / total) * 100 : 0;

      return { total, active, trial, paid, revenue: totalRevenue, churnRate };
    } catch (error: any) {
      console.error('Error fetching subscription stats:', error);
      return { total: 0, active: 0, trial: 0, paid: 0, revenue: 0, churnRate: 0 };
    }
  }

  static async getAllSubscriptions(): Promise<(Subscription & { 
    user_email?: string;
    restaurant_name?: string;
  })[]> {
    try {
      // Get subscriptions with user emails from auth.users
      const { data: subscriptions, error } = await supabase
        .from('subscriptions')
        .select(`
          *,
          users!inner(email)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching subscriptions with users:', error);
        // Fallback to basic subscriptions
        const { data: basicSubs, error: basicError } = await supabase
          .from('subscriptions')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);

        if (basicError) throw basicError;

        // Get restaurant names separately
        const subsWithRestaurants = await Promise.all(
          (basicSubs || []).map(async (sub) => {
            const { data: restaurant } = await supabase
              .from('restaurants')
              .select('name')
              .eq('owner_id', sub.user_id)
              .single();

            return {
              ...sub,
              user_email: 'Unknown',
              restaurant_name: restaurant?.name || 'Unknown Restaurant'
            };
          })
        );

        return subsWithRestaurants;
      }

      // Get restaurant names for each subscription
      const subsWithRestaurants = await Promise.all(
        (subscriptions || []).map(async (sub: any) => {
          const { data: restaurant } = await supabase
            .from('restaurants')
            .select('name')
            .eq('owner_id', sub.user_id)
            .single();

          return {
            ...sub,
            user_email: sub.users?.email || 'Unknown',
            restaurant_name: restaurant?.name || 'Unknown Restaurant'
          };
        })
      );

      return subsWithRestaurants;
    } catch (error: any) {
      console.error('Error fetching all subscriptions:', error);
      return [];
    }
  }

  static async getSystemWideStats(): Promise<{
    totalRevenue: number;
    totalCustomers: number;
    totalRestaurants: number;
    totalTransactions: number;
    monthlyGrowth: number;
  }> {
    try {
      // Get counts from each table
      const [restaurantCount, customerCount, transactionCount] = await Promise.all([
        supabase.from('restaurants').select('*', { count: 'exact', head: true }),
        supabase.from('customers').select('*', { count: 'exact', head: true }),
        supabase.from('transactions').select('*', { count: 'exact', head: true })
      ]);

      // Get total revenue from subscription function
      const { data: revenue, error: revenueError } = await supabase.rpc('get_total_subscription_revenue');
      
      if (revenueError) {
        console.error('Error getting total revenue:', revenueError);
      }

      // Calculate monthly growth
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      
      const { data: newRestaurants } = await supabase
        .from('restaurants')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', lastMonth.toISOString());

      const monthlyGrowth = (restaurantCount.count || 0) > 0 
        ? ((newRestaurants?.count || 0) / (restaurantCount.count || 1)) * 100 
        : 0;

      return {
        totalRevenue: revenue || 0,
        totalCustomers: customerCount.count || 0,
        totalRestaurants: restaurantCount.count || 0,
        totalTransactions: transactionCount.count || 0,
        monthlyGrowth
      };
    } catch (error: any) {
      console.error('Error fetching system-wide stats:', error);
      return {
        totalRevenue: 0,
        totalCustomers: 0,
        totalRestaurants: 0,
        totalTransactions: 0,
        monthlyGrowth: 0
      };
    }
  }
}