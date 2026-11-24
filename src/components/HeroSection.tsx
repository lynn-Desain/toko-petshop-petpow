import { ArrowRight, MapPin, MessageCircle, Scissors, ShieldCheck } from 'lucide-react';
import { buildWhatsAppGroomingUrl } from '../lib/petshopLogic';
import type { StoreBranch, StoreSettings } from '../lib/types';
import { HERO_BANNER_URL, STORE_LOGO_URL } from '../utils/assets';

interface HeroSectionProps {
  settings: StoreSettings;
  branches: StoreBranch[];
  totalProducts: number;
  inStockProducts: number;
  averageRating: number;
  reviewCount: number;
}

export function HeroSection({
  settings,
  branches,
  totalProducts,
  inStockProducts,
  averageRating,
  reviewCount,
}: HeroSectionProps) {
  const quickWaUrl = buildWhatsAppGroomingUrl(settings.whatsappNumber, {
    customerName: 'Pelanggan Baru',
    customerPhone: '-',
    petType: 'Kucing / Anjing',
    petNameOrBreed: '-',
    serviceName: 'Konsultasi Katalog & Grooming',
    complaintOrNotes: 'Halo Admin, saya ingin menanyakan ketersediaan stok atau jadwal grooming.',
    branchName: branches[0]?.name || settings.storeName,
    deliveryMode: 'Datang ke Toko',
  });

  return (
    <section
      id="top"
      className="relative overflow-hidden bg-gradient-to-b from-pink-50/70 via-white to-blue-50/50 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 border-b border-slate-200 dark:border-slate-800"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 lg:py-16">
        <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
          {/* Left editorial content */}
          <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-950 border border-slate-200 dark:border-slate-700 shrink-0">
                <img
                  src={STORE_LOGO_URL}
                  alt="Pet Dogs & Cats Logo"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                <span className="font-semibold text-pink-600 dark:text-pink-400">
                  {settings.storeName}
                </span>
                <span aria-hidden="true" className="mx-2 text-slate-400">
                  ·
                </span>
                <span>{settings.operatingHours}</span>
              </div>
            </div>

            <h1 className="font-display text-3xl sm:text-4xl lg:text-[2.85rem] font-extrabold tracking-tight text-slate-900 dark:text-slate-50 leading-[1.12] text-balance">
              Perawatan &amp; Nutrisi Terpercaya untuk Anjing &amp; Kucing Kesayangan
            </h1>

            <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-xl leading-relaxed">
              {settings.tagline}. Cek stok katalog secara real-time tanpa perlu daftar akun, pesan
              antrian grooming lewat WhatsApp atau QRIS otomatis, dan pantau kurir di peta.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <a
                href="#grooming"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-pink-600 to-blue-600 hover:from-pink-500 hover:to-blue-500 shadow-sm transition-all whitespace-nowrap shrink-0"
              >
                <Scissors className="w-4 h-4" aria-hidden="true" />
                <span>Daftar Grooming</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </a>
              <a
                href="#katalog"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 transition-colors whitespace-nowrap shrink-0"
              >
                <span>Lihat Katalog Produk</span>
              </a>
              <a
                href={quickWaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors whitespace-nowrap shrink-0"
              >
                <MessageCircle className="w-4 h-4" aria-hidden="true" />
                <span>Chat WhatsApp</span>
              </a>
            </div>
          </div>

          {/* Right visual frame */}
          <div className="lg:col-span-6">
            <div className="relative h-72 sm:h-96 lg:h-full min-h-[340px] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 shadow-sm">
              <img
                src={HERO_BANNER_URL}
                alt="Anjing Golden Retriever dan Kucing British Shorthair di studio grooming Pet Dogs & Cats"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-950/15 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-6 text-white">
                <div className="flex flex-wrap items-center gap-2 text-xs text-pink-200 mb-1">
                  <span>{branches.length} Cabang Aktif</span>
                  <span aria-hidden="true">·</span>
                  <span>Antar-Jemput Kurir Terlacak Peta</span>
                </div>
                <p className="font-display text-base sm:text-lg font-semibold leading-snug">
                  Grooming Higienis, Stok Pakan Terlengkap &amp; Bukti Antrian Otomatis
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Full-width 4-column Store Profile & Proof Strip below hero split */}
        <div
          id="profil-toko"
          className="scroll-mt-28 mt-10 grid grid-cols-2 lg:grid-cols-4 gap-4 pt-8 border-t border-slate-200 dark:border-slate-800"
        >
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <p className="text-xs text-slate-500 dark:text-slate-400">Katalog Ready Stok</p>
            <p className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1 tabular-nums">
              {inStockProducts} / {totalProducts} Item
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
              Makanan, Susu, Perawatan &amp; Obat
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <p className="text-xs text-slate-500 dark:text-slate-400">Kepuasan Pelanggan</p>
            <p className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1 tabular-nums">
              {averageRating.toFixed(1)} / 5.0
            </p>
            <p className="text-xs text-pink-600 dark:text-pink-400 mt-1 tabular-nums">
              Berdasarkan {reviewCount} ulasan terverifikasi
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <MapPin className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
              <span>Jangkauan Cabang</span>
            </div>
            <p className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1 tabular-nums">
              {branches.length} Lokasi
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              Kemang · Puri Indah · BSD City
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-pink-600 dark:text-pink-400" aria-hidden="true" />
              <span>Akses Pelanggan</span>
            </div>
            <p className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
              Tanpa Login
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              Langsung cek harga, stok &amp; antrian
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
