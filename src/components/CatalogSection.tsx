import { Info, MessageCircle, Search, Stethoscope, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  PRODUCT_CATEGORIES,
  buildWhatsAppProductUrl,
  filterProducts,
  formatRupiah,
  getStockStatus,
} from '../lib/petshopLogic';
import type { Product, ProductCategory, StoreSettings } from '../lib/types';
import { getCategoryImage } from '../utils/assets';

interface CatalogSectionProps {
  products: Product[];
  settings: StoreSettings;
}

export function CatalogSection({ products, settings }: CatalogSectionProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'Semua' | ProductCategory>('Semua');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const filtered = useMemo(
    () => filterProducts(products, searchQuery, selectedCategory),
    [products, searchQuery, selectedCategory]
  );

  return (
    <section id="katalog" className="scroll-mt-28 py-14 lg:py-20 bg-[#FAFBFD] dark:bg-[#090D16]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Section Heading */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold tracking-wider text-pink-600 dark:text-pink-400 mb-2">
              Katalog Produk Toko · Harga &amp; Ketersediaan Real-Time
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-50 text-balance">
              Makanan, Minuman, Perawatan, Aksesori &amp; Obat Hewan
            </h2>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 mt-2">
              Pelanggan dapat menelusuri harga dan status ketersediaan stok secara langsung. Untuk
              pemesanan barang atau konsultasi produk, hubungi admin toko lewat WhatsApp.
            </p>
          </div>

          {/* Search Input */}
          <div className="w-full lg:w-80">
            <label htmlFor="catalog-search" className="sr-only">
              Cari produk petshop
            </label>
            <div className="relative">
              <Search
                className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                id="catalog-search"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari Whiskas, Pedigree, susu, sisir..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Interactive Category Tabs */}
        <div
          role="tablist"
          aria-label="Filter kategori produk"
          className="flex items-center gap-2 overflow-x-auto pb-3 mb-6"
        >
          {PRODUCT_CATEGORIES.map((category) => {
            const active = selectedCategory === category;
            return (
              <button
                key={category}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                  active
                    ? 'bg-gradient-to-r from-pink-600 to-blue-600 text-white shadow-sm'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-pink-400 dark:hover:border-pink-500'
                }`}
              >
                {category}
              </button>
            );
          })}
        </div>

        {/* Veterinary Medicine Disclaimer (from PDF page 2) */}
        <div className="mb-8 p-4 rounded-xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 flex items-start gap-3">
          <Stethoscope
            className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
            <span className="font-semibold text-blue-800 dark:text-blue-300">
              Catatan Katalog &amp; Obat-obatan:{' '}
            </span>
            {settings.vetDisclaimer} Harga tertera adalah harga ritel resmi toko yang terhubung
            langsung dengan stok gudang.
          </div>
        </div>

        {/* Product Grid */}
        {filtered.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <p className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
              Produk tidak ditemukan
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Coba ubah kata kunci pencarian atau pilih kategori Semua.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('Semua');
              }}
              className="mt-4 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-colors cursor-pointer"
            >
              Reset Filter
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((product) => {
              const stockStatus = getStockStatus(product.stock, product.minStock);
              const waUrl = buildWhatsAppProductUrl(settings.whatsappNumber, product);
              const imgUrl = getCategoryImage(product.category);

              return (
                <article
                  key={product.id}
                  data-testid="catalog-product-card"
                  className="group rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col transition-transform duration-200 hover:-translate-y-0.5"
                >
                  {/* Image frame */}
                  <div className="relative h-48 bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <img
                      src={imgUrl}
                      alt={`${product.name} - ${product.category}`}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent" />
                    <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-xs text-white">
                      <span className="font-medium truncate">{product.category}</span>
                      <span className="font-mono-num shrink-0 opacity-90">{product.sku}</span>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-medium text-blue-600 dark:text-blue-400">
                          {product.brand}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{product.variant}</span>
                      </div>

                      <h3 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100 mt-1 leading-snug">
                        {product.name}
                      </h3>

                      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1.5 line-clamp-2">
                        {product.notes || 'Produk berkualitas pilihan untuk anabul.'}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
                      <div className="flex items-baseline justify-between gap-3">
                        <div>
                          <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                            Harga Katalog
                          </span>
                          <span className="font-mono-num text-lg font-bold text-slate-900 dark:text-slate-50">
                            {formatRupiah(product.sellPrice)}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                            Ketersediaan
                          </span>
                          <span
                            className={`text-xs font-semibold tabular-nums ${
                              stockStatus === 'Habis'
                                ? 'text-rose-600 dark:text-rose-400'
                                : stockStatus === 'Stok Menipis'
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-emerald-600 dark:text-emerald-400'
                            }`}
                          >
                            {stockStatus} ({product.stock} unit)
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-pink-600 to-blue-600 hover:from-pink-500 hover:to-blue-500 transition-all whitespace-nowrap"
                        >
                          <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Tanya via WhatsApp</span>
                        </a>
                        <button
                          type="button"
                          onClick={() => setSelectedProduct(product)}
                          aria-label={`Lihat detail ${product.name}`}
                          className="px-3 py-2 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                        >
                          <Info className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Detail</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* Product Detail Modal */}
      {selectedProduct && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="product-modal-title"
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xl">
            <div className="relative h-52 bg-slate-100 dark:bg-slate-800">
              <img
                src={getCategoryImage(selectedProduct.category)}
                alt={selectedProduct.name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                aria-label="Tutup detail produk"
                className="absolute top-3 right-3 p-2 rounded-lg bg-slate-950/70 text-white hover:bg-slate-950 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span>{selectedProduct.category}</span>
                  <span aria-hidden="true">·</span>
                  <span>{selectedProduct.brand}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-num">{selectedProduct.sku}</span>
                </div>
                <h3
                  id="product-modal-title"
                  className="font-display text-xl font-bold text-slate-900 dark:text-slate-100 mt-1"
                >
                  {selectedProduct.name}
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-sm">
                <div>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">
                    Ukuran / Varian
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {selectedProduct.variant}
                  </span>
                </div>
                <div>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">
                    Stok Real-Time
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                    {selectedProduct.stock} unit (
                    {getStockStatus(selectedProduct.stock, selectedProduct.minStock)})
                  </span>
                </div>
              </div>

              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {selectedProduct.notes}
              </p>

              <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
                <div>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">
                    Harga Perkiraan Toko
                  </span>
                  <span className="font-mono-num text-xl font-bold text-pink-600 dark:text-pink-400">
                    {formatRupiah(selectedProduct.sellPrice)}
                  </span>
                </div>
                <a
                  href={buildWhatsAppProductUrl(settings.whatsappNumber, selectedProduct)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-pink-600 to-blue-600 hover:from-pink-500 hover:to-blue-500"
                >
                  <MessageCircle className="w-4 h-4" aria-hidden="true" />
                  <span>Hubungi Admin WA</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
