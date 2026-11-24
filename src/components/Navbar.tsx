import { Bell, Menu, Moon, Sun, X } from 'lucide-react';
import { useState } from 'react';
import { STORE_LOGO_URL } from '../utils/assets';

interface NavbarProps {
  storeName: string;
  promoBannerText: string;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  unreadCount: number;
  onOpenNotifications: () => void;
  activePortal: 'customer' | 'admin';
  onSwitchPortal: (portal: 'customer' | 'admin') => void;
  quotaExceeded: boolean;
}

export function Navbar({
  storeName,
  promoBannerText,
  darkMode,
  onToggleDarkMode,
  unreadCount,
  onOpenNotifications,
  activePortal,
  onSwitchPortal,
  quotaExceeded,
}: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { href: '#katalog', label: 'Katalog' },
    { href: '#grooming', label: 'Grooming' },
    { href: '#lacak', label: 'Lacak & Lokasi' },
    { href: '#ulasan', label: 'Ulasan' },
    { href: '#profil-toko', label: 'Profil Toko' },
  ];

  const handleLinkClick = () => {
    setMobileMenuOpen(false);
    if (activePortal === 'admin') {
      onSwitchPortal('customer');
    }
  };

  return (
    <div className="sticky top-0 z-40">
      {quotaExceeded && (
        <div className="bg-amber-50 dark:bg-amber-950 border-b border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-100 px-4 py-2 text-xs md:text-sm text-center">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 dark:text-amber-50 hover:opacity-80"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      {/* Slim promo & theme utility bar */}
      <div className="bg-gradient-to-r from-pink-600 via-pink-500 to-blue-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-9 flex items-center justify-between gap-4 text-xs">
          <p className="truncate font-medium">{promoBannerText}</p>
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onOpenNotifications}
              aria-label="Buka pusat notifikasi promo dan status pesanan"
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded hover:bg-white/15 transition-colors whitespace-nowrap shrink-0 font-medium"
            >
              <Bell className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Notifikasi</span>
              <span className="font-mono-num font-semibold">({unreadCount})</span>
            </button>
            <button
              type="button"
              onClick={onToggleDarkMode}
              aria-label={darkMode ? 'Aktifkan Mode Terang' : 'Aktifkan Mode Malam'}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded hover:bg-white/15 transition-colors whitespace-nowrap shrink-0 font-medium"
            >
              {darkMode ? (
                <Sun className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <Moon className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              <span className="hidden sm:inline">{darkMode ? 'Mode Terang' : 'Mode Malam'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Strict 3-Zone Top Bar Contract */}
      <header className="bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-2 sm:gap-4 lg:gap-8">
          {/* Zone 1: Brand Mark */}
          <a
            href="#top"
            onClick={() => {
              if (activePortal === 'admin') onSwitchPortal('customer');
            }}
            className="flex items-center gap-2 sm:gap-3 min-w-0 shrink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 rounded-md"
          >
            <span className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg overflow-hidden bg-slate-950 border border-slate-200 dark:border-slate-700 shrink-0 flex items-center justify-center">
              <img
                src={STORE_LOGO_URL}
                alt="Logo Pet Dogs & Cats"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </span>
            <span className="font-display text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 truncate">
              {storeName}
            </span>
          </a>

          {/* Zone 2: 5 single-line navigation links */}
          <nav
            aria-label="Navigasi utama"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300"
          >
            {navLinks.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={handleLinkClick}
                className="hover:text-pink-600 dark:hover:text-pink-400 transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 border-transparent hover:border-pink-500"
              >
                {item.label}
              </a>
            ))}
          </nav>

          {/* Zone 3: 1 Primary Action + Mobile Menu Trigger */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={() =>
                onSwitchPortal(activePortal === 'customer' ? 'admin' : 'customer')
              }
              className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold rounded-lg text-white bg-gradient-to-r from-pink-600 to-blue-600 hover:from-pink-500 hover:to-blue-500 transition-all shadow-sm whitespace-nowrap shrink-0 cursor-pointer"
            >
              {activePortal === 'customer' ? 'Admin Portal' : 'Kembali ke Toko'}
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label={mobileMenuOpen ? 'Tutup menu navigasi' : 'Buka menu navigasi'}
              aria-expanded={mobileMenuOpen}
              className="md:hidden p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer Navigation */}
        {mobileMenuOpen && (
          <nav
            aria-label="Navigasi seluler"
            className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 py-3 flex flex-col gap-1"
          >
            {navLinks.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={handleLinkClick}
                className="px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-pink-50 dark:hover:bg-slate-900 hover:text-pink-600 dark:hover:text-pink-400"
              >
                {item.label}
              </a>
            ))}
          </nav>
        )}
      </header>
    </div>
  );
}
