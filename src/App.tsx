import { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminPortal } from './components/AdminPortal';
import { CatalogSection } from './components/CatalogSection';
import { GroomingBookingSection } from './components/GroomingBookingSection';
import { HeroSection } from './components/HeroSection';
import { Navbar } from './components/Navbar';
import { NotificationDrawer } from './components/NotificationDrawer';
import { ReviewsSection } from './components/ReviewsSection';
import { StoreLocatorAndTracking } from './components/StoreLocatorAndTracking';
import type {
  CustomerReview,
  GroomingServiceOption,
  OrderBooking,
  Product,
  PushNotification,
  StoreBranch,
  StoreSettings,
} from './lib/types';
import { STORE_LOGO_URL } from './utils/assets';

interface PublicBootstrapPayload {
  settings: StoreSettings;
  branches: StoreBranch[];
  groomingServices: GroomingServiceOption[];
  products: Product[];
  notifications: PushNotification[];
  reviews: CustomerReview[];
  recentOrders: OrderBooking[];
}

export default function App() {
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [activePortal, setActivePortal] = useState<'customer' | 'admin'>('customer');
  const [bootstrap, setBootstrap] = useState<PublicBootstrapPayload | null>(null);
  const [mapsApiKey, setMapsApiKey] = useState<string>(
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''
  );
  const [quotaExceeded, setQuotaExceeded] = useState<boolean>(false);

  // Notifications & Real-time SSE Push
  const [notifications, setNotifications] = useState<PushNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(2);
  const [notifDrawerOpen, setNotifDrawerOpen] = useState<boolean>(false);
  const [liveToast, setLiveToast] = useState<PushNotification | null>(null);
  const [browserPushEnabled, setBrowserPushEnabled] = useState<boolean>(
    typeof Notification !== 'undefined' && Notification.permission === 'granted'
  );
  const [highlightedOrderId, setHighlightedOrderId] = useState<string | null>(null);

  // Sync Tailwind v4 .dark class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [darkMode]);

  // Listen to Google Maps quota exceeded event
  useEffect(() => {
    const onQuota = () => setQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', onQuota);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuota);
  }, []);

  const fetchBootstrap = useCallback(async () => {
    try {
      const res = await fetch('/api/bootstrap');
      if (!res.ok) return;
      const data = (await res.json()) as PublicBootstrapPayload;
      setBootstrap(data);
      setNotifications(data.notifications);
    } catch {
      // Keep existing state
    }
  }, []);

  useEffect(() => {
    void fetchBootstrap();
    if (!import.meta.env.VITE_GOOGLE_MAPS_API_KEY) {
      fetch('/api/public-config')
        .then((r) => r.json())
        .then((cfg: { mapsApiKey?: string }) => {
          if (cfg.mapsApiKey) setMapsApiKey(cfg.mapsApiKey);
        })
        .catch(() => {});
    }
  }, [fetchBootstrap]);

  // Real-Time Push Notification Stream (SSE)
  useEffect(() => {
    const source = new EventSource('/api/notifications/stream');
    source.addEventListener('notification', (event: MessageEvent<string>) => {
      try {
        const incoming = JSON.parse(event.data) as PushNotification;
        setNotifications((prev) => [incoming, ...prev.filter((p) => p.id !== incoming.id)]);
        setUnreadCount((c) => c + 1);
        setLiveToast(incoming);
        setTimeout(() => {
          setLiveToast((current) => (current?.id === incoming.id ? null : current));
        }, 5500);

        if (
          typeof Notification !== 'undefined' &&
          Notification.permission === 'granted'
        ) {
          new Notification(incoming.title, {
            body: incoming.message,
            icon: STORE_LOGO_URL,
          });
        }
        void fetchBootstrap();
      } catch {
        // Ignore parse error
      }
    });

    return () => source.close();
  }, [fetchBootstrap]);

  const handleRequestBrowserPush = async () => {
    if (typeof Notification === 'undefined') return;
    try {
      const perm = await Notification.requestPermission();
      setBrowserPushEnabled(perm === 'granted');
    } catch {
      setBrowserPushEnabled(false);
    }
  };

  const averageRating = useMemo(() => {
    if (!bootstrap || bootstrap.reviews.length === 0) return 5.0;
    const total = bootstrap.reviews.reduce((s, r) => s + r.rating, 0);
    return total / bootstrap.reviews.length;
  }, [bootstrap]);

  const inStockCount = useMemo(
    () => (bootstrap ? bootstrap.products.filter((p) => p.stock > 0).length : 0),
    [bootstrap]
  );

  if (!bootstrap) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFBFD] dark:bg-[#090D16] text-slate-600 dark:text-slate-300 text-sm">
        Memuat katalog Pet — Dogs &amp; Cats...
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFBFD] dark:bg-[#090D16] text-slate-900 dark:text-slate-100">
      <Navbar
        storeName={bootstrap.settings.storeName}
        promoBannerText={bootstrap.settings.promoBannerText}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode((d) => !d)}
        unreadCount={unreadCount}
        onOpenNotifications={() => {
          setNotifDrawerOpen(true);
          setUnreadCount(0);
        }}
        activePortal={activePortal}
        onSwitchPortal={(portal) => {
          setActivePortal(portal);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        quotaExceeded={quotaExceeded}
      />

      {activePortal === 'admin' ? (
        <AdminPortal
          mapsApiKey={mapsApiKey}
          onPublicDataChanged={() => void fetchBootstrap()}
        />
      ) : (
        <main className="flex-1">
          <HeroSection
            settings={bootstrap.settings}
            branches={bootstrap.branches}
            totalProducts={bootstrap.products.length}
            inStockProducts={inStockCount}
            averageRating={averageRating}
            reviewCount={bootstrap.reviews.length}
          />

          <CatalogSection products={bootstrap.products} settings={bootstrap.settings} />

          <GroomingBookingSection
            services={bootstrap.groomingServices}
            branches={bootstrap.branches}
            settings={bootstrap.settings}
            onBookingCreated={(newOrder) => {
              setBootstrap((prev) =>
                prev
                  ? {
                      ...prev,
                      recentOrders: [newOrder, ...prev.recentOrders],
                    }
                  : prev
              );
              setHighlightedOrderId(newOrder.id);
            }}
            onJumpToOrder={(orderId) => {
              setHighlightedOrderId(orderId);
              document.getElementById('lacak')?.scrollIntoView({ behavior: 'smooth' });
            }}
          />

          <StoreLocatorAndTracking
            mapsApiKey={mapsApiKey}
            branches={bootstrap.branches}
            orders={bootstrap.recentOrders}
            highlightedOrderId={highlightedOrderId}
          />

          <ReviewsSection
            reviews={bootstrap.reviews}
            onReviewAdded={(review) =>
              setBootstrap((prev) =>
                prev ? { ...prev, reviews: [review, ...prev.reviews] } : prev
              )
            }
          />
        </main>
      )}

      {/* Clean Footer */}
      <footer className="bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-3">
            <img
              src={STORE_LOGO_URL}
              alt="Logo Pet Dogs & Cats"
              referrerPolicy="no-referrer"
              className="w-8 h-8 rounded-lg object-cover bg-slate-950"
            />
            <div>
              <p className="font-display font-bold text-slate-900 dark:text-slate-100">
                {bootstrap.settings.storeName}
              </p>
              <p>{bootstrap.settings.operatingHours}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <a href="#katalog" className="hover:text-pink-600 dark:hover:text-pink-400">
              Katalog
            </a>
            <a href="#grooming" className="hover:text-pink-600 dark:hover:text-pink-400">
              Grooming
            </a>
            <a href="#lacak" className="hover:text-pink-600 dark:hover:text-pink-400">
              Lacak Pesanan
            </a>
            <button
              type="button"
              onClick={() => {
                setActivePortal(activePortal === 'customer' ? 'admin' : 'customer');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              {activePortal === 'customer' ? 'Masuk Admin Portal' : 'Tampilan Pelanggan'}
            </button>
          </div>
        </div>
      </footer>

      {/* Notification Slide-Over */}
      <NotificationDrawer
        open={notifDrawerOpen}
        onClose={() => setNotifDrawerOpen(false)}
        notifications={notifications}
        browserPushEnabled={browserPushEnabled}
        onRequestBrowserPush={() => void handleRequestBrowserPush()}
        onClearUnread={() => setUnreadCount(0)}
      />

      {/* Live Push Notification Toast */}
      {liveToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-4 right-4 z-50 max-w-sm p-4 rounded-2xl bg-white dark:bg-slate-900 border border-pink-300 dark:border-pink-700 shadow-xl space-y-1"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-pink-600 dark:text-pink-400">
              Notifikasi Push Baru
            </span>
            <button
              type="button"
              onClick={() => setLiveToast(null)}
              aria-label="Tutup notifikasi"
              className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              Tutup
            </button>
          </div>
          <p className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
            {liveToast.title}
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-300">{liveToast.message}</p>
        </div>
      )}
    </div>
  );
}
