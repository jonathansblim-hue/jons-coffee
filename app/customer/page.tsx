"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { v4 as uuidv4 } from "uuid";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface OrderItem {
  name: string;
  size?: string;
  temperature?: string;
  milk: string;
  iceLevel: string;
  sweetness: string;
  modifications: string[];
  basePrice: number;
  modificationsPrice: number;
  totalPrice: number;
  quantity: number;
}

interface OrderData {
  order_confirmed: boolean;
  customer_name: string;
  items: OrderItem[];
}

export default function CustomerPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [placedOrder, setPlacedOrder] = useState<{
    order_number: number;
    total: number;
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Send initial greeting
  useEffect(() => {
    const greeting: Message = {
      id: uuidv4(),
      role: "assistant",
      content:
        "Hey there! Welcome to Jon's Coffee! ☕ I'm Jo, your AI barista. What can I get started for you today?",
      timestamp: new Date(),
    };
    setMessages([greeting]);
  }, []);

  const extractOrderData = (text: string): OrderData | null => {
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      try {
        const data = JSON.parse(jsonMatch[1]);
        if (data.order_confirmed) {
          return data;
        }
      } catch (e) {
        console.error("Failed to parse order JSON:", e);
      }
    }
    return null;
  };

  const submitOrder = useCallback(
    async (orderData: OrderData) => {
      if (orderPlaced) return;

      const subtotal = orderData.items.reduce(
        (sum, item) => sum + item.totalPrice * item.quantity,
        0
      );
      const tax = Math.round(subtotal * 0.08875 * 100) / 100;
      const total = Math.round((subtotal + tax) * 100) / 100;

      try {
        const res = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customer_name: orderData.customer_name,
            items: orderData.items,
            subtotal,
            tax,
            total,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          setOrderPlaced(true);
          setPlacedOrder({
            order_number: data.order.order_number,
            total,
          });
        }
      } catch (error) {
        console.error("Failed to submit order:", error);
      }
    },
    [orderPlaced]
  );

  const speakText = async (text: string) => {
    if (!isVoiceMode) return;

    // Strip markdown/json from speech
    const cleanText = text
      .replace(/```json[\s\S]*?```/g, "")
      .replace(/[*_`#]/g, "")
      .trim();

    if (!cleanText) return;

    setIsSpeaking(true);

    try {
      const res = await fetch("/api/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: cleanText }),
      });

      const contentType = res.headers.get("content-type");

      if (contentType?.includes("audio/mpeg")) {
        const audioBlob = await res.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        audio.onended = () => {
          setIsSpeaking(false);
          URL.revokeObjectURL(audioUrl);
        };
        audio.onerror = () => {
          setIsSpeaking(false);
          URL.revokeObjectURL(audioUrl);
        };
        await audio.play();
      } else {
        // Fallback to browser TTS
        if ("speechSynthesis" in window) {
          const utterance = new SpeechSynthesisUtterance(cleanText);
          utterance.rate = 1.0;
          utterance.pitch = 1.0;
          utterance.onend = () => setIsSpeaking(false);
          utterance.onerror = () => setIsSpeaking(false);
          window.speechSynthesis.speak(utterance);
        } else {
          setIsSpeaking(false);
        }
      }
    } catch {
      // Fallback to browser TTS
      if ("speechSynthesis" in window) {
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.onend = () => setIsSpeaking(false);
        window.speechSynthesis.speak(utterance);
      } else {
        setIsSpeaking(false);
      }
    }
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: Message = {
      id: uuidv4(),
      role: "user",
      content: text.trim(),
      timestamp: new Date(),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      const assistantMessage: Message = {
        id: uuidv4(),
        role: "assistant",
        content: data.message,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Check if order was confirmed
      const orderData = extractOrderData(data.message);
      if (orderData) {
        submitOrder(orderData);
      }

      // Speak the response if in voice mode
      speakText(data.message);
    } catch (error) {
      console.error("Failed to send message:", error);
      const errorMessage: Message = {
        id: uuidv4(),
        role: "assistant",
        content:
          "Sorry, I'm having trouble right now. Could you try again?",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm",
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });
        stream.getTracks().forEach((track) => track.stop());

        // Transcribe
        const formData = new FormData();
        formData.append("audio", audioBlob, "recording.webm");

        try {
          setIsLoading(true);
          const res = await fetch("/api/transcribe", {
            method: "POST",
            body: formData,
          });

          const data = await res.json();
          if (data.text) {
            sendMessage(data.text);
          }
        } catch (error) {
          console.error("Transcription failed:", error);
          setIsLoading(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Failed to start recording:", error);
      alert(
        "Microphone access is required for voice ordering. Please allow microphone access and try again."
      );
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const formatMessageContent = (content: string) => {
    // Remove JSON blocks from display
    const cleanContent = content.replace(/```json[\s\S]*?```/g, "").trim();

    // Basic markdown formatting
    return cleanContent.split("\n").map((line, i) => {
      // Bold
      const formatted = line.replace(
        /\*\*(.*?)\*\*/g,
        '<strong>$1</strong>'
      );
      return (
        <span
          key={i}
          dangerouslySetInnerHTML={{ __html: formatted }}
          className="block"
        />
      );
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-coffee-50 via-white to-amber-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-coffee-100 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <Link
          href="/"
          className="flex items-center gap-2 text-coffee-600 hover:text-coffee-800 transition-colors"
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
          <h1 className="text-lg font-bold text-coffee-900">
            Jon&apos;s Coffee
          </h1>
          <p className="text-xs text-coffee-400">AI Voice Cashier</p>
        </div>

        {/* Voice/Text Toggle */}
        <button
          onClick={() => {
            setIsVoiceMode(!isVoiceMode);
            if (isSpeaking) {
              window.speechSynthesis?.cancel();
              setIsSpeaking(false);
            }
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            isVoiceMode
              ? "bg-coffee-600 text-white"
              : "bg-coffee-100 text-coffee-700"
          }`}
        >
          {isVoiceMode ? (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              Voice On
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              Text
            </>
          )}
        </button>
      </header>

      {/* Chat Messages */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto px-4 py-6 space-y-4 max-w-2xl mx-auto w-full"
      >
        {messages.map((message) => (
          <div
            key={message.id}
            className={`animate-fade-in-up flex ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                message.role === "user"
                  ? "bg-coffee-600 text-white rounded-br-md"
                  : "bg-white border border-coffee-100 text-gray-800 rounded-bl-md shadow-sm"
              }`}
            >
              {message.role === "assistant" && (
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-xs font-semibold text-coffee-600">
                    Jo
                  </span>
                  <span className="text-[10px] text-gray-400">AI Barista</span>
                </div>
              )}
              <div className="text-sm leading-relaxed">
                {formatMessageContent(message.content)}
              </div>
              <div
                className={`text-[10px] mt-1 ${
                  message.role === "user" ? "text-coffee-200" : "text-gray-300"
                }`}
              >
                {message.timestamp.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isLoading && (
          <div className="flex justify-start animate-fade-in-up">
            <div className="bg-white border border-coffee-100 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-xs font-semibold text-coffee-600">
                  Jo
                </span>
              </div>
              <div className="flex gap-1 py-1">
                <span className="typing-dot"></span>
                <span className="typing-dot"></span>
                <span className="typing-dot"></span>
              </div>
            </div>
          </div>
        )}

        {/* Order Confirmation Card */}
        {orderPlaced && placedOrder && (
          <div className="animate-fade-in-up flex justify-center">
            <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl px-6 py-4 text-center max-w-sm">
              <div className="text-3xl mb-2">✅</div>
              <h3 className="font-bold text-emerald-800 text-lg">
                Order Placed!
              </h3>
              <p className="text-emerald-600 text-sm mt-1">
                Order #{placedOrder.order_number}
              </p>
              <p className="text-emerald-700 font-semibold mt-1">
                Total: ${placedOrder.total.toFixed(2)}
              </p>
              <p className="text-xs text-emerald-500 mt-2">
                Your order has been sent to the barista!
              </p>
              <button
                onClick={() => {
                  setMessages([]);
                  setOrderPlaced(false);
                  setPlacedOrder(null);
                  setMessages([
                    {
                      id: uuidv4(),
                      role: "assistant",
                      content:
                        "Hey there! Welcome back to Jon's Coffee! ☕ What can I get for you?",
                      timestamp: new Date(),
                    },
                  ]);
                }}
                className="mt-3 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
              >
                Place Another Order
              </button>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Speaking indicator */}
      {isSpeaking && (
        <div className="flex justify-center pb-2">
          <div className="flex items-center gap-2 bg-coffee-100 px-3 py-1.5 rounded-full">
            <div className="flex gap-0.5">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="w-1 bg-coffee-500 rounded-full animate-pulse"
                  style={{
                    height: `${8 + Math.random() * 12}px`,
                    animationDelay: `${i * 0.15}s`,
                  }}
                />
              ))}
            </div>
            <span className="text-xs text-coffee-600 font-medium">
              Jo is speaking...
            </span>
          </div>
        </div>
      )}

      {/* Input Area */}
      {!orderPlaced && (
        <div className="border-t border-coffee-100 bg-white/80 backdrop-blur-sm px-4 py-3">
          <div className="max-w-2xl mx-auto">
            {isVoiceMode ? (
              <div className="flex flex-col items-center gap-3 py-2">
                <button
                  onMouseDown={startRecording}
                  onMouseUp={stopRecording}
                  onTouchStart={startRecording}
                  onTouchEnd={stopRecording}
                  disabled={isLoading || isSpeaking}
                  className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
                    isRecording
                      ? "bg-red-500 recording-pulse scale-110"
                      : isLoading
                        ? "bg-gray-300 cursor-not-allowed"
                        : "bg-coffee-600 hover:bg-coffee-700 active:scale-95"
                  }`}
                >
                  <svg
                    className="w-7 h-7 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                    />
                  </svg>
                </button>
                <p className="text-xs text-coffee-400">
                  {isRecording
                    ? "Listening... Release to send"
                    : isLoading
                      ? "Processing..."
                      : "Hold to speak"}
                </p>
                {/* Text input fallback in voice mode */}
                <div className="w-full flex gap-2">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Or type a message..."
                    className="flex-1 bg-coffee-50 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-coffee-300 placeholder-coffee-300"
                    disabled={isLoading}
                  />
                  <button
                    onClick={() => sendMessage(input)}
                    disabled={!input.trim() || isLoading}
                    className="bg-coffee-600 text-white rounded-xl px-4 py-2.5 text-sm font-medium hover:bg-coffee-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Send
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Tell me what you'd like to order..."
                  className="flex-1 bg-coffee-50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-coffee-300 placeholder-coffee-300"
                  disabled={isLoading}
                />
                <button
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || isLoading}
                  className="bg-coffee-600 text-white rounded-xl px-5 py-3 text-sm font-medium hover:bg-coffee-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                >
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
                      d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                    />
                  </svg>
                  Send
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
