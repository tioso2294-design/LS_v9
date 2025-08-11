import React, { useState, useEffect } from 'react';
import { 
  BarChart3, Users, Building, CreditCard, TrendingUp, TrendingDown,
  DollarSign, Crown, AlertCircle, RefreshCw, Search, Filter,
  Calendar, Eye, MoreVertical, Download, Settings, LogOut,
  ChefHat, Gift, Target, Zap, Clock, CheckCircle, X,
  PieChart, LineChart, Activity, Globe, Shield, Star
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart as RechartsPieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart as RechartsLineChart, Line
} from 'recharts';
import { SubscriptionService } from '../services/subscriptionService';
import { SupportService } from '../services/supportService';
import { supabase } from '../lib/supabase';

interface SystemStats {
  totalUsers: number;
  totalRestaurants: number;
  totalCustomers: number;
  totalPointsIssued: number;
  activeTickets: number;
  monthlyGrowth: number;
}

interface SubscriptionStats {
  total: number;
  active: number;
  trial: number;
  paid: number;
  revenue: number;
  churnRate: number;
  planDistribution: { plan: string; count: number; percentage: number }[];
}

interface RecentSubscription {
  id: string;
  user_email: string;
  restaurant_name: string;
  plan_type: string;
  status: string;
  created_at: string;
  current_period_end: string;
}

const SuperAdminUI: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'subscriptions' | 'restaurants' | 'customers' | 'support' | 'analytics'>('overview');
  const [systemStats, setSystemStats] = useState<SystemStats>({
    totalUsers: 0,
    totalRestaurants: 0,
    totalCustomers: 0,
    totalPointsIssued: 0,
    activeTickets: 0,
    monthlyGrowth: 0
  });
  const [subscriptionStats, setSubscriptionStats] = useState<SubscriptionStats>({
    total: 0,
    active: 0,
    trial: 0,
    paid: 0,
    revenue: 0,
    churnRate: 0,
    planDistribution: []
  });
  const [recentSubscriptions, setRecentSubscriptions] = useState<RecentSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    // Check authentication
    const isAuthenticated = localStorage.getItem('super_admin_authenticated') === 'true';
    const loginTime = localStorage.getItem('super_admin_login_time');
    
    if (!isAuthenticated || !loginTime) {
      window.location.href = '/super-admin-login';
      return;
    }

    // Check if session is still valid (24 hours)
    const loginDate = new Date(loginTime);
    const now = new Date();
    const hoursSinceLogin = (now.getTime() - loginDate.getTime()) / (1000 * 60 * 60);
    
    if (hoursSinceLogin > 24) {
      localStorage.removeItem('super_admin_authenticated');
      localStorage.removeItem('super_admin_login_time');
      window.location.href = '/super-admin-login';
      return;
    }

    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      setError('');
      
      await Promise.all([
        fetchSystemStats(),
        fetchSubscriptionData(),
        fetchRecentSubscriptions()
      ]);
    } catch (err: any) {
      console.error('Error fetching admin data:', err);
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const fetchSystemStats = async () => {
    try {
      // Get total restaurants
      const { count: restaurantCount, error: restaurantError } = await supabase
        .from('restaurants')
        .select('*', { count: 'exact', head: true });

      if (restaurantError) throw restaurantError;

      // Get total customers across all restaurants
      const { count: customerCount, error: customerError } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true });

      if (customerError) throw customerError;

      // Get total points issued
      const { data: pointsData, error: pointsError } = await supabase
        .from('transactions')
        .select('points')
        .gt('points', 0);

      if (pointsError) throw pointsError;

      const totalPointsIssued = pointsData?.reduce((sum, t) => sum + t.points, 0) || 0;

      // Get active support tickets
      const ticketStats = await SupportService.getTicketStats();

      // Get total users from subscriptions (since we can't directly access auth.users)
      const { count: userCount, error: userError } = await supabase
        .from('subscriptions')
        .select('user_id', { count: 'exact', head: true });

      if (userError) throw userError;

      // Calculate monthly growth
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);

      const { count: newRestaurantsThisMonth, error: growthError } = await supabase
        .from('restaurants')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', lastMonth.toISOString());

      if (growthError) throw growthError;

      const monthlyGrowth = restaurantCount && restaurantCount > 0 
        ? ((newRestaurantsThisMonth || 0) / restaurantCount) * 100 
        : 0;

      setSystemStats({
        totalUsers: userCount || 0,
        totalRestaurants: restaurantCount || 0,
        totalCustomers: customerCount || 0,
        totalPointsIssued,
        activeTickets: ticketStats.open + ticketStats.inProgress,
        monthlyGrowth
      });
    } catch (error) {
      console.error('Error fetching system stats:', error);
    }
  };

  const fetchSubscriptionData = async () => {
    try {
      // Get all subscriptions with enhanced data
      const subscriptions = await SubscriptionService.getAllSubscriptions();
      const stats = await SubscriptionService.getSubscriptionStats();
      
      // Calculate plan distribution
      const planCounts = subscriptions.reduce((acc, sub) => {
        acc[sub.plan_type] = (acc[sub.plan_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const planDistribution = Object.entries(planCounts).map(([plan, count]) => ({
        plan: plan.charAt(0).toUpperCase() + plan.slice(1),
        count,
        percentage: subscriptions.length > 0 ? (count / subscriptions.length) * 100 : 0
      }));

      setSubscriptionStats({
        ...stats,
        planDistribution
      });
    } catch (error) {
      console.error('Error fetching subscription data:', error);
    }
  };

  const fetchRecentSubscriptions = async () => {
    try {
      // Get recent subscriptions with user and restaurant data
      const subscriptions = await SubscriptionService.getAllSubscriptions();
      
      // Sort by created_at and take the most recent 20
      const recent = subscriptions
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 20)
        .map(sub => ({
          id: sub.id,
          user_email: sub.user_email || 'Unknown',
          restaurant_name: sub.restaurant_name || 'Unknown Restaurant',
          plan_type: sub.plan_type,
          status: sub.status,
          created_at: sub.created_at,
          current_period_end: sub.current_period_end
        }));

      setRecentSubscriptions(recent);
    } catch (error) {
      console.error('Error fetching recent subscriptions:', error);
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem('super_admin_authenticated');
    localStorage.removeItem('super_admin_login_time');
    window.location.href = '/super-admin-login';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'past_due': return 'bg-yellow-100 text-yellow-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'expired': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPlanColor = (plan: string) => {
    switch (plan.toLowerCase()) {
      case 'trial': return '#94A3B8';
      case 'monthly': return '#3B82F6';
      case 'semiannual': return '#8B5CF6';
      case 'annual': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const filteredSubscriptions = recentSubscriptions.filter(sub =>
    sub.user_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    sub.restaurant_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    sub.plan_type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Super Admin Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-700 rounded-xl flex items-center justify-center">
              <ChefHat className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Super Admin Dashboard</h1>
              <p className="text-sm text-gray-600">Unified platform management & subscriptions</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button
              onClick={fetchAllData}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Refresh Data"
            >
              <RefreshCw className="h-5 w-5" />
            </button>
            <button
              onClick={() => setError('')}
              className="px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm font-medium"
              title="Reset Data"
            >
              Reset Data
            </button>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">Super Admin</p>
                <p className="text-xs text-gray-500">System Administrator</p>
              </div>
              <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center">
                <ChefHat className="h-5 w-5 text-white" />
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-white border-b border-gray-200">
        <div className="px-6">
          <div className="flex space-x-8">
            {[
              { id: 'overview', label: 'System Overview', icon: BarChart3 },
              { id: 'subscriptions', label: 'Subscriptions', icon: CreditCard },
              { id: 'restaurants', label: 'Restaurants', icon: Building },
              { id: 'customers', label: 'All Customers', icon: Users },
              { id: 'support', label: 'Support Tickets', icon: Settings },
              { id: 'analytics', label: 'Analytics', icon: TrendingUp }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-red-500 text-red-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="p-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 flex items-center gap-3">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
            <button
              onClick={() => setError('')}
              className="ml-auto p-1 hover:bg-red-100 rounded"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* System Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">System Overview</h2>
              <p className="text-gray-600">Complete overview of the TableLoyalty platform and subscriptions</p>
            </div>

            {/* Primary Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-2xl p-6 border border-gray-200">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                    <Users className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total Users</p>
                    <p className="text-2xl font-bold text-gray-900">{systemStats.totalUsers}</p>
                  </div>
                </div>
                <p className="text-xs text-gray-500">Platform registered users</p>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-gray-200">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                    <CreditCard className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Active Subscriptions</p>
                    <p className="text-2xl font-bold text-gray-900">{subscriptionStats.active}</p>
                  </div>
                </div>
                <p className="text-xs text-gray-500">{subscriptionStats.paid} paid users</p>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-gray-200">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                    <DollarSign className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Monthly Revenue</p>
                    <p className="text-2xl font-bold text-gray-900">{formatCurrency(subscriptionStats.revenue)}</p>
                  </div>
                </div>
                <p className="text-xs text-gray-500">Recurring revenue</p>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-gray-200">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                    <TrendingDown className="h-6 w-6 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Churn Rate</p>
                    <p className="text-2xl font-bold text-gray-900">{subscriptionStats.churnRate.toFixed(1)}%</p>
                  </div>
                </div>
                <p className="text-xs text-gray-500">Monthly churn</p>
              </div>
            </div>

            {/* Secondary Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-2xl p-6 border border-gray-200">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                    <Building className="h-6 w-6 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total Restaurants</p>
                    <p className="text-2xl font-bold text-gray-900">{systemStats.totalRestaurants}</p>
                  </div>
                </div>
                <p className="text-xs text-green-600">+{Math.floor(systemStats.monthlyGrowth)} this month</p>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-gray-200">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center">
                    <Users className="h-6 w-6 text-teal-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total Customers</p>
                    <p className="text-2xl font-bold text-gray-900">{systemStats.totalCustomers}</p>
                  </div>
                </div>
                <p className="text-xs text-gray-500">+1 this month</p>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-gray-200">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
                    <Zap className="h-6 w-6 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Points Issued</p>
                    <p className="text-2xl font-bold text-gray-900">{systemStats.totalPointsIssued.toLocaleString()}</p>
                  </div>
                </div>
                <p className="text-xs text-gray-500">Total loyalty points</p>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-gray-200">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-pink-100 rounded-xl flex items-center justify-center">
                    <Settings className="h-6 w-6 text-pink-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Active Tickets</p>
                    <p className="text-2xl font-bold text-gray-900">{systemStats.activeTickets}</p>
                  </div>
                </div>
                <p className="text-xs text-gray-500">Pending support</p>
              </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Subscription Plan Distribution */}
              <div className="bg-white rounded-2xl p-6 border border-gray-200">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Subscription Plan Distribution</h3>
                    <p className="text-sm text-gray-500">Current plan breakdown</p>
                  </div>
                </div>
                
                {subscriptionStats.planDistribution.length > 0 ? (
                  <div className="space-y-4">
                    {subscriptionStats.planDistribution.map((item, index) => (
                      <div key={item.plan} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: getPlanColor(item.plan) }}
                          />
                          <span className="font-medium text-gray-900">{item.plan}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="w-32 bg-gray-200 rounded-full h-2">
                            <div 
                              className="h-2 rounded-full"
                              style={{ 
                                width: `${item.percentage}%`,
                                backgroundColor: getPlanColor(item.plan)
                              }}
                            />
                          </div>
                          <span className="text-sm font-medium text-gray-900 w-8">{item.count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <PieChart className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500">No subscription data available</p>
                  </div>
                )}
              </div>

              {/* Revenue Breakdown */}
              <div className="bg-white rounded-2xl p-6 border border-gray-200">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Revenue Breakdown</h3>
                    <p className="text-sm text-gray-500">Monthly recurring revenue analysis</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-green-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <DollarSign className="h-5 w-5 text-green-600" />
                      <span className="font-medium text-green-900">Total Revenue</span>
                    </div>
                    <span className="text-lg font-bold text-green-900">{formatCurrency(subscriptionStats.revenue)}</span>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 bg-blue-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <RefreshCw className="h-5 w-5 text-blue-600" />
                      <span className="font-medium text-blue-900">Monthly Recurring</span>
                    </div>
                    <span className="text-lg font-bold text-blue-900">{formatCurrency(subscriptionStats.revenue * 0.6)}</span>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <Clock className="h-5 w-5 text-gray-600" />
                      <span className="font-medium text-gray-900">Trial Users</span>
                    </div>
                    <span className="text-lg font-bold text-gray-900">{subscriptionStats.trial}</span>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 bg-purple-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <Crown className="h-5 w-5 text-purple-600" />
                      <span className="font-medium text-purple-900">Paid Users</span>
                    </div>
                    <span className="text-lg font-bold text-purple-900">{subscriptionStats.paid}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Subscriptions Tab */}
        {activeTab === 'subscriptions' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Subscription Management</h2>
                <p className="text-gray-600">Manage all platform subscriptions and billing</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search subscriptions..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Subscription Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-2xl p-6 border border-gray-200">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                    <Users className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total Users</p>
                    <p className="text-2xl font-bold text-gray-900">{subscriptionStats.total}</p>
                  </div>
                </div>
                <p className="text-xs text-gray-500">Platform registered users</p>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-gray-200">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Active Subscriptions</p>
                    <p className="text-2xl font-bold text-gray-900">{subscriptionStats.active}</p>
                  </div>
                </div>
                <p className="text-xs text-gray-500">{subscriptionStats.paid} paid users</p>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-gray-200">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                    <DollarSign className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Monthly Revenue</p>
                    <p className="text-2xl font-bold text-gray-900">{formatCurrency(subscriptionStats.revenue)}</p>
                  </div>
                </div>
                <p className="text-xs text-gray-500">Recurring revenue</p>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-gray-200">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                    <TrendingDown className="h-6 w-6 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Churn Rate</p>
                    <p className="text-2xl font-bold text-gray-900">{subscriptionStats.churnRate.toFixed(1)}%</p>
                  </div>
                </div>
                <p className="text-xs text-gray-500">Monthly churn</p>
              </div>
            </div>

            {/* Recent Subscriptions */}
            <div className="bg-white rounded-2xl border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Recent Subscriptions</h3>
                <p className="text-sm text-gray-500">Latest subscription activities</p>
              </div>
              
              {filteredSubscriptions.length === 0 ? (
                <div className="p-12 text-center">
                  <CreditCard className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">No Subscriptions Found</h4>
                  <p className="text-gray-500">
                    {recentSubscriptions.length === 0 
                      ? 'No subscriptions have been created yet.'
                      : 'No subscriptions match your search criteria.'
                    }
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left py-3 px-6 font-medium text-gray-700">USER</th>
                        <th className="text-left py-3 px-6 font-medium text-gray-700">RESTAURANT</th>
                        <th className="text-left py-3 px-6 font-medium text-gray-700">PLAN</th>
                        <th className="text-left py-3 px-6 font-medium text-gray-700">STATUS</th>
                        <th className="text-left py-3 px-6 font-medium text-gray-700">CREATED</th>
                        <th className="text-left py-3 px-6 font-medium text-gray-700">EXPIRES</th>
                        <th className="text-right py-3 px-6 font-medium text-gray-700">ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredSubscriptions.map((subscription) => (
                        <tr key={subscription.id} className="hover:bg-gray-50">
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                                {subscription.user_email.charAt(0).toUpperCase()}
                              </div>
                              <span className="font-medium text-gray-900">{subscription.user_email}</span>
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <span className="text-gray-900">{subscription.restaurant_name}</span>
                          </td>
                          <td className="py-4 px-6">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                              subscription.plan_type === 'trial' ? 'bg-gray-100 text-gray-800' :
                              subscription.plan_type === 'monthly' ? 'bg-blue-100 text-blue-800' :
                              subscription.plan_type === 'semiannual' ? 'bg-purple-100 text-purple-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {subscription.plan_type.charAt(0).toUpperCase() + subscription.plan_type.slice(1)}
                            </span>
                          </td>
                          <td className="py-4 px-6">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(subscription.status)}`}>
                              {subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-gray-600">
                            {formatDate(subscription.created_at)}
                          </td>
                          <td className="py-4 px-6 text-gray-600">
                            {formatDate(subscription.current_period_end)}
                          </td>
                          <td className="py-4 px-6 text-right">
                            <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
                              <MoreVertical className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Other tabs can be implemented similarly */}
        {activeTab !== 'overview' && activeTab !== 'subscriptions' && (
          <div className="bg-white rounded-2xl p-12 border border-gray-200 text-center">
            <Settings className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Management</h3>
            <p className="text-gray-500">This section is coming soon...</p> 
          </div>
        )}
      </main>
    </div>
  );
};

export default SuperAdminUI; 