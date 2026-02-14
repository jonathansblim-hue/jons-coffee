"use client";

import Link from "next/link";
import { useState } from "react";

export default function Home() {
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  const roles = [
    {
      id: "customer",
      title: "Order Coffee",
      subtitle: "Customer",
      description: "Chat with our AI barista to place your order by voice or text",
      icon: "☕",
      href: "/customer",
      gradient: "from-amber-50 to-orange-50",
      borderColor: "border-amber-200",
      hoverBorder: "hover:border-amber-400",
      iconBg: "bg-amber-100",
    },
    {
      id: "barista",
      title: "Order Queue",
      subtitle: "Barista",
      description: "View and manage incoming order tickets in real-time",
      icon: "🧑‍🍳",
      href: "/barista",
      gradient: "from-emerald-50 to-teal-50",
      borderColor: "border-emerald-200",
      hoverBorder: "hover:border-emerald-400",
      iconBg: "bg-emerald-100",
    },
    {
      id: "owner",
      title: "Dashboard",
      subtitle: "Owner",
      description: "View sales metrics, order history, and business insights",
      icon: "📊",
      href: "/owner",
      gradient: "from-blue-50 to-indigo-50",
      borderColor: "border-blue-200",
      hoverBorder: "hover:border-blue-400",
      iconBg: "bg-blue-100",
    },
  ];

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-coffee-50 via-white to-amber-50">
      {/* Header */}
      <div className="text-center mb-12">
        <div className="text-6xl mb-4">☕</div>
        <h1 className="text-4xl md:text-5xl font-bold text-coffee-900 font-display">
          Jon&apos;s Coffee
        </h1>
        <p className="text-lg text-coffee-600 mt-2">
          512 West 43rd Street, New York, NY
        </p>
        <p className="text-sm text-coffee-400 mt-1">Tel: 212-535-7367</p>
      </div>

      {/* Role Selection Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl w-full">
        {roles.map((role) => (
          <Link
            key={role.id}
            href={role.href}
            className={`group relative p-6 rounded-2xl border-2 ${role.borderColor} ${role.hoverBorder} bg-gradient-to-br ${role.gradient} transition-all duration-300 hover:shadow-lg hover:-translate-y-1`}
            onMouseEnter={() => setHoveredCard(role.id)}
            onMouseLeave={() => setHoveredCard(null)}
          >
            <div
              className={`w-16 h-16 rounded-xl ${role.iconBg} flex items-center justify-center text-3xl mb-4 transition-transform duration-300 ${hoveredCard === role.id ? "scale-110" : ""}`}
            >
              {role.icon}
            </div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
              {role.subtitle}
            </p>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              {role.title}
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              {role.description}
            </p>
            <div className="mt-4 flex items-center text-sm font-medium text-coffee-600 group-hover:text-coffee-800 transition-colors">
              Enter
              <svg
                className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </Link>
        ))}
      </div>

      {/* Footer */}
      <p className="mt-12 text-xs text-coffee-300">
        Powered by AI &middot; NYC Coffee &copy; {new Date().getFullYear()}
      </p>
    </main>
  );
}
