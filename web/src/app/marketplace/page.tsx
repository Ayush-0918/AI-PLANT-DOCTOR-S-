'use client';

import {
  Search, ShoppingCart, Filter, Star,
  ShieldCheck, Calculator, Calendar, Clock,
  Tractor, Sprout, Tent, Package, ArrowUpRight,
  User, Phone, MapPin, CheckCircle2, Loader2,
  MessageCircle, X, ChevronRight, Sparkles,
  CreditCard, QrCode, Truck, Mail, Check, Copy, ShieldAlert,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { type ReactNode, useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { fetchJson, getBackendBaseUrl } from '@/lib/api';

// ─── Types ─────────────────────────────────────────────────
type StoreResponse = { success: boolean; products: Product[]; total: number };

type Product = {
  id: string | number;
  title: string;
  description?: string;
  price: string;
  category: string;
  rating: number;
  reviews?: number;
  seller?: string;
  sellerBadge?: string;
  image?: string;
  stock?: number;
};

type PaymentMethod = 'razorpay' | 'upi_qr' | 'cod';

type OrderForm = {
  buyer_name: string;
  buyer_phone: string;
  buyer_email: string;
  buyer_address: string;
  quantity: number;
  rental_days: number;
};

type OrderResult = {
  success: boolean;
  order_id: string;
  message: string;
  whatsapp_url: string;
  razorpay_order_id?: string;
  razorpay_key?: string;
  email_sent?: boolean;
  email_message?: string;
  email_error?: string;
  email_recipient?: string;
};

// ─── Category Icon Map ─────────────────────────────────────
const CATEGORY_ICONS: Record<string, { color: string; bg: string; border: string; icon: React.ComponentType<{ size?: number; className?: string }> }> = {
  Pesticides: { color: '#22c55e', bg: 'rgba(34,197,94,0.1)',   border: 'rgba(34,197,94,0.2)',   icon: Sprout },
  Medicines:  { color: '#22c55e', bg: 'rgba(34,197,94,0.1)',   border: 'rgba(34,197,94,0.2)',   icon: Sprout },
  Machines:   { color: '#a78bfa', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.2)', icon: Tractor },
  Seeds:      { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.2)',  icon: Package },
  Rental:     { color: '#60a5fa', bg: 'rgba(96,165,250,0.1)',  border: 'rgba(96,165,250,0.2)',  icon: Tent },
};

// ─── Main Page ─────────────────────────────────────────────
export default function MarketplacePage() {
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  const [activeCategory, setActiveCategory] = useState(searchParams.get('category') || 'All');
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Checkout state
  const [checkoutProduct, setCheckoutProduct] = useState<Product | null>(null);
  const [checkoutType, setCheckoutType] = useState<'buy' | 'rent'>('buy');
  const [checkoutStep, setCheckoutStep] = useState<'form' | 'payment' | 'review' | 'success'>('form');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('upi_qr');
  const [orderResult, setOrderResult] = useState<OrderResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [retryingEmail, setRetryingEmail] = useState(false);
  const [form, setForm] = useState<OrderForm>({
    buyer_name: 'Ayush Pandey', buyer_phone: '', buyer_email: 'rdxayushpandey00@gmail.com',
    buyer_address: '', quantity: 1, rental_days: 1,
  });

  const handleRetryEmail = async () => {
    if (!orderResult?.order_id) return;
    setRetryingEmail(true);
    try {
      const res = await fetchJson<{ success: boolean; email_sent: boolean; error?: string; message?: string }>(
        `${getBackendBaseUrl()}/api/v1/store/orders/${orderResult.order_id}/send-confirmation`,
        { method: 'POST' }
      );
      if (res?.success && res.email_sent) {
        setOrderResult((prev) => prev ? { ...prev, email_sent: true, email_error: undefined } : prev);
        if (navigator.vibrate) navigator.vibrate([40, 40, 40]);
      } else {
        alert(res?.error || 'Email dispatch failed. Please check RESEND_API_KEY configuration.');
      }
    } catch (err) {
      console.error('Retry email error:', err);
      alert('Failed to connect to backend for email retry.');
    } finally {
      setRetryingEmail(false);
    }
  };

  // EMI modal
  const [showEMI, setShowEMI] = useState<Product | null>(null);
  const [downpayment, setDownpayment] = useState(25);
  const [locating, setLocating] = useState(false);

  // Auto-fetch GPS / Weather location
  const fetchLiveLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setLocating(true);
    if (navigator.vibrate) navigator.vibrate(10);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(`https://api.openweathermap.org/geo/1.0/reverse?lat=${latitude}&lon=${longitude}&limit=1&appid=ee37771dec6a5fe27bafe4d99267a908`);
          const data = await res.json();
          if (data && data[0]) {
            const locName = `${data[0].name}, ${data[0].state || ''}, ${data[0].country || 'India'}`;
            setForm((f) => ({ ...f, buyer_address: locName }));
          } else {
            setForm((f) => ({ ...f, buyer_address: `Lat: ${latitude.toFixed(4)}, Lon: ${longitude.toFixed(4)} (GPS)` }));
          }
        } catch (e) {
          console.error("Location error:", e);
          setForm((f) => ({ ...f, buyer_address: "Jalandhar, Punjab, India (GPS Location)" }));
        } finally {
          setLocating(false);
        }
      },
      (err) => {
        console.warn("Geo error:", err);
        setForm((f) => ({ ...f, buyer_address: "Jalandhar, Punjab, India (GPS Location)" }));
        setLocating(false);
      }
    );
  };

  // ─── Fetch Products ──────────────────────────────────────
  useEffect(() => {
    async function fetchProducts() {
      try {
        const query = new URLSearchParams();
        if (activeCategory !== 'All') query.append('category', activeCategory);
        if (searchQuery) query.append('search', searchQuery);
        const data = await fetchJson<StoreResponse>(`${getBackendBaseUrl()}/api/v1/store/products?${query}`);
        if (data?.success) setProducts(data.products);
      } catch (e) {
        console.error('Store error:', e);
      } finally {
        setLoading(false);
      }
    }
    const id = setTimeout(fetchProducts, 300);
    return () => clearTimeout(id);
  }, [activeCategory, searchQuery]);

  // ─── Open Checkout ───────────────────────────────────────
  const openCheckout = (prod: Product, type: 'buy' | 'rent') => {
    if (navigator.vibrate) navigator.vibrate(15);
    setCheckoutProduct(prod);
    setCheckoutType(type);
    setCheckoutStep('form');
    setPaymentMethod('upi_qr');
    setOrderResult(null);
    setForm({ buyer_name: 'Ayush Pandey', buyer_phone: '', buyer_email: 'rdxayushpandey00@gmail.com', buyer_address: '', quantity: 1, rental_days: 1 });
  };

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const submitOrder = async () => {
    if (!checkoutProduct) return;
    if (!form.buyer_name.trim() || !form.buyer_phone.trim()) return;

    setSubmitting(true);
    try {
      const methodLabelMap: Record<PaymentMethod, string> = {
        razorpay: 'Razorpay Online (UPI/Cards)',
        upi_qr: 'UPI QR Code Pay (Demo)',
        cod: 'Cash on Delivery (COD)',
      };
      const methodStatusMap: Record<PaymentMethod, string> = {
        razorpay: 'Paid',
        upi_qr: 'Paid (UPI Demo)',
        cod: 'Pending (COD)',
      };

      const payload = {
        product_id: String(checkoutProduct.id),
        product_title: checkoutProduct.title,
        product_price: checkoutProduct.price,
        category: checkoutProduct.category,
        buyer_name: form.buyer_name.trim(),
        buyer_phone: form.buyer_phone.trim(),
        buyer_email: form.buyer_email.trim() || null,
        buyer_address: form.buyer_address.trim() || null,
        quantity: form.quantity,
        order_type: checkoutType,
        rental_days: checkoutType === 'rent' ? form.rental_days : null,
        payment_method: methodLabelMap[paymentMethod],
        payment_status: methodStatusMap[paymentMethod],
      };

      const result = await fetchJson<OrderResult>(`${getBackendBaseUrl()}/api/v1/store/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (result?.success) {
        if (paymentMethod === 'razorpay' && result.razorpay_order_id && result.razorpay_key) {
          const res = await loadRazorpayScript();
          if (!res) {
            alert('Razorpay Payment gateway failed to load. Falling back to Demo confirmation.');
            setOrderResult(result);
            setCheckoutStep('success');
            setSubmitting(false);
            return;
          }

          const options = {
            key: result.razorpay_key,
            currency: "INR",
            name: "Plant Doctors",
            description: checkoutProduct.title,
            order_id: result.razorpay_order_id,
            handler: function (response: Record<string, unknown>) {
               console.log("Razorpay Success:", response);
               setOrderResult(result);
               setCheckoutStep('success');
               if (navigator.vibrate) navigator.vibrate([50, 30, 80]);
               setSubmitting(false);
            },
            prefill: {
              name: form.buyer_name,
              email: form.buyer_email || "",
              contact: form.buyer_phone
            },
            theme: {
              color: "#16a34a"
            },
            modal: {
              ondismiss: function() {
                setSubmitting(false);
              }
            }
          };
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const paymentObject = new (window as any).Razorpay(options);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          paymentObject.on('payment.failed', function (response: any) {
               alert(`Payment Failed: ${response.error?.description || "Unknown error"}`);
               setSubmitting(false);
          });
          paymentObject.open();

        } else {
          // Dynamic UPI QR Code payment or Cash on Delivery or fallback
          setOrderResult(result);
          setCheckoutStep('success');
          if (navigator.vibrate) navigator.vibrate([50, 30, 80]);
          setSubmitting(false);
        }
      } else {
        setSubmitting(false);
      }
    } catch (e) {
      console.error('Order error:', e);
      setSubmitting(false);
    }
  };

  const closeCheckout = () => setCheckoutProduct(null);
  const categories = [
    { key: 'All',        label: t('shop_cat_all') },
    { key: 'Pesticides', label: t('shop_cat_pesticides') },
    { key: 'Machines',   label: t('shop_cat_machines') },
    { key: 'Seeds',      label: t('shop_cat_seeds') },
    { key: 'Rental',     label: t('shop_cat_rental') },
  ];

  // Badge translation helper
  const tBadge = (badge: string) => {
    const map: Record<string, string> = {
      'Verified': t('shop_badge_verified'),
      'Premium': t('shop_badge_premium'),
      'Eco': t('shop_badge_eco'),
      'Official': t('shop_badge_official'),
      'Trusted': t('shop_badge_trusted'),
      'Top Rated': t('shop_badge_top_rated'),
      'New Seller': t('shop_badge_new_seller'),
    };
    return map[badge] || badge;
  };

  return (
    <div className="min-h-full bg-[#f8fafc] dark:bg-slate-950 pb-6 sm:pb-8">

      {/* ── HEADER ── */}
      <div
        className="sticky top-0 z-40 px-4 pt-4 pb-3 space-y-3 bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-slate-200/60 dark:border-slate-800 shadow-sm"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{t('shop_title')}</h1>
            <p className="text-[11px] text-slate-400 dark:text-slate-400 font-semibold mt-0.5">{t('shop_subtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/marketplace/sell"
              className="px-3.5 py-2 rounded-2xl font-black text-xs haptic-btn bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 shadow-sm"
            >
              {t('shop_sell_btn')}
            </Link>
            <Link
              href="/community"
              className="flex items-center gap-2 px-3.5 py-2 rounded-2xl haptic-btn bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-400"
            >
              <ShieldCheck size={13} className="text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs font-black text-emerald-700 dark:text-emerald-300">{t('shop_expert_btn')}</span>
            </Link>
          </div>
        </div>

        {/* Search */}
        <div
          className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 shadow-sm"
        >
          <Search size={15} className="text-slate-400 dark:text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder={t('shop_search_ph')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-none font-medium"
          />
          <button
            className="h-7 w-7 rounded-xl flex items-center justify-center bg-slate-100"
          >
            <Filter size={12} className="text-slate-400" />
          </button>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-5">

        {/* ── HERO BENTO GRID ── */}
        <div className="grid grid-cols-2 gap-3">
          <motion.div
            whileTap={{ scale: 0.96 }}
            onClick={() => { if (navigator.vibrate) navigator.vibrate(12); setActiveCategory('Machines'); }}
            className="relative rounded-3xl p-5 overflow-hidden cursor-pointer haptic-btn"
            style={{
              background: 'linear-gradient(135deg, rgba(139,92,246,0.15) 0%, rgba(109,40,217,0.05) 100%)',
              border: '1px solid rgba(139,92,246,0.2)',
            }}
          >
            <div className="absolute -right-4 -bottom-4 opacity-30"><Tractor size={90} className="text-violet-400" /></div>
            <p className="text-[9px] font-black text-violet-600 uppercase tracking-widest relative z-10">{t('shop_heavy')}</p>
            <h3 className="text-2xl font-black text-violet-900 mt-1 relative z-10">{t('shop_cat_machines')}</h3>
            <p className="text-xs text-violet-700 mt-1 relative z-10">{t('shop_tractors_more')}</p>
          </motion.div>

          <div className="flex flex-col gap-3">
            {[
              { cat: 'Pesticides', label: t('shop_cat_pesticides'), icon: Sprout, color: '#16a34a', bg: 'rgba(34,197,94,0.15)', border: 'rgba(34,197,94,0.25)', text: '#14532d' },
              { cat: 'Rental',     label: t('shop_cat_rental'),    icon: Tent,   color: '#2563eb', bg: 'rgba(96,165,250,0.15)', border: 'rgba(96,165,250,0.25)', text: '#1e3a8a' },
            ].map(({ cat, label, icon: Icon, color, bg, border, text }) => (
              <motion.div
                key={cat}
                whileTap={{ scale: 0.94 }}
                onClick={() => { if (navigator.vibrate) navigator.vibrate(10); setActiveCategory(cat); }}
                className="relative rounded-2xl p-4 overflow-hidden cursor-pointer haptic-btn"
                style={{ background: bg, border: `1px solid ${border}` }}
              >
                <Icon size={20} style={{ color }} className="mb-1" />
                <p className="text-xs font-black relative z-10" style={{ color: text }}>{label}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ── CATEGORY CHIPS ── */}
        <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
          {categories.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => { if (navigator.vibrate) navigator.vibrate(8); setActiveCategory(key); }}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-black tracking-wide transition-all duration-200 border whitespace-nowrap active:scale-95 ${
                activeCategory === key
                  ? 'border-transparent text-[#082032] shadow-[0_8px_24px_rgba(125,211,252,0.26)] bg-[linear-gradient(135deg,#e0f2fe_0%,#7dd3fc_100%)]'
                  : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── PRODUCTS LIST ── */}
        <div className="space-y-3">
          {loading && products.length === 0 ? (
            <div className="py-16 space-y-3">
              {[1,2,3].map(i => (
                <div key={i} className="h-28 rounded-2xl bg-white animate-pulse" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }} />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="py-16 text-center">
              <Package size={40} className="text-slate-300 mx-auto mb-3" />
              <p className="text-slate-400 font-black">No products found</p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {products.map((product, i) => {
                const catStyle = CATEGORY_ICONS[product.category] || { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.2)', icon: Package };
                const isRental = product.category === 'Rental';
                const isMachine = product.category === 'Machines';
                const CatIcon = catStyle.icon;

                return (
                  <motion.div
                    key={`${product.title}-${i}`}
                    layout
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: i * 0.04 }}
                    className="relative rounded-2xl p-4 flex gap-4 overflow-hidden bg-white"
                    style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.05)' }}
                  >
                    {/* Technical Icon / Real Image Container */}
                    <div
                      className="h-20 w-20 rounded-2xl shrink-0 overflow-hidden relative flex items-center justify-center shadow-inner group"
                      style={{ 
                        background: `linear-gradient(135deg, ${catStyle.color}15 0%, ${catStyle.color}05 100%)`, 
                        border: `1px solid ${catStyle.color}30` 
                      }}
                    >
                      {/* Tech Grid Background */}
                      <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)', backgroundSize: '8px 8px', color: catStyle.color }} />
                      
                      {/* Inner Glowing Orb */}
                      <div className="absolute h-12 w-12 blur-xl rounded-full translate-y-2" style={{ background: catStyle.color, opacity: 0.15 }} />
                      
                      {/* REAL PRODUCT IMAGE (Removed as per user request) */}

                      {/* Abstract Tech Icon Base (Fallback Visibility) */}
                      <div className="relative z-0 flex items-center justify-center p-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.7)', color: catStyle.color }}>
                         <CatIcon size={26} />
                      </div>
                    </div>

                    {/* Info */}
                    <div className="flex flex-col justify-between flex-1 min-w-0">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            {product.sellerBadge && (
                              <span
                                className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full mb-1 inline-block"
                                style={{ background: `${catStyle.color}15`, color: catStyle.color, border: `1px solid ${catStyle.color}25` }}
                              >
                                {tBadge(product.sellerBadge)}
                              </span>
                            )}
                            <h3 className="font-black text-slate-800 text-sm leading-tight">{product.title}</h3>
                          </div>
                          <div className="flex items-center gap-0.5 shrink-0">
                            <Star size={11} fill="#fbbf24" className="text-amber-400" />
                            <span className="text-[10px] font-black text-amber-500">{product.rating}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-slate-400 font-medium">{product.seller || t('shop_verified_seller')}</span>
                          {product.sellerBadge && (
                            <span
                              className="flex items-center gap-0.5 text-[9px] font-black px-1.5 py-0.5 rounded-full"
                              style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' }}
                            >
                              <ShieldCheck size={9} /> {t('shop_badge_verified')}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-2 pt-1">
                        <div>
                          <span className="text-lg font-black text-slate-900">{product.price}</span>
                          {isMachine && (
                            <span className="text-[9px] block font-extrabold text-slate-400 leading-tight">Buy & Rent available</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          {isMachine ? (
                            <>
                              <button
                                onClick={() => { if (navigator.vibrate) navigator.vibrate(12); setShowEMI(product); }}
                                className="h-9 w-9 rounded-xl flex items-center justify-center bg-violet-50 border border-violet-200/80 hover:bg-violet-100 transition-colors"
                                title="EMI Calculator"
                              >
                                <Calculator size={14} className="text-violet-600" />
                              </button>

                              <motion.button
                                whileTap={{ scale: 0.92 }}
                                onClick={() => openCheckout(product, 'buy')}
                                className="h-9 px-3 rounded-xl flex items-center gap-1 font-black text-[11px] text-white"
                                style={{ background: 'linear-gradient(135deg, #10b981, #059669)', boxShadow: '0 4px 12px rgba(16,185,129,0.25)' }}
                              >
                                <ShoppingCart size={12} className="text-white" />
                                <span>{t('shop_btn_buy')}</span>
                              </motion.button>

                              <motion.button
                                whileTap={{ scale: 0.92 }}
                                onClick={() => openCheckout(product, 'rent')}
                                className="h-9 px-3 rounded-xl flex items-center gap-1 font-black text-[11px] text-white"
                                style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)', boxShadow: '0 4px 12px rgba(59,130,246,0.25)' }}
                              >
                                <Clock size={12} className="text-white" />
                                <span>{t('shop_btn_rent')}</span>
                              </motion.button>
                            </>
                          ) : (
                            <motion.button
                              whileTap={{ scale: 0.9 }}
                              onClick={() => openCheckout(product, isRental ? 'rent' : 'buy')}
                              className="h-9 px-4 rounded-xl flex items-center gap-1.5 font-black text-xs text-white"
                              style={isRental
                                ? { background: 'linear-gradient(135deg, #3b82f6, #2563eb)', boxShadow: '0 4px 12px rgba(59,130,246,0.3)' }
                                : { background: 'linear-gradient(135deg, #10b981, #059669)', boxShadow: '0 4px 12px rgba(16,185,129,0.3)' }
                              }
                            >
                              {isRental ? <Clock size={13} className="text-white" /> : <ShoppingCart size={13} className="text-white" />}
                              <span>{isRental ? t('shop_btn_rent') : t('shop_btn_buy')}</span>
                            </motion.button>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* ── CHECKOUT MODAL (ULTRA-CLEAN & LIGHT) ── */}
      <AnimatePresence>
        {checkoutProduct && (
          <div className="fixed inset-0 z-[200] flex items-end justify-center">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={closeCheckout}
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-md"
            />

            {/* Sheet */}
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="relative w-full max-w-md bg-white rounded-t-[32px] shadow-2xl overflow-hidden border border-slate-100"
              style={{ maxHeight: '88vh', overflowY: 'auto' }}
            >
              <div className="p-6 pb-24 space-y-4">
                {/* Header handle & close */}
                <div className="flex items-center justify-between">
                  <div className="h-1.5 w-10 rounded-full bg-slate-200 mx-auto" />
                  <button onClick={closeCheckout} className="h-8 w-8 rounded-full flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors">
                    <X size={16} />
                  </button>
                </div>

                {/* Clean 3-Step Pill Bar */}
                <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl">
                  {[
                    { key: 'form', label: '1. Address' },
                    { key: 'payment', label: '2. Payment' },
                    { key: 'review', label: '3. Summary' },
                  ].map((s) => {
                    const stepOrder = ['form', 'payment', 'review', 'success'];
                    const currentIdx = stepOrder.indexOf(checkoutStep);
                    const thisIdx = stepOrder.indexOf(s.key);
                    const isActive = checkoutStep === s.key;
                    const isDone = currentIdx > thisIdx;
                    return (
                      <button
                        key={s.key}
                        onClick={() => {
                          if (navigator.vibrate) navigator.vibrate(8);
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          setCheckoutStep(s.key as any);
                        }}
                        className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all text-center ${
                          isActive
                            ? 'bg-white text-emerald-700 shadow-sm'
                            : isDone
                            ? 'text-emerald-600'
                            : 'text-slate-400'
                        }`}
                      >
                        {isDone ? '✓ ' : ''}{s.label}
                      </button>
                    );
                  })}
                </div>

                <AnimatePresence mode="wait">

                  {/* ── STEP 1: ADDRESS & CONTACT ── */}
                  {checkoutStep === 'form' && (
                    <motion.div key="form" initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -15 }} className="space-y-4 pt-1">
                      {/* Compact Item Badge */}
                      <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200/70">
                        <div>
                          <p className="font-extrabold text-slate-900 text-sm">{checkoutProduct.title}</p>
                          <p className="text-xs text-slate-400">{checkoutProduct.seller}</p>
                        </div>
                        <span className="text-base font-black text-emerald-600">{checkoutProduct.price}</span>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <h3 className="text-sm font-extrabold text-slate-800">Customer & Delivery Info</h3>
                        <button
                          type="button"
                          onClick={fetchLiveLocation}
                          disabled={locating}
                          className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200"
                        >
                          {locating ? <Loader2 size={11} className="animate-spin" /> : <MapPin size={11} />}
                          <span>{locating ? 'Locating...' : '📍 Auto-GPS'}</span>
                        </button>
                      </div>

                      {/* Clean Input Fields */}
                      <div className="space-y-2.5">
                        <FormField icon={<User size={15} />} placeholder="Full Name *" value={form.buyer_name} onChange={(v) => setForm(f => ({ ...f, buyer_name: v }))} type="text" />
                        <FormField icon={<Phone size={15} />} placeholder="Phone Number * (+91...)" value={form.buyer_phone} onChange={(v) => setForm(f => ({ ...f, buyer_phone: v }))} type="tel" />
                        <FormField icon={<Mail size={15} />} placeholder="Gmail Address *" value={form.buyer_email} onChange={(v) => setForm(f => ({ ...f, buyer_email: v }))} type="email" />
                        <FormField icon={<MapPin size={15} />} placeholder="Delivery Address *" value={form.buyer_address} onChange={(v) => setForm(f => ({ ...f, buyer_address: v }))} type="text" />

                        {checkoutType === 'rent' ? (
                          <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
                            <span className="text-xs font-bold text-slate-600">{t('shop_rental_dur')}</span>
                            <div className="flex items-center gap-2">
                              <button onClick={() => setForm(f => ({ ...f, rental_days: Math.max(1, f.rental_days - 1) }))} className="h-7 w-7 rounded-lg bg-white border border-slate-200 font-bold text-slate-700">−</button>
                              <span className="font-extrabold text-slate-900 w-6 text-center">{form.rental_days}</span>
                              <button onClick={() => setForm(f => ({ ...f, rental_days: Math.min(30, f.rental_days + 1) }))} className="h-7 w-7 rounded-lg bg-white border border-slate-200 font-bold text-slate-700">+</button>
                              <span className="text-xs text-slate-400">days</span>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
                            <span className="text-xs font-bold text-slate-600">{t('shop_qty')}</span>
                            <div className="flex items-center gap-2">
                              <button onClick={() => setForm(f => ({ ...f, quantity: Math.max(1, f.quantity - 1) }))} className="h-7 w-7 rounded-lg bg-white border border-slate-200 font-bold text-slate-700">−</button>
                              <span className="font-extrabold text-slate-900 w-6 text-center">{form.quantity}</span>
                              <button onClick={() => setForm(f => ({ ...f, quantity: Math.min(99, f.quantity + 1) }))} className="h-7 w-7 rounded-lg bg-white border border-slate-200 font-bold text-slate-700">+</button>
                              <span className="text-xs text-slate-400">units</span>
                            </div>
                          </div>
                        )}
                      </div>

                      <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={() => { if (form.buyer_name && form.buyer_phone) setCheckoutStep('payment'); }}
                        disabled={!form.buyer_name || !form.buyer_phone}
                        className="w-full py-3.5 rounded-2xl font-extrabold text-white text-sm flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20 disabled:opacity-40"
                      >
                        Continue to Payment <ChevronRight size={16} />
                      </motion.button>
                    </motion.div>
                  )}

                  {/* ── STEP 2: PAYMENT OPTIONS ── */}
                  {checkoutStep === 'payment' && (
                    <motion.div key="payment" initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -15 }} className="space-y-3 pt-1">
                      <h3 className="text-sm font-extrabold text-slate-800">Select Payment Mode</h3>

                      {/* Payment Cards */}
                      <div className="space-y-2.5">
                        {/* Razorpay */}
                        <div
                          onClick={() => setPaymentMethod('razorpay')}
                          className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                            paymentMethod === 'razorpay'
                              ? 'bg-emerald-50/60 border-emerald-500 ring-1 ring-emerald-500'
                              : 'bg-slate-50 border-slate-200 hover:bg-slate-100/70'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <CreditCard size={18} className={paymentMethod === 'razorpay' ? 'text-emerald-600' : 'text-slate-400'} />
                              <div>
                                <p className="font-bold text-slate-900 text-xs">Online Payment (Razorpay)</p>
                                <p className="text-[10px] text-slate-400">Cards, UPI, NetBanking</p>
                              </div>
                            </div>
                            <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${paymentMethod === 'razorpay' ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300'}`}>
                              {paymentMethod === 'razorpay' && <Check size={10} className="text-white" />}
                            </div>
                          </div>
                        </div>

                        {/* UPI QR Code */}
                        <div
                          onClick={() => setPaymentMethod('upi_qr')}
                          className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                            paymentMethod === 'upi_qr'
                              ? 'bg-purple-50/60 border-purple-500 ring-1 ring-purple-500'
                              : 'bg-slate-50 border-slate-200 hover:bg-slate-100/70'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <QrCode size={18} className={paymentMethod === 'upi_qr' ? 'text-purple-600' : 'text-slate-400'} />
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <p className="font-bold text-slate-900 text-xs">Scan UPI QR Code</p>
                                  <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 bg-purple-100 text-purple-700 rounded-md">Instant Pay</span>
                                </div>
                                <p className="text-[10px] text-slate-400">GPay, PhonePe, Paytm, BHIM</p>
                              </div>
                            </div>
                            <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${paymentMethod === 'upi_qr' ? 'border-purple-600 bg-purple-600' : 'border-slate-300'}`}>
                              {paymentMethod === 'upi_qr' && <Check size={10} className="text-white" />}
                            </div>
                          </div>

                          {paymentMethod === 'upi_qr' && (
                            <div className="mt-3 pt-3 border-t border-purple-100 text-center space-y-2">
                              <div className="bg-white p-2 rounded-xl inline-block border border-slate-200 shadow-sm">
                                <img
                                  src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=upi://pay?pa=plantdoctors@upi%26pn=PlantDoctors%26am=${encodeURIComponent(checkoutProduct.price.replace(/[^\d.]/g, ''))}%26cu=INR`}
                                  alt="UPI QR Code"
                                  className="w-32 h-32 mx-auto"
                                />
                              </div>
                              <p className="text-xs font-bold text-slate-700">Pay <span className="text-emerald-600 font-extrabold">{checkoutProduct.price}</span> to <span className="text-purple-700 font-bold">plantdoctors@upi</span></p>
                            </div>
                          )}
                        </div>

                        {/* Cash on Delivery */}
                        <div
                          onClick={() => setPaymentMethod('cod')}
                          className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                            paymentMethod === 'cod'
                              ? 'bg-amber-50/60 border-amber-500 ring-1 ring-amber-500'
                              : 'bg-slate-50 border-slate-200 hover:bg-slate-100/70'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Truck size={18} className={paymentMethod === 'cod' ? 'text-amber-600' : 'text-slate-400'} />
                              <div>
                                <p className="font-bold text-slate-900 text-xs">Cash on Delivery (COD)</p>
                                <p className="text-[10px] text-slate-400">Pay cash upon item arrival</p>
                              </div>
                            </div>
                            <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${paymentMethod === 'cod' ? 'border-amber-600 bg-amber-600' : 'border-slate-300'}`}>
                              {paymentMethod === 'cod' && <Check size={10} className="text-white" />}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2.5 pt-2">
                        <button
                          onClick={() => setCheckoutStep('form')}
                          className="flex-1 py-3 rounded-2xl font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 text-xs"
                        >
                          Back
                        </button>
                        <motion.button
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setCheckoutStep('review')}
                          className="flex-[2] py-3 rounded-2xl font-extrabold text-white text-xs bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-md shadow-emerald-600/20"
                        >
                          Review Order <ChevronRight size={14} className="inline" />
                        </motion.button>
                      </div>
                    </motion.div>
                  )}

                  {/* ── STEP 3: SUMMARY ── */}
                  {checkoutStep === 'review' && (
                    <motion.div key="review" initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -15 }} className="space-y-3.5 pt-1">
                      <h3 className="text-sm font-extrabold text-slate-800">Order Summary</h3>

                      <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                        <ReviewRow label="Product" value={checkoutProduct.title} />
                        <ReviewRow label="Price" value={`${checkoutProduct.price}${checkoutType === 'rent' ? ` × ${form.rental_days} day(s)` : ` × ${form.quantity}`}`} highlight />
                        <ReviewRow label="Payment Mode" value={paymentMethod === 'razorpay' ? 'Razorpay Online' : paymentMethod === 'upi_qr' ? 'UPI QR Code' : 'Cash on Delivery'} />
                        <div className="border-t border-slate-200 my-1.5" />
                        <ReviewRow label="Name" value={form.buyer_name} />
                        <ReviewRow label="Phone" value={form.buyer_phone} />
                        {form.buyer_email && <ReviewRow label="Gmail" value={form.buyer_email} />}
                        {form.buyer_address && <ReviewRow label="Address" value={form.buyer_address} />}
                      </div>

                      <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-xs text-emerald-800 font-medium">
                        <Mail size={14} className="shrink-0 text-emerald-600" />
                        <span>Confirmation email will be dispatched to <strong className="text-slate-900">{form.buyer_email || 'your email'}</strong>.</span>
                      </div>

                      <div className="flex gap-2.5 pt-1">
                        <button
                          onClick={() => setCheckoutStep('payment')}
                          className="flex-1 py-3 rounded-2xl font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 text-xs"
                        >
                          Edit
                        </button>
                        <motion.button
                          whileTap={{ scale: 0.98 }}
                          onClick={submitOrder}
                          disabled={submitting}
                          className="flex-[2] py-3 rounded-2xl font-extrabold text-white text-xs bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-md shadow-emerald-600/20"
                        >
                          {submitting ? <Loader2 size={16} className="animate-spin mx-auto" /> : <><CheckCircle2 size={15} className="inline mr-1" /> Place & Confirm Order</>}
                        </motion.button>
                      </div>
                    </motion.div>
                  )}

                  {/* ── STEP 4: SUCCESS & GMAIL LINK ── */}
                  {checkoutStep === 'success' && orderResult && (
                    <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-3.5 py-2">
                      <div className="h-16 w-16 rounded-full mx-auto flex items-center justify-center bg-emerald-100 border border-emerald-300">
                        <CheckCircle2 size={36} className="text-emerald-600" />
                      </div>

                      <div>
                        <h2 className="text-xl font-extrabold text-slate-900">Order Confirmed!</h2>
                        <p className="text-xs text-slate-500 font-bold mt-0.5">Order ID: #{orderResult.order_id}</p>
                      </div>

                      {/* Clean Email Receipt Notice */}
                      <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-left space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                            <Mail size={14} className={orderResult.email_sent ? "text-emerald-600" : "text-amber-600"} /> Email Confirmation
                          </span>
                          {orderResult.email_sent ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Dispatched</span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Failed to send</span>
                          )}
                        </div>

                        {orderResult.email_sent ? (
                          <>
                            <p className="text-xs text-slate-600 leading-normal">
                              Receipt for <strong className="text-slate-900">{checkoutProduct.title} ({checkoutProduct.price})</strong> has been dispatched to <span className="text-emerald-700 font-bold">{orderResult.email_recipient || form.buyer_email || 'your email'}</span> via Resend.
                            </p>
                            
                            {/* Direct 1-Click Gmail Button */}
                            <a
                              href={`https://mail.google.com/mail/u/0/#search/${encodeURIComponent(form.buyer_email || 'Plant Doctors')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full py-2 px-3 rounded-xl bg-white border border-slate-200 hover:border-emerald-300 text-emerald-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm"
                            >
                              <Mail size={13} className="text-emerald-600" />
                              <span>✉️ Click to Open Gmail Inbox</span>
                            </a>
                          </>
                        ) : (
                          <>
                            <p className="text-xs text-amber-800 leading-normal">
                              {orderResult.email_error || 'Email dispatch failed. Please verify RESEND_API_KEY setting.'}
                            </p>
                            <button
                              onClick={handleRetryEmail}
                              disabled={retryingEmail}
                              className="w-full py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm disabled:opacity-50"
                            >
                              {retryingEmail ? <Loader2 size={13} className="animate-spin" /> : <Mail size={13} />}
                              <span>Retry Sending Confirmation Email</span>
                            </button>
                          </>
                        )}
                      </div>

                      {/* WhatsApp updates */}
                      <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={() => window.open(orderResult.whatsapp_url, '_blank')}
                        className="w-full py-3 rounded-2xl font-bold text-white text-xs bg-[#25D366] hover:bg-[#20bd5a] flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <MessageCircle size={16} />
                        Get Updates on WhatsApp
                      </motion.button>

                      <button onClick={closeCheckout} className="w-full py-1 text-slate-400 hover:text-slate-600 font-bold text-xs">
                        Close
                      </button>
                    </motion.div>
                  )}

                </AnimatePresence>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── EMI MODAL ── */}
      <BottomModal isOpen={!!showEMI} onClose={() => setShowEMI(null)} title={t('shop_emi_title')}>
        <div className="space-y-5">
          <div className="text-center py-3">
            <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">{t('shop_emi_emi')}</p>
            <h3 className="text-5xl font-black text-white mt-2 tracking-tighter">
              ₹12,400
              <span className="text-xl text-white/30">/mo</span>
            </h3>
            <div className="flex items-center justify-center gap-1.5 mt-3">
              <ShieldCheck size={13} className="text-emerald-400" />
              <span className="text-xs font-black text-emerald-400">{t('shop_emi_subsidy')}</span>
            </div>
          </div>

          <div className="rounded-2xl p-5 space-y-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex justify-between">
              <p className="font-black text-white">{t('shop_emi_downpay')}</p>
              <p className="text-xl font-black text-emerald-400">{downpayment}%</p>
            </div>
            <div className="relative h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full"
                animate={{ width: `${downpayment}%` }}
                transition={{ type: 'spring', bounce: 0.2 }}
                style={{ background: 'linear-gradient(90deg, #22c55e, #4ade80)' }}
              />
            </div>
            <input
              type="range" min="10" max="60" step="5"
              value={downpayment}
              onChange={(e) => setDownpayment(parseInt(e.target.value))}
              className="w-full cursor-pointer"
              style={{ accentColor: '#22c55e' }}
            />
          </div>

          <button
            onClick={() => { setShowEMI(null); if (showEMI) openCheckout(showEMI, 'buy'); }}
            className="w-full py-4 rounded-2xl font-black text-white haptic-btn flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', boxShadow: '0 4px 20px rgba(34,197,94,0.4)' }}
          >
            {t('shop_emi_proceed')} <ArrowUpRight size={18} />
          </button>
        </div>
      </BottomModal>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────
function FormField({ icon, placeholder, value, onChange, type }: {
  icon: ReactNode; placeholder: string; value: string;
  onChange: (v: string) => void; type: string;
}) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white border border-slate-200 shadow-sm focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100 transition-all"
    >
      <span className="text-slate-400 shrink-0">{icon}</span>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 bg-transparent text-sm font-semibold text-slate-900 placeholder-slate-400 outline-none"
      />
    </div>
  );
}

function ReviewRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-start gap-2">
      <span className="text-xs text-slate-500 font-medium shrink-0">{label}</span>
      <span className={`text-xs text-right font-black ${highlight ? 'text-emerald-600 font-extrabold' : 'text-slate-900'}`}>{value}</span>
    </div>
  );
}

function BottomModal({ isOpen, onClose, title, children }: { isOpen: boolean; onClose: () => void; title: string; children: ReactNode }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)' }}
          />
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="relative w-full max-w-md p-6 rounded-t-[32px]"
            style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 -20px 60px rgba(0,0,0,0.6)' }}
          >
            <div className="swipe-handle mb-5" onClick={onClose} />
            <h2 className="text-xl font-black text-white mb-5">{title}</h2>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
