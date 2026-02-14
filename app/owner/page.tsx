"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import { format, subDays, startOfDay, isToday } from "date-fns";

interface OrderItem {
  name: string;
  size?: string;
  temperature?: string;
  milk: string;
  modifications: string[];
  totalPrice: number;
  quantity: number;
}

interface Order {
  id: string;
  order_number: number;
  customer_name: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: "pending" | "in_progress" | "completed" | "cancelled";
  created_at: string;
  completed_at: string | null;
}

const COLORS = [
  "#d78833",
  "#a65724",
  "#854623",
  "#6c3b1f",
  "#3a1d0f",
  "#e9bf86",
  "#f2d9b5",
  "#c87029",
];

interface AnalyticsData {
  totalConversations: number;
  convertedConversations: number;
  conversionRate: number;
  offMenuItems: { name: string; count: number }[];
  upsellItems: { name: string; attempts: number; successes: number; successRate: number }[];
  totalUpsellAttempts: number;
  totalUpsellSuccesses: number;
  overallUpsellRate: number;
}

export default function OwnerPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState<"today" | "7days" | "30days" | "all">("today");

  const fetchOrders = useCallback(async () => {
    try {
      const [ordersRes, analyticsRes] = await Promise.all([
        fetch("/api/orders"),
        fetch("/api/analytics"),
      ]);
      const ordersData = await ordersRes.json();
      const analyticsData = await analyticsRes.json();

      if (ordersData.orders) setOrders(ordersData.orders);
      if (!analyticsData.error) setAnalytics(analyticsData);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const filteredOrders = useMemo(() => {
    if (dateRange === "all") return orders;

    const now = new Date();
    let cutoff: Date;

    switch (dateRange) {
      case "today":
        cutoff = startOfDay(now);
        break;
      case "7days":
        cutoff = subDays(startOfDay(now), 7);
        break;
      case "30days":
        cutoff = subDays(startOfDay(now), 30);
        break;
      default:
        return orders;
    }

    return orders.filter((o) => new Date(o.created_at) >= cutoff);
  }, [orders, dateRange]);

  // Key Metrics
  const metrics = useMemo(() => {
    const totalRevenue = filteredOrders.reduce((sum, o) => sum + Number(o.total), 0);
    const totalOrders = filteredOrders.length;
    const completedOrders = filteredOrders.filter(
      (o) => o.status === "completed"
    ).length;
    const avgOrderValue =
      totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const totalItems = filteredOrders.reduce(
      (sum, o) =>
        sum + o.items.reduce((iSum, item) => iSum + item.quantity, 0),
      0
    );
    const avgItemsPerOrder = totalOrders > 0 ? totalItems / totalOrders : 0;

    // Average fulfillment time (for completed orders)
    const completedWithTime = filteredOrders.filter(
      (o) => o.status === "completed" && o.completed_at
    );
    const avgFulfillmentMins =
      completedWithTime.length > 0
        ? completedWithTime.reduce((sum, o) => {
            const created = new Date(o.created_at).getTime();
            const completed = new Date(o.completed_at!).getTime();
            return sum + (completed - created) / 60000;
          }, 0) / completedWithTime.length
        : 0;

    return {
      totalRevenue,
      totalOrders,
      completedOrders,
      cancelledOrders: filteredOrders.filter((o) => o.status === "cancelled").length,
      avgOrderValue,
      totalItems,
      avgItemsPerOrder,
      avgFulfillmentMins,
      pendingOrders: filteredOrders.filter((o) => o.status === "pending").length,
    };
  }, [filteredOrders]);

  // Popular Items
  const popularItems = useMemo(() => {
    const itemCounts: Record<string, { count: number; revenue: number }> = {};
    filteredOrders.forEach((order) => {
      order.items.forEach((item) => {
        const key = item.name;
        if (!itemCounts[key]) {
          itemCounts[key] = { count: 0, revenue: 0 };
        }
        itemCounts[key].count += item.quantity;
        itemCounts[key].revenue += item.totalPrice * item.quantity;
      });
    });
    return Object.entries(itemCounts)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [filteredOrders]);

  // Orders by hour (for today view)
  const ordersByHour = useMemo(() => {
    const hours: Record<number, { orders: number; revenue: number }> = {};
    for (let i = 6; i <= 22; i++) {
      hours[i] = { orders: 0, revenue: 0 };
    }

    const todayOrders = orders.filter((o) =>
      isToday(new Date(o.created_at))
    );

    todayOrders.forEach((order) => {
      const hour = new Date(order.created_at).getHours();
      if (hours[hour]) {
        hours[hour].orders += 1;
        hours[hour].revenue += Number(order.total);
      }
    });

    return Object.entries(hours).map(([hour, data]) => ({
      hour: `${parseInt(hour) % 12 || 12}${parseInt(hour) >= 12 ? "pm" : "am"}`,
      ...data,
    }));
  }, [orders]);

  // Revenue by day (last 7 days)
  const revenueByDay = useMemo(() => {
    const days: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const day = format(subDays(new Date(), i), "MMM dd");
      days[day] = 0;
    }

    orders.forEach((order) => {
      const day = format(new Date(order.created_at), "MMM dd");
      if (days[day] !== undefined) {
        days[day] += Number(order.total);
      }
    });

    return Object.entries(days).map(([day, revenue]) => ({
      day,
      revenue: Math.round(revenue * 100) / 100,
    }));
  }, [orders]);

  // Category breakdown
  const categoryBreakdown = useMemo(() => {
    const categories: Record<string, { count: number; revenue: number }> = {
      Coffee: { count: 0, revenue: 0 },
      Tea: { count: 0, revenue: 0 },
      Pastry: { count: 0, revenue: 0 },
    };

    const coffeeNames = [
      "Americano",
      "Latte",
      "Cold Brew",
      "Mocha",
      "Coffee Frappuccino",
    ];
    const teaNames = [
      "Black Tea",
      "Jasmine Tea",
      "Lemon Green Tea",
      "Matcha Latte",
    ];

    filteredOrders.forEach((order) => {
      order.items.forEach((item) => {
        const name = item.name;
        if (coffeeNames.some((c) => name.includes(c))) {
          categories["Coffee"].count += item.quantity;
          categories["Coffee"].revenue += item.totalPrice * item.quantity;
        } else if (teaNames.some((t) => name.includes(t))) {
          categories["Tea"].count += item.quantity;
          categories["Tea"].revenue += item.totalPrice * item.quantity;
        } else {
          categories["Pastry"].count += item.quantity;
          categories["Pastry"].revenue += item.totalPrice * item.quantity;
        }
      });
    });

    return Object.entries(categories)
      .map(([name, data]) => ({ name, ...data }))
      .filter((c) => c.count > 0);
  }, [filteredOrders]);

  // Popular modifications
  const popularMods = useMemo(() => {
    const mods: Record<string, number> = {};
    filteredOrders.forEach((order) => {
      order.items.forEach((item) => {
        if (item.milk && item.milk !== "Whole Milk") {
          mods[item.milk] = (mods[item.milk] || 0) + 1;
        }
        item.modifications?.forEach((mod) => {
          mods[mod] = (mods[mod] || 0) + 1;
        });
      });
    });
    return Object.entries(mods)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [filteredOrders]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-blue-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-blue-100 px-4 py-3 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-blue-600 hover:text-blue-800 transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            <span className="text-sm font-medium">Back</span>
          </Link>

          <div className="text-center">
            <h1 className="text-lg font-bold text-gray-900">
              📊 Owner Dashboard
            </h1>
            <p className="text-xs text-gray-400">
              Jon&apos;s Coffee &middot; Business Insights
            </p>
          </div>

          <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
            {(
              [
                { key: "today", label: "Today" },
                { key: "7days", label: "7D" },
                { key: "30days", label: "30D" },
                { key: "all", label: "All" },
              ] as const
            ).map((option) => (
              <button
                key={option.key}
                onClick={() => setDateRange(option.key)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  dateRange === option.key
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Top Row: Revenue + Order Status */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Revenue Panel */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">💰</span>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Revenue</h3>
            </div>
            <p className="text-3xl font-bold text-gray-900">${metrics.totalRevenue.toFixed(2)}</p>
            <p className="text-xs text-gray-400 mt-1 mb-4">
              {metrics.totalOrders} order{metrics.totalOrders !== 1 ? "s" : ""} total
            </p>
            <div className="grid grid-cols-3 gap-3 pt-3 border-t border-gray-100">
              <div>
                <p className="text-lg font-bold text-gray-900">${metrics.avgOrderValue.toFixed(2)}</p>
                <p className="text-[11px] text-gray-400">Avg Order</p>
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900">{metrics.totalItems}</p>
                <p className="text-[11px] text-gray-400">Items Sold</p>
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900">{metrics.avgItemsPerOrder.toFixed(1)}</p>
                <p className="text-[11px] text-gray-400">Items/Order</p>
              </div>
            </div>
          </div>

          {/* Order Status Panel */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">📋</span>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Order Status</h3>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
                <p className="text-2xl font-bold text-amber-700">{metrics.pendingOrders}</p>
                <p className="text-[11px] text-amber-500 font-medium">Pending</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                <p className="text-2xl font-bold text-blue-700">
                  {filteredOrders.filter((o) => o.status === "in_progress").length}
                </p>
                <p className="text-[11px] text-blue-500 font-medium">In Progress</p>
              </div>
              <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100">
                <p className="text-2xl font-bold text-emerald-700">{metrics.completedOrders}</p>
                <p className="text-[11px] text-emerald-500 font-medium">Completed</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-red-50 rounded-lg p-3 border border-red-100">
                <p className="text-2xl font-bold text-red-600">{metrics.cancelledOrders}</p>
                <p className="text-[11px] text-red-400 font-medium">Cancelled</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                <p className="text-2xl font-bold text-gray-700">
                  {metrics.avgFulfillmentMins > 0
                    ? `${metrics.avgFulfillmentMins.toFixed(1)}m`
                    : "N/A"}
                </p>
                <p className="text-[11px] text-gray-400 font-medium">Avg Fulfillment</p>
              </div>
            </div>
          </div>
        </div>

        {/* Second Row: Conversion Funnel + AI Performance */}
        {analytics && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Conversion Funnel Panel */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-lg">🎯</span>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Conversion Funnel</h3>
              </div>
              {(() => {
                const fulfilledOrders = analytics.convertedConversations - metrics.cancelledOrders;
                const fulfilledRate = analytics.totalConversations > 0
                  ? (fulfilledOrders / analytics.totalConversations) * 100
                  : 0;
                return (
                  <>
                    <div className="flex items-end gap-6 mb-4">
                      <div>
                        <p className="text-3xl font-bold text-gray-900">
                          {analytics.totalConversations > 0
                            ? `${fulfilledRate.toFixed(1)}%`
                            : "N/A"}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">Conversion Rate (excl. cancelled)</p>
                      </div>
                    </div>
                    {/* Funnel Visual */}
                    <div className="space-y-2 pt-3 border-t border-gray-100">
                      <div className="flex items-center gap-3">
                        <div className="w-full bg-violet-100 rounded-full h-7 relative overflow-hidden">
                          <div className="absolute inset-0 flex items-center px-3">
                            <span className="text-xs font-semibold text-violet-700">
                              Conversations Started
                            </span>
                            <span className="text-xs font-bold text-violet-800 ml-auto">
                              {analytics.totalConversations}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div
                          className="bg-blue-100 rounded-full h-7 relative overflow-hidden"
                          style={{
                            width: analytics.totalConversations > 0
                              ? `${Math.max(30, analytics.conversionRate)}%`
                              : "30%",
                          }}
                        >
                          <div className="absolute inset-0 flex items-center px-3">
                            <span className="text-xs font-semibold text-blue-700">
                              Orders Placed
                            </span>
                            <span className="text-xs font-bold text-blue-800 ml-auto">
                              {analytics.convertedConversations}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div
                          className="bg-emerald-100 rounded-full h-7 relative overflow-hidden"
                          style={{
                            width: analytics.totalConversations > 0
                              ? `${Math.max(25, fulfilledRate)}%`
                              : "25%",
                          }}
                        >
                          <div className="absolute inset-0 flex items-center px-3">
                            <span className="text-xs font-semibold text-emerald-700">
                              Orders Fulfilled
                            </span>
                            <span className="text-xs font-bold text-emerald-800 ml-auto">
                              {fulfilledOrders}
                            </span>
                          </div>
                        </div>
                      </div>
                      {metrics.cancelledOrders > 0 && (
                        <p className="text-[10px] text-red-400 pt-1">
                          {metrics.cancelledOrders} order{metrics.cancelledOrders !== 1 ? "s" : ""} cancelled
                        </p>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>

            {/* AI Performance Panel */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-lg">🤖</span>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">AI Performance</h3>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-3xl font-bold text-gray-900">
                    {analytics.totalUpsellAttempts > 0
                      ? `${analytics.overallUpsellRate.toFixed(1)}%`
                      : "N/A"}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Upsell Success Rate</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-gray-900">
                    {analytics.offMenuItems.length}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Off-Menu Requests</p>
                </div>
              </div>
              <div className="pt-3 border-t border-gray-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Upsell Attempts</span>
                  <span className="text-sm font-semibold text-gray-700">{analytics.totalUpsellAttempts}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Upsell Accepted</span>
                  <span className="text-sm font-semibold text-teal-600">{analytics.totalUpsellSuccesses}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Unique Off-Menu Items</span>
                  <span className="text-sm font-semibold text-yellow-600">{analytics.offMenuItems.length}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Upsell & Off-Menu Details */}
        {analytics && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Upsell Performance */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-1">
                Upsell Performance
              </h3>
              <p className="text-xs text-gray-400 mb-4">
                Which items are most successfully upsold by the AI
              </p>
              {analytics.upsellItems.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">
                  No upsell data yet — start some conversations!
                </p>
              ) : (
                <div className="space-y-3">
                  {analytics.upsellItems.map((item) => (
                    <div key={item.name} className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-teal-400 rounded-full transition-all"
                              style={{ width: `${item.successRate}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500">
                            {item.successRate.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-xs text-gray-500">
                          <span className="font-semibold text-teal-600">{item.successes}</span>
                          {" / "}
                          <span>{item.attempts}</span>
                        </p>
                        <p className="text-[10px] text-gray-400">accepted / suggested</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Off-Menu Requests */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-1">
                Off-Menu Requests
              </h3>
              <p className="text-xs text-gray-400 mb-4">
                Items customers ask for that aren&apos;t on the menu — consider adding them!
              </p>
              {analytics.offMenuItems.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">
                  No off-menu requests yet
                </p>
              ) : (
                <div className="space-y-2">
                  {analytics.offMenuItems.map((item, idx) => (
                    <div
                      key={item.name}
                      className="flex items-center justify-between bg-yellow-50 rounded-lg px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-yellow-600 w-5">
                          {idx + 1}.
                        </span>
                        <span className="text-sm text-gray-800">{item.name}</span>
                      </div>
                      <span className="text-xs font-semibold text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full">
                        {item.count} request{item.count !== 1 ? "s" : ""}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Charts Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Orders by Hour */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
              Orders by Hour (Today)
            </h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ordersByHour}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="hour"
                    tick={{ fontSize: 10 }}
                    interval={1}
                  />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid #e5e7eb",
                      fontSize: "12px",
                    }}
                  />
                  <Bar
                    dataKey="orders"
                    fill="#d78833"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Revenue Trend (7 days) */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
              Revenue Trend (7 Days)
            </h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueByDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip
                    formatter={(value: number) => [
                      `$${value.toFixed(2)}`,
                      "Revenue",
                    ]}
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid #e5e7eb",
                      fontSize: "12px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#d78833"
                    strokeWidth={2}
                    dot={{ fill: "#d78833", r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Popular Items */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
              Popular Items
            </h3>
            {popularItems.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">
                No orders yet
              </p>
            ) : (
              <div className="space-y-3">
                {popularItems.map((item, idx) => (
                  <div
                    key={item.name}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-400 w-5">
                        {idx + 1}.
                      </span>
                      <span className="text-sm text-gray-800">
                        {item.name}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-semibold text-gray-900">
                        {item.count}
                      </span>
                      <span className="text-xs text-gray-400 ml-1">sold</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Category Breakdown */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
              Category Breakdown
            </h3>
            {categoryBreakdown.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">
                No orders yet
              </p>
            ) : (
              <>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryBreakdown}
                        cx="50%"
                        cy="50%"
                        innerRadius={35}
                        outerRadius={60}
                        paddingAngle={5}
                        dataKey="revenue"
                      >
                        {categoryBreakdown.map((_entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => [
                          `$${value.toFixed(2)}`,
                          "Revenue",
                        ]}
                        contentStyle={{
                          borderRadius: "8px",
                          border: "1px solid #e5e7eb",
                          fontSize: "12px",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                {/* Legend */}
                <div className="space-y-2 mt-3 pt-3 border-t border-gray-100">
                  {categoryBreakdown.map((cat, index) => {
                    const totalCatRevenue = categoryBreakdown.reduce((s, c) => s + c.revenue, 0);
                    const pct = totalCatRevenue > 0 ? ((cat.revenue / totalCatRevenue) * 100).toFixed(0) : "0";
                    return (
                      <div key={cat.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <span className="text-sm text-gray-700">{cat.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-semibold text-gray-900">{pct}%</span>
                          <span className="text-xs text-gray-400 ml-1.5">${cat.revenue.toFixed(2)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Popular Modifications */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
              Top Modifications
            </h3>
            {popularMods.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">
                No modifications yet
              </p>
            ) : (
              <div className="space-y-3">
                {popularMods.map((mod) => (
                  <div
                    key={mod.name}
                    className="flex items-center justify-between"
                  >
                    <span className="text-sm text-gray-800">{mod.name}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-coffee-400 rounded-full"
                          style={{
                            width: `${(mod.count / (popularMods[0]?.count || 1)) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs font-medium text-gray-600 w-8 text-right">
                        {mod.count}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Orders Table */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">
            Recent Orders
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">
                    #
                  </th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">
                    Customer
                  </th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">
                    Items
                  </th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">
                    Total
                  </th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500">
                    Status
                  </th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.slice(0, 20).map((order) => (
                  <tr
                    key={order.id}
                    className="border-b border-gray-50 hover:bg-gray-50"
                  >
                    <td className="py-2.5 px-3 font-semibold text-gray-900">
                      #{order.order_number}
                    </td>
                    <td className="py-2.5 px-3 text-gray-700">
                      {order.customer_name}
                    </td>
                    <td className="py-2.5 px-3 text-gray-600">
                      {order.items
                        .map(
                          (i) =>
                            `${i.quantity > 1 ? `${i.quantity}x ` : ""}${i.name}`
                        )
                        .join(", ")}
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium text-gray-900">
                      ${Number(order.total).toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          order.status === "completed"
                            ? "bg-emerald-100 text-emerald-700"
                            : order.status === "in_progress"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {order.status === "in_progress"
                          ? "Making"
                          : order.status === "completed"
                            ? "Done"
                            : "New"}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-xs text-gray-400">
                      {format(new Date(order.created_at), "h:mm a")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredOrders.length === 0 && (
              <p className="text-center text-gray-400 py-8 text-sm">
                No orders in this time period
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

