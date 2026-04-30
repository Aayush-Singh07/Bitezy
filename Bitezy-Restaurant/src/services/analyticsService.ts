import { supabase } from '../lib/supabase';

export const analyticsService = {
  async getPerformanceOverview(restaurantId: string) {
    const { data, error } = await supabase
      .from('orders')
      .select('total_amount, status, created_at, user_id')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Financial Metrics
    const deliveredOrders = data.filter(o => o.status === 'DELIVERED');
    const earnings = deliveredOrders.reduce((acc, o) => acc + (o.total_amount || 0), 0);
    const cancelledVolume = data
      .filter(o => o.status === 'CANCELLED')
      .reduce((acc, o) => acc + (o.total_amount || 0), 0);

    // 1. Daily Trend
    const dailyMap: Record<string, number> = {};
    deliveredOrders.forEach(o => {
      const day = new Date(o.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      dailyMap[day] = (dailyMap[day] || 0) + (o.total_amount || 0);
    });

    // 2. Hourly Peaks (Performance Analysis)
    const hourlyMap: Record<number, number> = {};
    // Initialize 0-23
    for(let i=0; i<24; i++) hourlyMap[i] = 0;
    data.forEach(o => {
      const hour = new Date(o.created_at).getHours();
      hourlyMap[hour] = (hourlyMap[hour] || 0) + 1;
    });

    // 3. Customer Retention (New vs. Returning)
    const userOrderCounts: Record<string, number> = {};
    data.forEach(o => {
      userOrderCounts[o.user_id] = (userOrderCounts[o.user_id] || 0) + 1;
    });
    const returningUsers = Object.values(userOrderCounts).filter(count => count > 1).length;
    const totalUsers = Object.keys(userOrderCounts).length;

    // 4. Status Success Funnel
    const statusMap: Record<string, number> = {};
    data.forEach(o => {
      statusMap[o.status] = (statusMap[o.status] || 0) + 1;
    });

    return {
      earnings,
      cancelledVolume,
      totalOrders: data.length,
      avgOrderValue: Math.round(earnings / (deliveredOrders.length || 1)),
      dailyTrend: Object.entries(dailyMap).map(([name, value]) => ({ name, value })),
      hourlyData: Object.entries(hourlyMap).map(([hour, count]) => ({ 
        hour: `${hour}:00`, 
        orders: count,
        label: hour === '0' ? '12AM' : hour === '12' ? '12PM' : parseInt(hour) > 12 ? `${parseInt(hour)-12}PM` : `${hour}AM`
      })),
      retention: [
        { name: 'Returning', value: returningUsers },
        { name: 'New', value: Math.max(0, totalUsers - returningUsers) }
      ],
      statusSummary: Object.entries(statusMap).map(([name, value]) => ({ name, value }))
    };
  },

  async getOperationalMetrics(restaurantId: string) {
    const { data, error } = await supabase
      .from('orders')
      .select('accepted_at, prep_started_at, prep_completed_at, delivered_at')
      .eq('restaurant_id', restaurantId)
      .not('delivered_at', 'is', null);

    if (error) throw error;

    const metricsArr = data.map(o => {
      const prepTime = o.prep_completed_at && o.prep_started_at 
        ? (new Date(o.prep_completed_at).getTime() - new Date(o.prep_started_at).getTime()) / 60000 
        : null;
      
      const deliveryTime = o.delivered_at && o.accepted_at 
        ? (new Date(o.delivered_at).getTime() - new Date(o.accepted_at).getTime()) / 60000 
        : null;

      return { prepTime, deliveryTime };
    });

    const validPrep = metricsArr.filter(m => m.prepTime !== null);
    const validDelivery = metricsArr.filter(m => m.deliveryTime !== null);
    
    const avgPrep = validPrep.length > 0 ? validPrep.reduce((acc, m) => acc + m.prepTime!, 0) / validPrep.length : 0;
    const avgDelivery = validDelivery.length > 0 ? validDelivery.reduce((acc, m) => acc + m.deliveryTime!, 0) / validDelivery.length : 0;

    return {
      avgPrepTime: Math.round(avgPrep),
      avgDeliveryTime: Math.round(avgDelivery)
    };
  },

  async getProductIntelligence(restaurantId: string) {
    const { data: itemsData, error: itemsError } = await supabase
      .from('orders')
      .select('id, order_items(quantity, item:items(name), combo:combos(name))')
      .eq('restaurant_id', restaurantId);

    if (itemsError) throw itemsError;

    const productMap: Record<string, number> = {};
    itemsData.forEach(o => {
      o.order_items.forEach((oi: any) => {
        const name = oi.item?.name || oi.combo?.name || 'Unknown Item';
        productMap[name] = (productMap[name] || 0) + oi.quantity;
      });
    });

    return Object.entries(productMap)
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  }
};
