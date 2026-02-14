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

interface CartItem {
  name: string;
  size?: string;
  quantity: number;
  unitPrice: number;
  notes?: string;
}

// ─── Silence Detection Helpers ─────────────────────────────────────
// Uses the Web Audio API to detect when the user stops talking.
// When volume stays below a threshold for SILENCE_DURATION ms, we stop recording.
const SILENCE_THRESHOLD = 0.015; // RMS volume below this = silence
const SILENCE_DURATION = 2000; // ms of silence before auto-stop

export default function CustomerPage() {
  // ─── State ─────────────────────────────────────────────────────
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [orderStarted, setOrderStarted] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const conversationIdRef = useRef<string | null>(null);
  const [placedOrder, setPlacedOrder] = useState<{
    order_number: number;
    total: number;
  } | null>(null);

  // ─── Refs ──────────────────────────────────────────────────────
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const silenceCheckRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const speechRecognitionRef = useRef<SpeechRecognition | null>(null);
  const shouldAutoListenRef = useRef(false);
  const isRecordingRef = useRef(false);
  const isLoadingRef = useRef(false);
  const isTranscribingRef = useRef(false);
  const isVoiceModeRef = useRef(false);

  // Keep refs in sync with state
  useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);
  useEffect(() => { isLoadingRef.current = isLoading; }, [isLoading]);
  useEffect(() => { isTranscribingRef.current = isTranscribing; }, [isTranscribing]);
  useEffect(() => { isVoiceModeRef.current = isVoiceMode; }, [isVoiceMode]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, liveTranscript]);

  // ─── Cart & Order Data Extraction ─────────────────────────────
  const extractCartData = (text: string): CartItem[] | null => {
    const cartMatch = text.match(/```cart\s*([\s\S]*?)\s*```/);
    if (cartMatch) {
      try {
        const items = JSON.parse(cartMatch[1]);
        if (Array.isArray(items)) return items;
      } catch (e) {
        console.error("Failed to parse cart JSON:", e);
      }
    }
    return null;
  };

  const extractAnalytics = (text: string): { off_menu_requests: string[]; upsell_attempts: string[]; upsell_successes: string[] } | null => {
    // Match both properly closed and unclosed analytics blocks
    const match = text.match(/```analytics\s*([\s\S]*?)\s*```/) || text.match(/```analytics\s*([\s\S]*)$/);
    if (match) {
      try {
        const data = JSON.parse(match[1]);
        return {
          off_menu_requests: data.off_menu_requests || [],
          upsell_attempts: data.upsell_attempted || data.upsell_attempts || [],
          upsell_successes: data.upsell_accepted || data.upsell_successes || [],
        };
      } catch (e) {
        console.error("Failed to parse analytics JSON:", e);
      }
    }
    return null;
  };

  const sendAnalytics = async (analytics: { off_menu_requests: string[]; upsell_attempts: string[]; upsell_successes: string[] }) => {
    if (!conversationIdRef.current) return;
    const hasData = analytics.off_menu_requests.length > 0 || analytics.upsell_attempts.length > 0 || analytics.upsell_successes.length > 0;
    if (!hasData) return;

    try {
      await fetch(`/api/conversations/${conversationIdRef.current}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(analytics),
      });
    } catch (e) {
      console.error("Failed to send analytics:", e);
    }
  };

  const extractOrderData = (text: string): OrderData | null => {
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      try {
        const data = JSON.parse(jsonMatch[1]);
        if (data.order_confirmed) return data;
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
          setPlacedOrder({ order_number: data.order.order_number, total });
          shouldAutoListenRef.current = false;

          // Mark conversation as converted
          if (conversationIdRef.current) {
            fetch(`/api/conversations/${conversationIdRef.current}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ converted: true, order_id: data.order.id }),
            }).catch((e) => console.error("Failed to mark conversion:", e));
          }
        }
      } catch (error) {
        console.error("Failed to submit order:", error);
      }
    },
    [orderPlaced]
  );

  // ─── TTS ──────────────────────────────────────────────────────
  const speakText = useCallback(
    async (text: string): Promise<void> => {
      if (!isVoiceModeRef.current) return;

      const cleanText = text
        .replace(/```json[\s\S]*?(```|$)/g, "")
        .replace(/```cart[\s\S]*?(```|$)/g, "")
        .replace(/```analytics[\s\S]*?(```|$)/g, "")
        .replace(/[*_`#]/g, "")
        .replace(/\n{2,}/g, " ")
        .trim();
      if (!cleanText) return;

      // Truncate very long text to avoid ElevenLabs limits
      const speakableText = cleanText.length > 500 ? cleanText.slice(0, 500) + "..." : cleanText;

      setIsSpeaking(true);

      return new Promise<void>(async (resolve) => {
        const finish = () => {
          setIsSpeaking(false);
          resolve();
        };

        // Timeout safety — if TTS doesn't finish in 30s, force finish
        const timeout = setTimeout(finish, 30000);
        const finishClean = () => {
          clearTimeout(timeout);
          finish();
        };

        try {
          const res = await fetch("/api/synthesize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: speakableText }),
          });

          const contentType = res.headers.get("content-type");

          if (contentType?.includes("audio/mpeg")) {
            const audioBlob = await res.blob();
            if (audioBlob.size < 100) {
              // Empty or invalid audio — skip
              finishClean();
              return;
            }
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            audio.onended = () => {
              URL.revokeObjectURL(audioUrl);
              finishClean();
            };
            audio.onerror = () => {
              URL.revokeObjectURL(audioUrl);
              finishClean();
            };
            try {
              await audio.play();
            } catch (playErr) {
              console.warn("Audio play failed (autoplay policy?):", playErr);
              URL.revokeObjectURL(audioUrl);
              finishClean();
            }
          } else {
            // ElevenLabs unavailable — use browser TTS fallback
            if ("speechSynthesis" in window) {
              window.speechSynthesis.cancel(); // clear any stuck queue
              const utterance = new SpeechSynthesisUtterance(speakableText);
              utterance.rate = 1.0;
              utterance.onend = finishClean;
              utterance.onerror = finishClean;
              window.speechSynthesis.speak(utterance);
            } else {
              finishClean();
            }
          }
        } catch {
          // Network error — try browser TTS
          if ("speechSynthesis" in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(speakableText);
            utterance.onend = finishClean;
            utterance.onerror = finishClean;
            window.speechSynthesis.speak(utterance);
          } else {
            finishClean();
          }
        }
      });
    },
    []
  );

  // ─── Live Transcript Preview ──────────────────────────────────
  const startLivePreview = () => {
    try {
      const SpeechRecognitionAPI =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognitionAPI) return;

      const recognition = new SpeechRecognitionAPI();
      recognition.lang = "en-US";
      recognition.interimResults = true;
      recognition.continuous = false;

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let transcript = "";
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setLiveTranscript(transcript);
      };

      recognition.onend = () => {
        if (isRecordingRef.current) {
          try {
            recognition.start();
          } catch {
            /* ignore */
          }
        }
      };

      recognition.onerror = () => {};

      speechRecognitionRef.current = recognition;
      recognition.start();
    } catch {
      /* live preview not available */
    }
  };

  const stopLivePreview = () => {
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.onend = null;
        speechRecognitionRef.current.stop();
      } catch {
        /* ignore */
      }
      speechRecognitionRef.current = null;
    }
    // Don't clear liveTranscript here — keep it visible during transcription
  };

  // ─── Silence Detection ────────────────────────────────────────
  const startSilenceDetection = (stream: MediaStream) => {
    try {
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      const dataArray = new Float32Array(analyser.frequencyBinCount);
      let silentSince: number | null = null;

      const checkSilence = () => {
        if (!isRecordingRef.current) return;

        analyser.getFloatTimeDomainData(dataArray);

        // Calculate RMS volume
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sum / dataArray.length);

        if (rms < SILENCE_THRESHOLD) {
          if (silentSince === null) {
            silentSince = Date.now();
          } else if (Date.now() - silentSince > SILENCE_DURATION) {
            // Silence detected — auto-stop
            stopRecording();
            return;
          }
        } else {
          silentSince = null;
        }

        silenceCheckRef.current = requestAnimationFrame(checkSilence);
      };

      silenceCheckRef.current = requestAnimationFrame(checkSilence);
    } catch {
      /* silence detection not available */
    }
  };

  const stopSilenceDetection = () => {
    if (silenceCheckRef.current) {
      cancelAnimationFrame(silenceCheckRef.current);
      silenceCheckRef.current = null;
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
  };

  // ─── Recording ────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    if (isRecordingRef.current || isLoadingRef.current || isTranscribingRef.current) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        stopSilenceDetection();
        stopLivePreview();

        const audioBlob = new Blob(audioChunksRef.current, {
          type: mediaRecorder.mimeType || "audio/webm",
        });

        console.log("Audio blob size:", audioBlob.size, "bytes, chunks:", audioChunksRef.current.length);

        // Only transcribe if we have meaningful audio (> 500 bytes)
        if (audioBlob.size < 500) {
          console.log("Audio too small, skipping transcription");
          setLiveTranscript("");
          return;
        }

        setIsTranscribing(true);
        try {
          const formData = new FormData();
          formData.append("audio", audioBlob, "recording.webm");

          const res = await fetch("/api/transcribe", {
            method: "POST",
            body: formData,
          });
          const data = await res.json();
          console.log("Transcription result:", data);

          if (data.text && data.text.trim()) {
            setLiveTranscript("");
            sendMessage(data.text.trim());
          } else {
            setLiveTranscript("");
            setIsTranscribing(false);
          }
        } catch (error) {
          console.error("Transcription failed:", error);
          setLiveTranscript("");
          setIsTranscribing(false);
        }
      };

      mediaRecorder.start(250); // collect data every 250ms for reliability
      setIsRecording(true);

      // Start silence detection and live preview
      startSilenceDetection(stream);
      startLivePreview();
    } catch (error) {
      console.error("Failed to start recording:", error);
      alert(
        "Microphone access is required for voice ordering. Please allow microphone access and try again."
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecordingRef.current) {
      stopSilenceDetection();
      stopLivePreview();
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, []);

  // ─── Send Message ─────────────────────────────────────────────
  const messagesRef = useRef<Message[]>([]);
  const isSendingRef = useRef(false); // lock to prevent concurrent sends
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const sendMessage = useCallback(
    (text: string) => {
      if (!text.trim() || isSendingRef.current) return;

      setIsTranscribing(false);

      const userMessage: Message = {
        id: uuidv4(),
        role: "user",
        content: text.trim(),
        timestamp: new Date(),
      };

      const updated = [...messagesRef.current, userMessage];
      setMessages(updated);
      setInput("");
      sendToAPI(updated);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const sendToAPI = async (allMessages: Message[]) => {
    if (isSendingRef.current) return; // prevent double calls
    isSendingRef.current = true;
    setIsLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: allMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const data = await res.json();

      if (data.error) {
        // Show a transient error toast — do NOT add to messages array
        // (adding errors to messages wastes tokens on the next request)
        setErrorToast(
          data.isRateLimit
            ? "Give me just a moment... Please try again."
            : "Something went wrong. Please try again."
        );
        setTimeout(() => setErrorToast(null), 4000);

        // Remove the user's last message so it can be re-sent cleanly
        setMessages((prev) => prev.slice(0, -1));

        // Do NOT auto-listen on errors — let the user manually retry
        return;
      }

      const assistantMessage: Message = {
        id: uuidv4(),
        role: "assistant",
        content: data.message,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Update live cart
      const cartData = extractCartData(data.message);
      if (cartData) {
        setCartItems(cartData);
        if (cartData.length > 0) setIsCartOpen(true);
      }

      // Track analytics events (off-menu, upsells)
      const analytics = extractAnalytics(data.message);
      if (analytics) {
        sendAnalytics(analytics);
      }

      // Check for order confirmation
      const orderData = extractOrderData(data.message);
      if (orderData) {
        submitOrder(orderData);
      }

      // Speak the response (no auto-listen — customer taps mic to speak)
      await speakText(data.message);
    } catch (error) {
      console.error("Failed to send message:", error);
      // Show transient error — don't pollute message history
      setErrorToast("Connection error. Please try again.");
      setTimeout(() => setErrorToast(null), 4000);
      // Remove the user's last message so it can be re-sent
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      isSendingRef.current = false;
      setIsLoading(false);
    }
  };

  // ─── Start / Cancel Order ─────────────────────────────────────
  const handleStartOrder = async (voice: boolean) => {
    setOrderStarted(true);
    setIsVoiceMode(voice);
    shouldAutoListenRef.current = false;

    // Create a conversation record for analytics
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: uuidv4() }),
      });
      const data = await res.json();
      if (data.conversation?.id) {
        conversationIdRef.current = data.conversation.id;
      }
    } catch (e) {
      console.error("Failed to create conversation:", e);
    }

    const greeting: Message = {
      id: uuidv4(),
      role: "assistant",
      content:
        "Hey there! What would you like?",
      timestamp: new Date(),
    };
    setMessages([greeting]);

    if (voice) {
      // Speak greeting (customer taps mic to respond)
      speakText(greeting.content);
    }
  };

  const handleCancelOrder = () => {
    shouldAutoListenRef.current = false;
    stopRecording();
    if (isSpeaking) {
      window.speechSynthesis?.cancel();
      setIsSpeaking(false);
    }
    setOrderStarted(false);
    setOrderPlaced(false);
    setPlacedOrder(null);
    setMessages([]);
    setInput("");
    setIsLoading(false);
    setIsTranscribing(false);
    setIsRecording(false);
    setLiveTranscript("");
    setCartItems([]);
    setIsCartOpen(false);
    conversationIdRef.current = null;
  };

  const handleNewOrder = () => {
    setOrderPlaced(false);
    setPlacedOrder(null);
    setMessages([]);
    setCartItems([]);
    setIsCartOpen(false);
    handleStartOrder(isVoiceMode);
  };

  // ─── Message Formatting ───────────────────────────────────────
  const formatMessageContent = (content: string) => {
    const cleanContent = content
      .replace(/```json[\s\S]*?(```|$)/g, "")
      .replace(/```cart[\s\S]*?(```|$)/g, "")
      .replace(/```analytics[\s\S]*?(```|$)/g, "")
      .trim();

    // Check if this message has an order confirmation — render as receipt
    const orderData = extractOrderData(content);
    if (orderData) {
      const subtotal = orderData.items.reduce(
        (sum, item) => sum + item.totalPrice * item.quantity,
        0
      );
      const tax = Math.round(subtotal * 0.08875 * 100) / 100;
      const total = Math.round((subtotal + tax) * 100) / 100;

      // Extract the conversational text (before bullet points / order summary)
      const conversationalText = cleanContent
        .split("\n")
        .filter((line) => !line.trim().startsWith("*") && !line.trim().startsWith("-") && !line.trim().match(/^(Subtotal|Tax|Total|Here|Your order)/i))
        .join("\n")
        .trim();

      return (
        <div>
          {/* Conversational text before receipt */}
          {conversationalText && (
            <p className="mb-3">{conversationalText}</p>
          )}

          {/* Receipt */}
          <div className="bg-[#faf8f5] border border-dashed border-coffee-200 rounded-xl px-4 py-4 mt-1 font-mono text-xs">
            {/* Receipt header */}
            <div className="text-center mb-3 pb-2 border-b border-dotted border-coffee-300">
              <p className="font-bold text-sm text-coffee-900 tracking-wide">JON&apos;S COFFEE</p>
              <p className="text-coffee-400 text-[10px] mt-0.5">512 W 43rd St, New York, NY</p>
            </div>

            {/* Items */}
            <div className="space-y-2 mb-3">
              {orderData.items.map((item, idx) => (
                <div key={idx}>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <span className="text-coffee-900 font-medium">
                        {item.quantity}x {item.size ? `${item.size} ` : ""}{item.temperature ? `${item.temperature} ` : ""}{item.name}
                      </span>
                    </div>
                    <span className="text-coffee-700 ml-2">${item.basePrice.toFixed(2)}</span>
                  </div>
                  {/* Customizations */}
                  {item.milk && item.milk !== "Whole Milk" && (
                    <div className="flex justify-between text-coffee-400 pl-3">
                      <span>{item.milk}</span>
                      {item.modificationsPrice > 0 && <span>+${item.modificationsPrice.toFixed(2)}</span>}
                    </div>
                  )}
                  {item.modifications && item.modifications.length > 0 && item.modifications.map((mod, modIdx) => (
                    <div key={modIdx} className="text-coffee-400 pl-3">
                      <span>{mod}</span>
                    </div>
                  ))}
                  {item.iceLevel && item.iceLevel !== "Regular" && (
                    <div className="text-coffee-400 pl-3">{item.iceLevel}</div>
                  )}
                  {item.sweetness && item.sweetness !== "Regular" && (
                    <div className="text-coffee-400 pl-3">{item.sweetness}</div>
                  )}
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="border-t border-dotted border-coffee-300 pt-2 space-y-1">
              <div className="flex justify-between text-coffee-600">
                <span>Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-coffee-400">
                <span>Tax (8.875%)</span>
                <span>${tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-coffee-900 font-bold text-sm border-t border-dotted border-coffee-300 pt-1 mt-1">
                <span>TOTAL</span>
                <span>${total.toFixed(2)}</span>
              </div>
            </div>

            {/* Receipt footer */}
            <div className="text-center mt-3 pt-2 border-t border-dotted border-coffee-300">
              <p className="text-coffee-400 text-[10px]">Thank you for visiting!</p>
            </div>
          </div>
        </div>
      );
    }

    // Regular message — render with rich formatting
    const lines = cleanContent.split("\n").filter((l) => l.trim());

    return (
      <div className="space-y-2">
        {lines.map((line, i) => {
          const trimmed = line.trim();

          // Detect questions — highlight them
          const isQuestion = /\?[\s]*$/.test(trimmed);

          // Detect bullet points (*, -, •, numbered)
          const bulletMatch = trimmed.match(/^([*\-•]|\d+[.)]\s)/);
          const isBullet = !!bulletMatch;
          const bulletContent = isBullet
            ? trimmed.replace(/^([*\-•]|\d+[.)]\s)\s*/, "")
            : trimmed;

          // Apply inline formatting: **bold**, menu items, prices
          let formatted = (isBullet ? bulletContent : trimmed)
            .replace(/\*\*(.*?)\*\*/g, '<strong class="text-coffee-800">$1</strong>')
            .replace(
              /(\$\d+\.?\d*)/g,
              '<span class="font-semibold text-coffee-700">$1</span>'
            );

          // Options in parentheses like (Small/Large) or (Hot/Iced)
          formatted = formatted.replace(
            /\(([^)]*\/[^)]*)\)/g,
            '(<span class="font-medium text-coffee-600">$1</span>)'
          );

          if (isBullet) {
            return (
              <div key={i} className="flex items-start gap-2 pl-1">
                <span className="text-coffee-400 mt-0.5 text-xs">•</span>
                <span
                  dangerouslySetInnerHTML={{ __html: formatted }}
                  className="flex-1"
                />
              </div>
            );
          }

          if (isQuestion) {
            return (
              <div
                key={i}
                className="bg-coffee-50 border-l-2 border-coffee-400 rounded-r-lg px-3 py-1.5 mt-1"
              >
                <span
                  dangerouslySetInnerHTML={{ __html: formatted }}
                  className="font-medium text-coffee-900"
                />
              </div>
            );
          }

          return (
            <span
              key={i}
              dangerouslySetInnerHTML={{ __html: formatted }}
              className="block"
            />
          );
        })}
      </div>
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (isRecording) stopRecording();
      sendMessage(input);
    }
  };

  // ─── Cleanup on unmount ───────────────────────────────────────
  useEffect(() => {
    return () => {
      shouldAutoListenRef.current = false;
      stopSilenceDetection();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // ═════════════════════════════════════════════════════════════
  // ─── RENDER: Start Order Screen ────────────────────────────
  // ═════════════════════════════════════════════════════════════
  if (!orderStarted) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-coffee-50 via-white to-amber-50">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-sm border-b border-coffee-100 px-4 py-3">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <div className="w-20" />
            <div className="text-center">
              <h1 className="text-lg font-bold text-coffee-900">Jon&apos;s Coffee</h1>
              <p className="text-xs text-coffee-400">512 W 43rd St, New York, NY</p>
            </div>
            <div className="w-20" />
          </div>
        </header>

        {/* Main content */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-8">
          <div className="text-center">
            <div className="text-7xl mb-4">☕</div>
            <h2 className="text-2xl font-bold text-coffee-900 mb-2">
              Ready to Order?
            </h2>
            <p className="text-sm text-coffee-500 max-w-xs">
              Talk to Jo, our AI barista, to place your order
            </p>
          </div>

          <div className="flex flex-col items-center gap-4 w-full max-w-xs">
            <button
              onClick={() => handleStartOrder(true)}
              className="w-full bg-coffee-600 text-white py-4 rounded-2xl text-base font-semibold hover:bg-coffee-700 active:scale-[0.98] transition-all flex items-center justify-center gap-3 shadow-lg shadow-coffee-200"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              Start Order
            </button>
            <button
              onClick={() => handleStartOrder(false)}
              className="text-sm text-coffee-400 hover:text-coffee-600 transition-colors underline underline-offset-2"
            >
              Prefer to type instead?
            </button>
          </div>
        </div>

        {/* Staff Links */}
        <div className="border-t border-coffee-100 bg-white/60 px-4 py-4">
          <div className="max-w-sm mx-auto flex gap-3">
            <Link
              href="/barista"
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-600 hover:border-emerald-300 hover:text-emerald-700 transition-all"
            >
              <span>🧑‍🍳</span>
              Barista Queue
            </Link>
            <Link
              href="/owner"
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-600 hover:border-blue-300 hover:text-blue-700 transition-all"
            >
              <span>📊</span>
              Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════
  // ─── RENDER: Chat Interface ────────────────────────────────
  // ═════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-coffee-50 via-white to-amber-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-coffee-100 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <button
          onClick={handleCancelOrder}
          className="flex items-center gap-1.5 text-red-500 hover:text-red-700 transition-colors text-sm font-medium"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Cancel
        </button>

        <div className="text-center">
          <h1 className="text-lg font-bold text-coffee-900">Jon&apos;s Coffee</h1>
          <p className="text-xs text-coffee-400">AI Voice Cashier</p>
        </div>

        {/* Voice / Text mode toggle */}
        <button
          onClick={() => {
            const newMode = !isVoiceMode;
            setIsVoiceMode(newMode);
            shouldAutoListenRef.current = newMode;
            if (!newMode) {
              // Switching to text — stop recording
              stopRecording();
              if (isSpeaking) {
                window.speechSynthesis?.cancel();
                setIsSpeaking(false);
              }
            } else if (!isLoading && !isTranscribing && !isRecording && !isSpeaking && !orderPlaced) {
              // Switching to voice — start listening
              setTimeout(() => startRecording(), 300);
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
              Voice
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

      {/* Error Toast */}
      {errorToast && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 animate-fade-in-up">
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-xl shadow-lg flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            {errorToast}
          </div>
        </div>
      )}

      {/* Chat Messages */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto px-4 py-6 space-y-4 max-w-2xl mx-auto w-full"
      >
        {messages.map((message) => {
          const hasReceipt = message.role === "assistant" && !!extractOrderData(message.content);
          return (
          <div
            key={message.id}
            className={`animate-fade-in-up flex ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`rounded-2xl px-4 py-3 ${
                hasReceipt ? "max-w-[95%] sm:max-w-[90%]" : "max-w-[85%]"
              } ${
                message.role === "user"
                  ? "bg-coffee-600 text-white rounded-br-md"
                  : "bg-white border border-coffee-100 text-gray-800 rounded-bl-md shadow-sm"
              }`}
            >
              {message.role === "assistant" && (
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-xs font-semibold text-coffee-600">Jo</span>
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
          );
        })}

        {/* Typing / Processing indicators */}
        {isLoading && (
          <div className="flex justify-start animate-fade-in-up">
            <div className="bg-white border border-coffee-100 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-xs font-semibold text-coffee-600">Jo</span>
              </div>
              <div className="flex gap-1 py-1">
                <span className="typing-dot"></span>
                <span className="typing-dot"></span>
                <span className="typing-dot"></span>
              </div>
            </div>
          </div>
        )}

        {/* Order Confirmation */}
        {orderPlaced && placedOrder && (
          <div className="animate-fade-in-up flex justify-center">
            <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl px-6 py-4 text-center max-w-sm">
              <div className="text-3xl mb-2">✅</div>
              <h3 className="font-bold text-emerald-800 text-lg">Order Placed!</h3>
              <p className="text-emerald-600 text-sm mt-1">
                Order #{placedOrder.order_number}
              </p>
              <p className="text-emerald-700 font-semibold mt-1">
                Total: ${placedOrder.total.toFixed(2)}
              </p>
              <p className="text-xs text-emerald-500 mt-2">
                Your order has been sent to the barista!
              </p>
              <div className="flex gap-2 mt-3 justify-center">
                <button
                  onClick={handleNewOrder}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
                >
                  New Order
                </button>
                <button
                  onClick={handleCancelOrder}
                  className="px-4 py-2 bg-white text-gray-600 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ─── Live Cart ─────────────────────────────────────────── */}
      {cartItems.length > 0 && !orderPlaced && (
        <>
          {/* Floating cart button */}
          {!isCartOpen && (
            <div className="flex justify-center pb-2">
              <button
                onClick={() => setIsCartOpen(true)}
                className="flex items-center gap-2 bg-coffee-600 text-white px-4 py-2 rounded-full shadow-lg hover:bg-coffee-700 active:scale-95 transition-all animate-fade-in-up"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
                </svg>
                <span className="text-sm font-medium">
                  {cartItems.reduce((sum, item) => sum + item.quantity, 0)} item{cartItems.reduce((sum, item) => sum + item.quantity, 0) !== 1 ? "s" : ""}
                </span>
                <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
                  ${cartItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0).toFixed(2)}
                </span>
              </button>
            </div>
          )}

          {/* Cart panel */}
          {isCartOpen && (
            <div className="border-t border-coffee-100 bg-white/95 backdrop-blur-sm animate-fade-in-up">
              <div className="max-w-2xl mx-auto px-4 py-3">
                {/* Cart header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-coffee-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
                    </svg>
                    <h3 className="text-sm font-bold text-coffee-900">Your Order</h3>
                  </div>
                  <button
                    onClick={() => setIsCartOpen(false)}
                    className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>

                {/* Cart items */}
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {cartItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-start justify-between bg-coffee-50 rounded-xl px-3 py-2"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-coffee-900 truncate">
                            {item.name}
                          </span>
                          {item.quantity > 1 && (
                            <span className="text-xs bg-coffee-200 text-coffee-700 px-1.5 py-0.5 rounded-full font-medium">
                              x{item.quantity}
                            </span>
                          )}
                        </div>
                        {item.size && (
                          <span className="text-xs text-coffee-500">{item.size}</span>
                        )}
                        {item.notes && (
                          <p className="text-xs text-coffee-400 mt-0.5 truncate">{item.notes}</p>
                        )}
                      </div>
                      <span className="text-sm font-semibold text-coffee-800 ml-3 whitespace-nowrap">
                        ${(item.unitPrice * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Cart total */}
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-coffee-100">
                  <span className="text-xs text-coffee-500">
                    Subtotal ({cartItems.reduce((sum, item) => sum + item.quantity, 0)} item{cartItems.reduce((sum, item) => sum + item.quantity, 0) !== 1 ? "s" : ""})
                  </span>
                  <span className="text-sm font-bold text-coffee-900">
                    ${cartItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0).toFixed(2)}
                  </span>
                </div>
                <p className="text-[10px] text-coffee-300 mt-1">Tax calculated at checkout (8.875%)</p>
              </div>
            </div>
          )}
        </>
      )}

      {/* Voice Status Bar */}
      {isVoiceMode && !orderPlaced && (
        <div className="flex justify-center pb-1">
          {isRecording && (
            <div className="flex flex-col items-center gap-1 px-4">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-xs text-red-600 font-medium">Listening...</span>
              </div>
              {liveTranscript && (
                <p className="text-sm text-gray-500 italic text-center max-w-xs">
                  &ldquo;{liveTranscript}&rdquo;
                </p>
              )}
              <p className="text-[11px] text-gray-400 mt-0.5">
                Tap the mic button when you&apos;re done speaking
              </p>
            </div>
          )}
          {isTranscribing && (
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 border-2 border-coffee-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-coffee-600 font-medium">Transcribing...</span>
              </div>
              {liveTranscript && (
                <p className="text-sm text-gray-500 italic text-center max-w-xs">
                  &ldquo;{liveTranscript}&rdquo;
                </p>
              )}
            </div>
          )}
          {isSpeaking && (
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
              <span className="text-xs text-coffee-600 font-medium">Jo is speaking...</span>
            </div>
          )}
          {!isRecording && !isTranscribing && !isSpeaking && !isLoading && (
            <span className="text-xs text-gray-400">Tap the mic button to speak</span>
          )}
        </div>
      )}

      {/* Input Area */}
      {!orderPlaced && (
        <div className="border-t border-coffee-100 bg-white/80 backdrop-blur-sm px-4 py-3">
          <div className="max-w-2xl mx-auto flex flex-col items-center gap-2">
            {/* Primary: Large mic button */}
            <button
              onClick={() => {
                if (isRecording) {
                  stopRecording();
                } else {
                  setIsVoiceMode(true);
                  startRecording();
                }
              }}
              disabled={isLoading || isTranscribing || isSpeaking}
              className={`w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-lg ${
                isRecording
                  ? "bg-red-500 recording-pulse shadow-red-200"
                  : isLoading || isTranscribing || isSpeaking
                    ? "bg-gray-200 cursor-not-allowed shadow-none"
                    : "bg-coffee-600 hover:bg-coffee-700 active:scale-95 shadow-coffee-200"
              }`}
              title={isRecording ? "Stop listening" : "Tap to speak"}
            >
              {isRecording ? (
                <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              ) : (
                <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              )}
            </button>
            {!isRecording && !isLoading && !isTranscribing && !isSpeaking && (
              <span className="text-xs text-coffee-400 font-medium">Tap to speak</span>
            )}

            {/* Secondary: Text input row */}
            <div className="flex gap-2 items-center w-full">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isRecording ? "Or type here instead..." : "Or type your order..."}
                className="flex-1 bg-coffee-50 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-coffee-300 placeholder-coffee-300"
                disabled={isLoading}
                onFocus={() => {
                  if (isRecording) {
                    stopRecording();
                    setIsVoiceMode(false);
                  }
                }}
              />
              <button
                onClick={() => {
                  if (isRecording) stopRecording();
                  sendMessage(input);
                }}
                disabled={!input.trim() || isLoading}
                className="flex-shrink-0 bg-coffee-600 text-white rounded-xl w-10 h-10 flex items-center justify-center hover:bg-coffee-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
