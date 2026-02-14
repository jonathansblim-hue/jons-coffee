"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface OrderItem {
  name: string;
  size?: string;
  temperature?: string;
  milk: string;
  iceLevel: string;
  sweetness: string;
  modifications: string[];
  totalPrice: number;
  quantity: number;
}

interface Order {
  id: string;
  order_number: number;
  customer_name: string;
  items: OrderItem[];
  total: number;
  status: "pending" | "in_progress" | "completed";
  created_at: string;
  completed_at: string | null;
}

export default function BaristaPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<"active" | "completed">("active");
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

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
    // Poll for new orders every 5 seconds
    const interval = setInterval(fetchOrders, 5000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const updateOrderStatus = async (
    orderId: string,
    newStatus: "in_progress" | "completed"
  ) => {
    setUpdatingId(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        const data = await res.json();
        setOrders((prev) =>
          prev.map((order) =>
            order.id === orderId ? data.order : order
          )
        );
      }
    } catch (error) {
      console.error("Failed to update order:", error);
    } finally {
      setUpdatingId(null);
    }
  };

  const activeOrders = orders.filter(
    (o) => o.status === "pending" || o.status === "in_progress"
  );
  const completedOrders = orders.filter((o) => o.status === "completed");
  const displayOrders = filter === "active" ? activeOrders : completedOrders;

  const pendingCount = orders.filter((o) => o.status === "pending").length;
  const inProgressCount = orders.filter(
    (o) => o.status === "in_progress"
  ).length;

  const getTimeSince = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}m ago`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "in_progress":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "completed":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending":
        return "New";
      case "in_progress":
        return "In Progress";
      case "completed":
        return "Done";
      default:
        return status;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-emerald-100 px-4 py-3 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-emerald-600 hover:text-emerald-800 transition-colors"
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
              🧑‍🍳 Barista Queue
            </h1>
            <p className="text-xs text-gray-400">
              Jon&apos;s Coffee &middot; Order Tickets
            </p>
          </div>

          <div className="flex items-center gap-2">
            {pendingCount > 0 && (
              <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
                {pendingCount} new
              </span>
            )}
            {inProgressCount > 0 && (
              <span className="bg-blue-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {inProgressCount} making
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Filter Tabs */}
      <div className="max-w-4xl mx-auto px-4 pt-4">
        <div className="flex gap-2 bg-gray-100 rounded-xl p-1 w-fit">
          <button
            onClick={() => setFilter("active")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              filter === "active"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Active ({activeOrders.length})
          </button>
          <button
            onClick={() => setFilter("completed")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              filter === "completed"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Completed ({completedOrders.length})
          </button>
        </div>
      </div>

      {/* Orders Grid */}
      <div className="max-w-4xl mx-auto px-4 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-emerald-300 border-t-emerald-600 rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-gray-400">Loading orders...</p>
            </div>
          </div>
        ) : displayOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-5xl mb-4">
              {filter === "active" ? "☕" : "✅"}
            </div>
            <h3 className="text-lg font-semibold text-gray-600">
              {filter === "active"
                ? "No active orders"
                : "No completed orders yet"}
            </h3>
            <p className="text-sm text-gray-400 mt-1">
              {filter === "active"
                ? "New orders will appear here automatically"
                : "Completed orders will appear here"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {displayOrders.map((order) => (
              <div
                key={order.id}
                className={`animate-slide-in bg-white rounded-xl border-2 overflow-hidden transition-all hover:shadow-md ${
                  order.status === "pending"
                    ? "border-amber-200"
                    : order.status === "in_progress"
                      ? "border-blue-200"
                      : "border-emerald-200"
                }`}
              >
                {/* Ticket Header */}
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xl font-bold text-gray-900">
                      #{order.order_number}
                    </span>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${getStatusColor(order.status)}`}
                    >
                      {getStatusLabel(order.status)}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">
                      {getTimeSince(order.created_at)}
                    </p>
                    <p className="text-xs font-medium text-gray-600">
                      {order.customer_name}
                    </p>
                  </div>
                </div>

                {/* Order Items */}
                <div className="px-4 py-3 space-y-3">
                  {order.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 pb-2 border-b border-gray-50 last:border-0 last:pb-0"
                    >
                      <div className="w-8 h-8 rounded-lg bg-coffee-100 flex items-center justify-center text-sm flex-shrink-0">
                        {item.name.includes("Tea") ||
                        item.name.includes("Matcha")
                          ? "🍵"
                          : item.name.includes("Croissant") ||
                              item.name.includes("Cookie") ||
                              item.name.includes("Banana")
                            ? "🥐"
                            : "☕"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-gray-900">
                          {item.quantity > 1 && (
                            <span className="text-coffee-600">
                              {item.quantity}x{" "}
                            </span>
                          )}
                          {item.name}
                        </p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {item.size && (
                            <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                              {item.size}
                            </span>
                          )}
                          {item.temperature && (
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded ${
                                item.temperature === "Iced"
                                  ? "bg-blue-50 text-blue-600"
                                  : "bg-red-50 text-red-600"
                              }`}
                            >
                              {item.temperature}
                            </span>
                          )}
                          {item.milk &&
                            item.milk !== "Whole Milk" && (
                              <span className="text-[10px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded">
                                {item.milk}
                              </span>
                            )}
                          {item.sweetness &&
                            item.sweetness !== "Regular" && (
                              <span className="text-[10px] bg-pink-50 text-pink-600 px-1.5 py-0.5 rounded">
                                {item.sweetness}
                              </span>
                            )}
                          {item.iceLevel &&
                            item.iceLevel !== "Regular" && (
                              <span className="text-[10px] bg-cyan-50 text-cyan-600 px-1.5 py-0.5 rounded">
                                {item.iceLevel}
                              </span>
                            )}
                          {item.modifications?.map((mod, modIdx) => (
                            <span
                              key={modIdx}
                              className="text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded"
                            >
                              +{mod}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Action Buttons */}
                {order.status !== "completed" && (
                  <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
                    {order.status === "pending" ? (
                      <button
                        onClick={() =>
                          updateOrderStatus(order.id, "in_progress")
                        }
                        disabled={updatingId === order.id}
                        className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                      >
                        {updatingId === order.id ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                              />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                            Start Making
                          </>
                        )}
                      </button>
                    ) : (
                      <button
                        onClick={() =>
                          updateOrderStatus(order.id, "completed")
                        }
                        disabled={updatingId === order.id}
                        className="w-full bg-emerald-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                      >
                        {updatingId === order.id ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                            Mark Complete
                          </>
                        )}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
