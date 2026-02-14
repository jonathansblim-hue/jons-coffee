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
  status: "pending" | "in_progress" | "completed";
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

export default function OwnerPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState<"today" | "7days" | "30days" | "all">("today");

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch("/api/orders");
      const data = await res.json();
      if (data.orders) {
        setOrders(data.orders);
      }
    } catch (error) {
      console.error("Failed to fetch orders:", error);
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
        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            label="Total Revenue"
            value={`$${metrics.totalRevenue.toFixed(2)}`}
            icon="💰"
            color="bg-emerald-50 border-emerald-200"
          />
          <MetricCard
            label="Total Orders"
            value={metrics.totalOrders.toString()}
            icon="📋"
            color="bg-blue-50 border-blue-200"
          />
          <MetricCard
            label="Avg Order Value"
            value={`$${metrics.avgOrderValue.toFixed(2)}`}
            icon="📈"
            color="bg-purple-50 border-purple-200"
          />
          <MetricCard
            label="Avg Fulfillment"
            value={
              metrics.avgFulfillmentMins > 0
                ? `${metrics.avgFulfillmentMins.toFixed(1)} min`
                : "N/A"
            }
            icon="⏱️"
            color="bg-amber-50 border-amber-200"
          />
        </div>

        {/* Secondary Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            label="Items Sold"
            value={metrics.totalItems.toString()}
            icon="☕"
            color="bg-coffee-50 border-coffee-200"
            small
          />
          <MetricCard
            label="Avg Items/Order"
            value={metrics.avgItemsPerOrder.toFixed(1)}
            icon="🛒"
            color="bg-indigo-50 border-indigo-200"
            small
          />
          <MetricCard
            label="Completed"
            value={metrics.completedOrders.toString()}
            icon="✅"
            color="bg-green-50 border-green-200"
            small
          />
          <MetricCard
            label="Pending"
            value={metrics.pendingOrders.toString()}
            icon="⏳"
            color="bg-orange-50 border-orange-200"
            small
          />
        </div>

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
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={5}
                      dataKey="revenue"
                      label={({ name, percent }) =>
                        `${name} ${(percent * 100).toFixed(0)}%`
                      }
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

function MetricCard({
  label,
  value,
  icon,
  color,
  small,
}: {
  label: string;
  value: string;
  icon: string;
  color: string;
  small?: boolean;
}) {
  return (
    <div
      className={`${color} border rounded-xl ${small ? "p-3" : "p-4"} transition-all hover:shadow-sm`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className={`${small ? "text-lg" : "text-2xl"}`}>{icon}</span>
      </div>
      <p
        className={`${small ? "text-lg" : "text-2xl"} font-bold text-gray-900`}
      >
        {value}
      </p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}
