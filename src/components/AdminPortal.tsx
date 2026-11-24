import {
  AlertTriangle,
  ArrowDownUp,
  BarChart3,
  BellPlus,
  Download,
  FileSpreadsheet,
  FileText,
  Lock,
  LogOut,
  Package,
  Pencil,
  Plus,
  Search,
  Settings,
  Trash2,
  Truck,
  Upload,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  PRODUCT_CATEGORIES,
  calculateMargin,
  computeMonthlyFinancials,
  formatRupiah,
  getStockStatus,
  parseInventoryCsv,
  serializeToCsv,
} from '../lib/petshopLogic';
import type {
  MonthlyFinancialSummary,
  OrderBooking,
  OrderStatus,
  Product,
  ProductCategory,
  PushNotification,
  StockMovement,
  StockMovementType,
  StoreBranch,
  StoreSettings,
} from '../lib/types';
import { triggerDownload } from '../utils/assets';
import { generateMonthlyFinancialPdf } from '../utils/pdfReport';
import { GoogleMapsView, type MapMarkerItem } from './GoogleMapsView';

type AdminTab = 'analytics' | 'inventory' | 'ledger' | 'orders' | 'finance' | 'settings';

interface AdminPortalProps {
  mapsApiKey: string;
  onPublicDataChanged: () => void;
}

interface AdminDashboardData {
  settings: StoreSettings;
  branches: StoreBranch[];
  products: Product[];
  stockMovements: StockMovement[];
  orders: OrderBooking[];
  notifications: PushNotification[];
  financialSummary: MonthlyFinancialSummary;
}

const ORDER_STATUSES: OrderStatus[] = [
  'Menunggu Pembayaran',
  'Antrian Dikonfirmasi',
  'Sedang Diproses',
  'Kurir Menuju Lokasi',
  'Selesai',
  'Dibatalkan',
];

export function AdminPortal({ mapsApiKey, onPublicDataChanged }: AdminPortalProps) {
  // Auth token kept strictly in React memory (never localStorage)
  const [token, setToken] = useState<string | null>(null);
  const [needsSetup, setNeedsSetup] = useState<boolean>(false);
  const [envConfigured, setEnvConfigured] = useState<boolean>(false);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<AdminTab>('analytics');
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-11');
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [busyMessage, setBusyMessage] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Inventory filters & modal
  const [invSearch, setInvSearch] = useState('');
  const [invCategory, setInvCategory] = useState<'Semua' | ProductCategory>('Semua');
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Product Form fields
  const [pCategory, setPCategory] = useState<ProductCategory>('Makanan Kucing');
  const [pName, setPName] = useState('');
  const [pBrand, setPBrand] = useState('');
  const [pVariant, setPVariant] = useState('');
  const [pCost, setPCost] = useState('25000');
  const [pSell, setPSell] = useState('35000');
  const [pStock, setPStock] = useState('15');
  const [pMinStock, setPMinStock] = useState('5');
  const [pSupplier, setPSupplier] = useState('Supplier Utama');
  const [pNotes, setPNotes] = useState('');

  // Ledger state
  const [ledgerFilter, setLedgerFilter] = useState<'Semua' | StockMovementType>('Semua');
  const [movProductId, setMovProductId] = useState('');
  const [movType, setMovType] = useState<StockMovementType>('Masuk');
  const [movQty, setMovQty] = useState('5');
  const [movNote, setMovNote] = useState('');

  // Orders & Promo Push state
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [promoTitle, setPromoTitle] = useState('');
  const [promoMessage, setPromoMessage] = useState('');

  // Settings form state
  const [sStoreName, setSStoreName] = useState('');
  const [sTagline, setSTagline] = useState('');
  const [sWa, setSWa] = useState('');
  const [sHours, setSHours] = useState('');
  const [sPromo, setSPromo] = useState('');
  const [sOpExpense, setSOpExpense] = useState('4250000');
  const [sDeliveryFee, setSDeliveryFee] = useState('15000');

  useEffect(() => {
    fetch('/api/admin/auth/status')
      .then((r) => r.json())
      .then((res: { needsSetup: boolean; envConfigured: boolean }) => {
        setNeedsSetup(res.needsSetup);
        setEnvConfigured(res.envConfigured);
      })
      .catch(() => {})
      .finally(() => setAuthLoading(false));
  }, []);

  const loadDashboard = useCallback(
    async (authToken: string, monthKey: string) => {
      try {
        const res = await fetch(`/api/admin/dashboard?month=${encodeURIComponent(monthKey)}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (res.status === 401) {
          setToken(null);
          setAuthError('Sesi admin berakhir. Silakan masuk kembali.');
          return;
        }
        if (!res.ok) return;
        const payload = (await res.json()) as AdminDashboardData;
        setData(payload);

        setSStoreName(payload.settings.storeName);
        setSTagline(payload.settings.tagline);
        setSWa(payload.settings.whatsappNumber);
        setSHours(payload.settings.operatingHours);
        setSPromo(payload.settings.promoBannerText);
        setSOpExpense(String(payload.settings.monthlyOperationalExpense));
        setSDeliveryFee(String(payload.settings.deliveryBaseFee));

        if (!movProductId && payload.products[0]) {
          setMovProductId(payload.products[0].id);
        }
        if (!selectedOrderId && payload.orders[0]) {
          setSelectedOrderId(payload.orders[0].id);
        }
      } catch {
        // Ignore transient network errors
      }
    },
    [movProductId, selectedOrderId]
  );

  useEffect(() => {
    if (token) {
      void loadDashboard(token, selectedMonth);
    }
  }, [token, selectedMonth, loadDashboard]);

  const showToast = (msg: string) => {
    setActionFeedback(msg);
    setTimeout(() => setActionFeedback(null), 3500);
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    const endpoint = needsSetup ? '/api/admin/auth/bootstrap' : '/api/admin/auth/login';
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordInput }),
      });
      const json = (await res.json()) as { token?: string; error?: string };
      if (!res.ok || !json.token) {
        setAuthError(json.error || 'Gagal masuk ke Portal Admin.');
        return;
      }
      setNeedsSetup(false);
      setPasswordInput('');
      setToken(json.token);
    } catch {
      setAuthError('Terjadi kendala koneksi ke server.');
    }
  };

  const openAddProduct = () => {
    setEditingProduct(null);
    setPCategory('Makanan Kucing');
    setPName('');
    setPBrand('');
    setPVariant('');
    setPCost('25000');
    setPSell('35000');
    setPStock('15');
    setPMinStock('5');
    setPSupplier('Supplier Utama');
    setPNotes('');
    setShowProductModal(true);
  };

  const openEditProduct = (p: Product) => {
    setEditingProduct(p);
    setPCategory(p.category);
    setPName(p.name);
    setPBrand(p.brand);
    setPVariant(p.variant);
    setPCost(String(p.costPrice));
    setPSell(String(p.sellPrice));
    setPStock(String(p.stock));
    setPMinStock(String(p.minStock));
    setPSupplier(p.supplier);
    setPNotes(p.notes);
    setShowProductModal(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setBusyMessage('Menyimpan produk...');
    try {
      const url = editingProduct
        ? `/api/admin/products/${editingProduct.id}`
        : '/api/admin/products';
      const method = editingProduct ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          category: pCategory,
          name: pName,
          brand: pBrand,
          variant: pVariant,
          costPrice: Number(pCost),
          sellPrice: Number(pSell),
          stock: Number(pStock),
          minStock: Number(pMinStock),
          supplier: pSupplier,
          notes: pNotes,
        }),
      });
      if (res.ok) {
        setShowProductModal(false);
        await loadDashboard(token, selectedMonth);
        onPublicDataChanged();
        showToast(editingProduct ? 'Data produk diperbarui.' : 'Produk baru berhasil ditambahkan.');
      }
    } finally {
      setBusyMessage(null);
    }
  };

  const handleDeleteProduct = async (product: Product) => {
    if (!token) return;
    const res = await fetch(`/api/admin/products/${product.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      await loadDashboard(token, selectedMonth);
      onPublicDataChanged();
      showToast(`Produk "${product.name}" dihapus dari inventaris.`);
    }
  };

  const handleQuickStock = async (
    productId: string,
    type: StockMovementType,
    quantity: number,
    note: string
  ) => {
    if (!token) return;
    const res = await fetch('/api/admin/stock-movements', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ productId, type, quantity, note }),
    });
    if (res.ok) {
      await loadDashboard(token, selectedMonth);
      onPublicDataChanged();
      showToast(`Stok ${type.toLowerCase()} (${quantity} unit) dicatat.`);
    }
  };

  const handleManualLedgerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleQuickStock(
      movProductId,
      movType,
      Math.max(1, Number(movQty) || 1),
      movNote || `Catatan manual (${movType})`
    );
    setMovNote('');
  };

  const handleUpdateOrderStatus = async (orderId: string, status: OrderStatus) => {
    if (!token) return;
    const res = await fetch(`/api/admin/orders/${orderId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      await loadDashboard(token, selectedMonth);
      onPublicDataChanged();
      showToast(`Status diperbarui ke "${status}" & notifikasi push terkirim ke pelanggan.`);
    }
  };

  const handleBroadcastPromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    const res = await fetch('/api/admin/promos', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ title: promoTitle, message: promoMessage }),
    });
    if (res.ok) {
      setPromoTitle('');
      setPromoMessage('');
      await loadDashboard(token, selectedMonth);
      onPublicDataChanged();
      showToast('Notifikasi push promo berhasil dikirim ke seluruh pelanggan.');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    const res = await fetch('/api/admin/settings', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        storeName: sStoreName,
        tagline: sTagline,
        whatsappNumber: sWa,
        operatingHours: sHours,
        promoBannerText: sPromo,
        monthlyOperationalExpense: Number(sOpExpense),
        deliveryBaseFee: Number(sDeliveryFee),
      }),
    });
    if (res.ok) {
      await loadDashboard(token, selectedMonth);
      onPublicDataChanged();
      showToast('Pengaturan toko berhasil disimpan.');
    }
  };

  const handleExportInventoryCsv = () => {
    if (!data) return;
    const csv = serializeToCsv(
      [
        'SKU',
        'Kategori',
        'Nama Produk',
        'Merek',
        'Varian',
        'Harga Jual',
        'Harga Modal',
        'Margin (Rp)',
        'Margin (%)',
        'Stok',
        'Stok Min',
        'Supplier',
        'Keterangan',
      ],
      data.products.map((p) => {
        const m = calculateMargin(p.costPrice, p.sellPrice);
        return [
          p.sku,
          p.category,
          p.name,
          p.brand,
          p.variant,
          p.sellPrice,
          p.costPrice,
          m.marginAmount,
          m.marginPercent,
          p.stock,
          p.minStock,
          p.supplier,
          p.notes,
        ];
      })
    );
    triggerDownload('Inventaris-Petshop.csv', csv, 'text/csv;charset=utf-8;');
    showToast('File Excel/CSV inventaris berhasil diunduh.');
  };

  const handleExportLedgerCsv = () => {
    if (!data) return;
    const csv = serializeToCsv(
      ['Tanggal', 'SKU', 'Nama Produk', 'Jenis', 'Jumlah', 'Stok Awal', 'Stok Akhir', 'Harga Modal', 'Catatan', 'Aktor'],
      data.stockMovements.map((m) => [
        m.createdAt,
        m.sku,
        m.productName,
        m.type,
        m.quantity,
        m.previousStock,
        m.newStock,
        m.unitCost,
        m.note,
        m.actor,
      ])
    );
    triggerDownload('Catatan-Keluar-Masuk-Stok.csv', csv, 'text/csv;charset=utf-8;');
    showToast('Catatan keluar masuk barang (CSV) berhasil diunduh.');
  };

  const handleImportCsvFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    const text = await file.text();
    const parsed = parseInventoryCsv(text);
    if (parsed.length === 0) {
      showToast('Format CSV tidak memiliki baris produk yang valid.');
      return;
    }
    const res = await fetch('/api/admin/products/import', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ items: parsed }),
    });
    if (res.ok) {
      await loadDashboard(token, selectedMonth);
      onPublicDataChanged();
      showToast(`Berhasil mengimpor ${parsed.length} produk dari CSV.`);
    }
    e.target.value = '';
  };

  const handleExportFinanceCsv = () => {
    if (!data) return;
    const summary = computeMonthlyFinancials(
      data.orders,
      data.products,
      selectedMonth,
      data.settings.monthlyOperationalExpense
    );
    const csv = serializeToCsv(
      ['Periode', 'Komponen', 'Nominal (IDR)'],
      [
        [summary.monthLabel, 'Pendapatan Layanan Grooming', summary.groomingRevenue],
        [summary.monthLabel, 'Pendapatan Penjualan Produk', summary.productRevenue],
        [summary.monthLabel, 'Pendapatan Ongkos Kirim', summary.deliveryRevenue],
        [summary.monthLabel, 'Total Pendapatan', summary.totalRevenue],
        [summary.monthLabel, 'HPP / Harga Modal', summary.totalCogs],
        [summary.monthLabel, 'Laba Kotor', summary.grossProfit],
        [summary.monthLabel, 'Beban Operasional', summary.operationalExpense],
        [summary.monthLabel, 'Laba Bersih', summary.netProfit],
        [summary.monthLabel, 'Valuasi Stok Modal', summary.inventoryValuationCost],
        [summary.monthLabel, 'Valuasi Stok Jual', summary.inventoryValuationRetail],
      ]
    );
    triggerDownload(`Laporan-Keuangan-${selectedMonth}.csv`, csv, 'text/csv;charset=utf-8;');
    showToast('Laporan keuangan bulanan (Excel/CSV) berhasil diunduh.');
  };

  const filteredProducts = useMemo(() => {
    if (!data) return [];
    const q = invSearch.trim().toLowerCase();
    return data.products.filter((p) => {
      const catOk = invCategory === 'Semua' || p.category === invCategory;
      if (!catOk) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.supplier.toLowerCase().includes(q)
      );
    });
  }, [data, invSearch, invCategory]);

  const filteredLedger = useMemo(() => {
    if (!data) return [];
    if (ledgerFilter === 'Semua') return data.stockMovements;
    return data.stockMovements.filter((m) => m.type === ledgerFilter);
  }, [data, ledgerFilter]);

  const lowStockItems = useMemo(
    () => (data ? data.products.filter((p) => p.stock <= p.minStock) : []),
    [data]
  );

  const activeOrderForMap = useMemo(
    () =>
      data?.orders.find((o) => o.id === selectedOrderId) || data?.orders[0] || null,
    [data, selectedOrderId]
  );

  const orderMapMarkers: MapMarkerItem[] = useMemo(() => {
    if (!activeOrderForMap || !data) return [];
    const branch =
      data.branches.find((b) => b.id === activeOrderForMap.branchId) || data.branches[0];
    const list: MapMarkerItem[] = [
      {
        id: 'store',
        position: branch.coords,
        title: branch.name,
        subtitle: branch.address,
        kind: 'store',
      },
    ];
    if (activeOrderForMap.deliveryMode === 'Antar-Jemput Kurir') {
      list.push(
        {
          id: 'courier',
          position: activeOrderForMap.courierCoords,
          title: `Kurir: ${activeOrderForMap.courierName}`,
          subtitle: `ETA ${activeOrderForMap.etaMinutes} mnt · ${activeOrderForMap.status}`,
          kind: 'courier',
        },
        {
          id: 'dest',
          position: activeOrderForMap.destinationCoords,
          title: activeOrderForMap.customerName,
          subtitle: activeOrderForMap.deliveryAddress,
          kind: 'destination',
        }
      );
    }
    return list;
  }, [activeOrderForMap, data]);

  // Auth Gate Screen
  if (!token) {
    return (
      <section className="min-h-[calc(100vh-110px)] flex items-center justify-center p-4 sm:p-6 bg-gradient-to-b from-pink-50/60 via-white to-blue-50/50 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
        <div className="w-full max-w-md p-6 sm:p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-pink-600 to-blue-600 text-white flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold text-slate-900 dark:text-slate-50">
                {needsSetup ? 'Aktivasi Portal Admin' : 'Login Admin Petshop'}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {needsSetup
                  ? 'Atur password admin pertama kali untuk mengamankan manajemen stok & keuangan.'
                  : envConfigured
                    ? 'Masukkan passcode admin yang dikonfigurasi pada server.'
                    : 'Masukkan password admin toko untuk mengelola stok, pesanan, dan laporan.'}
              </p>
            </div>
          </div>

          {authLoading ? (
            <p className="text-sm text-slate-500 py-4 text-center">Memeriksa status keamanan...</p>
          ) : (
            <form onSubmit={handleAuthSubmit} className="space-y-4">
              {authError && (
                <div
                  role="alert"
                  className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-200"
                >
                  {authError}
                </div>
              )}

              <div>
                <label
                  htmlFor="admin-password-input"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  {needsSetup ? 'Buat Password Admin (Min. 6 Karakter)' : 'Password / Passcode Admin'}
                </label>
                <input
                  id="admin-password-input"
                  type="password"
                  required
                  minLength={needsSetup ? 6 : 1}
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-pink-500/50"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-pink-600 to-blue-600 hover:from-pink-500 hover:to-blue-500 shadow-sm cursor-pointer"
              >
                {needsSetup ? 'Simpan Password & Masuk Dasbor' : 'Masuk ke Dasbor Admin'}
              </button>
            </form>
          )}
        </div>
      </section>
    );
  }

  if (!data) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-sm text-slate-500">
        Memuat dasbor admin...
      </div>
    );
  }

  const liveSummary = computeMonthlyFinancials(
    data.orders,
    data.products,
    selectedMonth,
    data.settings.monthlyOperationalExpense
  );

  const navItems: Array<{ id: AdminTab; label: string; icon: typeof BarChart3 }> = [
    { id: 'analytics', label: 'Dasbor Analitik', icon: BarChart3 },
    { id: 'inventory', label: 'Inventaris & Barang', icon: Package },
    { id: 'ledger', label: 'Keluar Masuk Stok', icon: ArrowDownUp },
    { id: 'orders', label: 'Pesanan & Kurir Peta', icon: Truck },
    { id: 'finance', label: 'Laporan Keuangan PDF', icon: FileText },
    { id: 'settings', label: 'Setting Toko', icon: Settings },
  ];

  const formMargin = calculateMargin(Number(pCost), Number(pSell));

  return (
    <div className="min-h-[calc(100vh-110px)] bg-[#F8FAFC] dark:bg-[#090D16]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 lg:py-8">
        <div className="grid lg:grid-cols-12 gap-6 items-start">
          {/* Sidebar Navigation */}
          <aside className="lg:col-span-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 space-y-2 lg:sticky lg:top-28">
            <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 mb-2">
              <p className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                Admin Workspace
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {data.settings.storeName}
              </p>
            </div>

            <nav aria-label="Menu Admin" className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      active
                        ? 'bg-gradient-to-r from-pink-600 to-blue-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setToken(null)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
              >
                <LogOut className="w-4 h-4" aria-hidden="true" />
                <span>Keluar Sesi Admin</span>
              </button>
            </div>
          </aside>

          {/* Main Admin Content */}
          <main className="lg:col-span-9 space-y-6">
            {(actionFeedback || busyMessage) && (
              <div
                role="status"
                className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-xs sm:text-sm font-medium text-blue-800 dark:text-blue-200"
              >
                {busyMessage || actionFeedback}
              </div>
            )}

            {/* TAB 1: ANALYTICS DASHBOARD */}
            {activeTab === 'analytics' && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-50">
                      Dasbor Analitik Performa Penjualan
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                      Periode {liveSummary.monthLabel} · Pemantauan stok dan transaksi real-time
                    </p>
                  </div>
                  <input
                    type="month"
                    aria-label="Pilih bulan laporan"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-mono-num"
                  />
                </div>

                {/* 4 KPI Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Total Pendapatan</p>
                    <p className="font-mono-num text-xl font-bold text-slate-900 dark:text-slate-50 mt-1">
                      {formatRupiah(liveSummary.totalRevenue)}
                    </p>
                    <p className="text-xs text-pink-600 dark:text-pink-400 mt-1">
                      Grooming + Produk + Ongkir
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Laba Kotor (Margin)</p>
                    <p className="font-mono-num text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                      {formatRupiah(liveSummary.grossProfit)}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
                      Margin {liveSummary.grossMarginPercent}%
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Total Pesanan Aktif</p>
                    <p className="font-mono-num text-xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                      {data.orders.length} Order
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
                      {liveSummary.groomingOrders} Grooming · {liveSummary.productOrders} Produk
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Peringatan Stok</p>
                    <p className="font-mono-num text-xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                      {lowStockItems.length} Item
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Perlu restock segera
                    </p>
                  </div>
                </div>

                {/* Visual Revenue Split & Low Stock Alert */}
                <div className="grid lg:grid-cols-2 gap-6">
                  <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
                    <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                      Komposisi Pendapatan ({liveSummary.monthLabel})
                    </h2>
                    {[
                      {
                        label: 'Layanan Grooming',
                        value: liveSummary.groomingRevenue,
                        barClass: 'bg-pink-600',
                      },
                      {
                        label: 'Penjualan Barang Katalog',
                        value: liveSummary.productRevenue,
                        barClass: 'bg-blue-600',
                      },
                      {
                        label: 'Layanan Antar-Jemput Kurir',
                        value: liveSummary.deliveryRevenue,
                        barClass: 'bg-sky-500',
                      },
                    ].map((row) => {
                      const pct =
                        liveSummary.totalRevenue > 0
                          ? Math.round((row.value / liveSummary.totalRevenue) * 100)
                          : 0;
                      return (
                        <div key={row.label} className="space-y-1.5">
                          <div className="flex justify-between text-xs font-medium">
                            <span className="text-slate-700 dark:text-slate-300">{row.label}</span>
                            <span className="font-mono-num font-bold text-slate-900 dark:text-slate-100">
                              {formatRupiah(row.value)} ({pct}%)
                            </span>
                          </div>
                          <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${row.barClass}`}
                              style={{ width: `${Math.max(pct, 2)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-500" aria-hidden="true" />
                        <span>Stok Menipis (Real-Time)</span>
                      </h2>
                      <button
                        type="button"
                        onClick={() => setActiveTab('inventory')}
                        className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                      >
                        Kelola Semua
                      </button>
                    </div>
                    {lowStockItems.length === 0 ? (
                      <p className="text-sm text-slate-500 py-6 text-center">
                        Semua stok produk berada di atas batas minimum.
                      </p>
                    ) : (
                      <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {lowStockItems.map((p) => (
                          <div key={p.id} className="py-2.5 flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                {p.name}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                                Sisa {p.stock} unit · Min {p.minStock} · {p.supplier}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                void handleQuickStock(p.id, 'Masuk', 10, 'Restock cepat dari dasbor')
                              }
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 cursor-pointer whitespace-nowrap"
                            >
                              +10 Stok
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: INVENTORY & ADD PRODUCT */}
            {activeTab === 'inventory' && (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-50">
                      Manajemen Inventaris &amp; Katalog
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                      Kelola harga modal, harga jual, margin otomatis, stok minimum, serta ekspor/impor Excel (CSV).
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleExportInventoryCsv}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-blue-400 cursor-pointer"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                      <span>Ekspor Excel (CSV)</span>
                    </button>

                    <label className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-blue-400 cursor-pointer">
                      <Upload className="w-4 h-4 text-blue-600" aria-hidden="true" />
                      <span>Impor CSV</span>
                      <input
                        type="file"
                        accept=".csv,text/csv"
                        onChange={(e) => void handleImportCsvFile(e)}
                        className="sr-only"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={openAddProduct}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-pink-600 to-blue-600 hover:from-pink-500 hover:to-blue-500 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" aria-hidden="true" />
                      <span>Tambah Barang</span>
                    </button>
                  </div>
                </div>

                {/* Search & Filter */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search
                      className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      type="search"
                      value={invSearch}
                      onChange={(e) => setInvSearch(e.target.value)}
                      placeholder="Cari SKU, nama produk, merek, atau supplier..."
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm"
                    />
                  </div>
                  <select
                    aria-label="Filter kategori inventaris"
                    value={invCategory}
                    onChange={(e) =>
                      setInvCategory(e.target.value as 'Semua' | ProductCategory)
                    }
                    className="px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm"
                  >
                    {PRODUCT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Dense Inventory Table */}
                <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-950/50">
                        <th className="py-3 px-4 font-semibold">Produk &amp; SKU</th>
                        <th className="py-3 px-3 font-semibold">Kategori</th>
                        <th className="py-3 px-3 font-semibold text-right">Modal</th>
                        <th className="py-3 px-3 font-semibold text-right">Harga Jual</th>
                        <th className="py-3 px-3 font-semibold text-right">Margin</th>
                        <th className="py-3 px-3 font-semibold text-center">Stok Real-Time</th>
                        <th className="py-3 px-4 font-semibold text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredProducts.map((p) => {
                        const margin = calculateMargin(p.costPrice, p.sellPrice);
                        const status = getStockStatus(p.stock, p.minStock);
                        return (
                          <tr
                            key={p.id}
                            className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                          >
                            <td className="py-3 px-4">
                              <p className="font-semibold text-slate-900 dark:text-slate-100">
                                {p.name}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                <span className="font-mono-num">{p.sku}</span> · {p.brand} ·{' '}
                                {p.variant}
                              </p>
                            </td>
                            <td className="py-3 px-3 text-xs text-slate-600 dark:text-slate-300">
                              {p.category}
                            </td>
                            <td className="py-3 px-3 text-right font-mono-num text-slate-600 dark:text-slate-300">
                              {formatRupiah(p.costPrice)}
                            </td>
                            <td className="py-3 px-3 text-right font-mono-num font-semibold text-slate-900 dark:text-slate-100">
                              {formatRupiah(p.sellPrice)}
                            </td>
                            <td className="py-3 px-3 text-right font-mono-num text-emerald-600 dark:text-emerald-400">
                              {margin.marginPercent}%
                            </td>
                            <td className="py-3 px-3">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  aria-label={`Kurangi stok ${p.name}`}
                                  onClick={() =>
                                    void handleQuickStock(p.id, 'Keluar', 1, 'Penyesuaian cepat -1')
                                  }
                                  className="w-6 h-6 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-mono-num text-xs cursor-pointer"
                                >
                                  -
                                </button>
                                <span
                                  className={`font-mono-num font-bold min-w-[40px] text-center ${
                                    status === 'Habis'
                                      ? 'text-rose-600'
                                      : status === 'Stok Menipis'
                                        ? 'text-amber-600'
                                        : 'text-slate-900 dark:text-slate-100'
                                  }`}
                                >
                                  {p.stock}
                                </span>
                                <button
                                  type="button"
                                  aria-label={`Tambah stok ${p.name}`}
                                  onClick={() =>
                                    void handleQuickStock(p.id, 'Masuk', 5, 'Restock cepat +5')
                                  }
                                  className="w-6 h-6 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-mono-num text-xs cursor-pointer"
                                >
                                  +
                                </button>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  aria-label={`Edit ${p.name}`}
                                  onClick={() => openEditProduct(p)}
                                  className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/50 text-blue-600 dark:text-blue-400 cursor-pointer"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  aria-label={`Hapus ${p.name}`}
                                  onClick={() => void handleDeleteProduct(p)}
                                  className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50 text-rose-600 dark:text-rose-400 cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 3: STOCK IN/OUT LEDGER */}
            {activeTab === 'ledger' && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-50">
                      Catatan Keluar Masuk Barang
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                      Riwayat pergerakan stok gudang secara real-time dengan jejak audit lengkap.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleExportLedgerCsv}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-blue-400 cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-blue-600" aria-hidden="true" />
                    <span>Ekspor Riwayat CSV</span>
                  </button>
                </div>

                {/* Record Stock Movement Form */}
                <form
                  onSubmit={handleManualLedgerSubmit}
                  className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 grid sm:grid-cols-12 gap-3 items-end"
                >
                  <div className="sm:col-span-4">
                    <label
                      htmlFor="ledger-product"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Pilih Produk
                    </label>
                    <select
                      id="ledger-product"
                      value={movProductId}
                      onChange={(e) => setMovProductId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm"
                    >
                      {data.products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} (Stok: {p.stock})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label
                      htmlFor="ledger-type"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Jenis
                    </label>
                    <select
                      id="ledger-type"
                      value={movType}
                      onChange={(e) => setMovType(e.target.value as StockMovementType)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm"
                    >
                      <option value="Masuk">Barang Masuk</option>
                      <option value="Keluar">Barang Keluar</option>
                      <option value="Penyesuaian">Stok Opname</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label
                      htmlFor="ledger-qty"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Jumlah
                    </label>
                    <input
                      id="ledger-qty"
                      type="number"
                      min={1}
                      required
                      value={movQty}
                      onChange={(e) => setMovQty(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-mono-num"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label
                      htmlFor="ledger-note"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Catatan
                    </label>
                    <input
                      id="ledger-note"
                      type="text"
                      value={movNote}
                      onChange={(e) => setMovNote(e.target.value)}
                      placeholder="Restock / Terjual"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <button
                      type="submit"
                      className="w-full py-2 px-3 rounded-xl text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-pink-600 to-blue-600 hover:from-pink-500 hover:to-blue-500 cursor-pointer"
                    >
                      Simpan Log
                    </button>
                  </div>
                </form>

                {/* Filter tabs */}
                <div className="flex items-center gap-2">
                  {(['Semua', 'Masuk', 'Keluar', 'Penyesuaian'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setLedgerFilter(t)}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                        ledgerFilter === t
                          ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                          : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                {/* Ledger Table */}
                <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                        <th className="py-3 px-4 font-semibold">Waktu</th>
                        <th className="py-3 px-3 font-semibold">Produk</th>
                        <th className="py-3 px-3 font-semibold">Jenis</th>
                        <th className="py-3 px-3 font-semibold text-right">Qty</th>
                        <th className="py-3 px-3 font-semibold text-right">Perubahan</th>
                        <th className="py-3 px-4 font-semibold">Keterangan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredLedger.map((m) => (
                        <tr key={m.id}>
                          <td className="py-3 px-4 font-mono-num text-xs text-slate-500">
                            {new Date(m.createdAt).toLocaleString('id-ID', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="py-3 px-3">
                            <p className="font-semibold text-slate-900 dark:text-slate-100">
                              {m.productName}
                            </p>
                            <p className="font-mono-num text-xs text-slate-500">{m.sku}</p>
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`text-xs font-semibold ${
                                m.type === 'Masuk'
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : m.type === 'Keluar'
                                    ? 'text-rose-600 dark:text-rose-400'
                                    : 'text-blue-600 dark:text-blue-400'
                              }`}
                            >
                              {m.type}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-mono-num font-bold">
                            {m.quantity}
                          </td>
                          <td className="py-3 px-3 text-right font-mono-num text-xs text-slate-600 dark:text-slate-300">
                            {m.previousStock} → {m.newStock}
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-300">
                            {m.note}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 4: ORDERS, MAP TRACKING & PROMO PUSH */}
            {activeTab === 'orders' && (
              <div className="space-y-6">
                <div>
                  <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-50">
                    Pemrosesan Pesanan, Antrian &amp; Notifikasi Push
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                    Setiap perubahan status pesanan atau pengiriman otomatis mengirimkan notifikasi
                    push ke pelanggan dan memperbarui koordinat peta kurir.
                  </p>
                </div>

                <div className="grid lg:grid-cols-12 gap-6">
                  <div className="lg:col-span-6 space-y-3">
                    {data.orders.map((order) => (
                      <div
                        key={order.id}
                        className={`p-4 rounded-2xl border bg-white dark:bg-slate-900 space-y-3 ${
                          activeOrderForMap?.id === order.id
                            ? 'border-pink-500'
                            : 'border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedOrderId(order.id)}
                            className="text-left cursor-pointer"
                          >
                            <span className="font-mono-num text-xs font-bold text-pink-600 dark:text-pink-400">
                              {order.queueNumber} · {order.id}
                            </span>
                            <h3 className="font-display font-bold text-sm text-slate-900 dark:text-slate-100">
                              {order.customerName} ({order.petNameOrBreed})
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {order.serviceName} · {order.deliveryMode}
                            </p>
                          </button>
                          <span className="font-mono-num text-sm font-bold text-slate-900 dark:text-slate-100">
                            {formatRupiah(order.totalAmount)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {order.paymentMethod} ({order.paymentStatus})
                          </span>
                          <select
                            aria-label={`Ubah status pesanan ${order.queueNumber}`}
                            value={order.status}
                            onChange={(e) =>
                              void handleUpdateOrderStatus(
                                order.id,
                                e.target.value as OrderStatus
                              )
                            }
                            className="px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs font-semibold"
                          >
                            {ORDER_STATUSES.map((st) => (
                              <option key={st} value={st}>
                                {st}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="lg:col-span-6 space-y-5">
                    {activeOrderForMap && (
                      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-900 dark:text-slate-100">
                            Peta Pengiriman: {activeOrderForMap.queueNumber}
                          </span>
                          <span className="text-blue-600 dark:text-blue-400 font-semibold">
                            {activeOrderForMap.status}
                          </span>
                        </div>
                        <GoogleMapsView
                          apiKey={mapsApiKey}
                          center={
                            activeOrderForMap.deliveryMode === 'Antar-Jemput Kurir'
                              ? activeOrderForMap.courierCoords
                              : activeOrderForMap.destinationCoords
                          }
                          zoom={13}
                          markers={orderMapMarkers}
                          routePoints={
                            activeOrderForMap.deliveryMode === 'Antar-Jemput Kurir'
                              ? orderMapMarkers.map((m) => m.position)
                              : []
                          }
                          heightClassName="h-[260px]"
                        />
                      </div>
                    )}

                    {/* Broadcast Store Promo Push */}
                    <form
                      onSubmit={handleBroadcastPromo}
                      className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3"
                    >
                      <div className="flex items-center gap-2">
                        <BellPlus className="w-4 h-4 text-pink-600" aria-hidden="true" />
                        <h2 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                          Kirim Push Notifikasi Promo Terbaru
                        </h2>
                      </div>
                      <input
                        type="text"
                        required
                        value={promoTitle}
                        onChange={(e) => setPromoTitle(e.target.value)}
                        placeholder="Judul promo (cth: Flash Diskon Akhir Pekan 20%)"
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm"
                      />
                      <textarea
                        rows={2}
                        required
                        value={promoMessage}
                        onChange={(e) => setPromoMessage(e.target.value)}
                        placeholder="Isi pesan promo untuk pelanggan..."
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm"
                      />
                      <button
                        type="submit"
                        className="w-full py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-pink-600 to-blue-600 hover:from-pink-500 hover:to-blue-500 cursor-pointer"
                      >
                        Kirim Promo ke Semua Pelanggan
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: MONTHLY FINANCIAL REPORT (PDF & EXCEL) */}
            {activeTab === 'finance' && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-50">
                      Laporan Keuangan Bulanan Otomatis
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                      Rekapitulasi otomatis pendapatan barang, jasa grooming, HPP modal, dan laba
                      bersih siap unduh PDF &amp; Excel.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="month"
                      aria-label="Periode bulan laporan keuangan"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-mono-num"
                    />
                    <button
                      type="button"
                      onClick={handleExportFinanceCsv}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-blue-400 cursor-pointer"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                      <span>Ekspor Excel (CSV)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        generateMonthlyFinancialPdf(
                          liveSummary,
                          data.orders,
                          data.products,
                          data.settings
                        )
                      }
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-pink-600 to-blue-600 hover:from-pink-500 hover:to-blue-500 cursor-pointer"
                    >
                      <FileText className="w-4 h-4" aria-hidden="true" />
                      <span>Unduh Laporan PDF</span>
                    </button>
                  </div>
                </div>

                {/* P&L Statement Card */}
                <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                    <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
                      Ikhtisar Laba Rugi · {liveSummary.monthLabel}
                    </h2>
                    <span className="font-mono-num text-xs text-slate-500">
                      {liveSummary.totalOrders} transaksi terverifikasi
                    </span>
                  </div>

                  <div className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                    {[
                      ['Pendapatan Jasa Grooming', formatRupiah(liveSummary.groomingRevenue), false],
                      ['Pendapatan Penjualan Produk', formatRupiah(liveSummary.productRevenue), false],
                      ['Pendapatan Pengiriman Kurir', formatRupiah(liveSummary.deliveryRevenue), false],
                      ['Total Pendapatan Kotor', formatRupiah(liveSummary.totalRevenue), true],
                      ['Harga Pokok Penjualan (Modal)', `(${formatRupiah(liveSummary.totalCogs)})`, false],
                      [
                        `Laba Kotor (Margin ${liveSummary.grossMarginPercent}%)`,
                        formatRupiah(liveSummary.grossProfit),
                        true,
                      ],
                      [
                        'Beban Operasional Bulanan',
                        `(${formatRupiah(liveSummary.operationalExpense)})`,
                        false,
                      ],
                      ['Laba / Rugi Bersih Periode Ini', formatRupiah(liveSummary.netProfit), true],
                    ].map(([label, val, bold]) => (
                      <div key={String(label)} className="py-3 flex items-center justify-between">
                        <span
                          className={
                            bold
                              ? 'font-bold text-slate-900 dark:text-slate-100'
                              : 'text-slate-600 dark:text-slate-300'
                          }
                        >
                          {label}
                        </span>
                        <span
                          className={`font-mono-num ${
                            bold
                              ? 'font-bold text-slate-900 dark:text-slate-50'
                              : 'text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          {val}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4 pt-2">
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        Nilai Aset Stok Gudang (Harga Modal)
                      </span>
                      <p className="font-mono-num text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">
                        {formatRupiah(liveSummary.inventoryValuationCost)}
                      </p>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        Potensi Nilai Jual Stok Gudang
                      </span>
                      <p className="font-mono-num text-lg font-bold text-blue-600 dark:text-blue-400 mt-1">
                        {formatRupiah(liveSummary.inventoryValuationRetail)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 6: STORE SETTINGS */}
            {activeTab === 'settings' && (
              <form
                onSubmit={handleSaveSettings}
                className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-5"
              >
                <div>
                  <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-50">
                    Pengaturan Profil &amp; Operasional Toko
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                    Sesuaikan informasi toko yang tampil di halaman pelanggan serta parameter biaya laporan.
                  </p>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="set-name"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Nama Toko
                    </label>
                    <input
                      id="set-name"
                      type="text"
                      value={sStoreName}
                      onChange={(e) => setSStoreName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-sm"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="set-wa"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                    >
                      No. WhatsApp Admin (Format 628...)
                    </label>
                    <input
                      id="set-wa"
                      type="text"
                      value={sWa}
                      onChange={(e) => setSWa(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-sm font-mono-num"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="set-tagline"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Tagline Toko
                  </label>
                  <input
                    id="set-tagline"
                    type="text"
                    value={sTagline}
                    onChange={(e) => setSTagline(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-sm"
                  />
                </div>

                <div className="grid sm:grid-cols-3 gap-4">
                  <div>
                    <label
                      htmlFor="set-hours"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Jam Operasional
                    </label>
                    <input
                      id="set-hours"
                      type="text"
                      value={sHours}
                      onChange={(e) => setSHours(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-sm"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="set-delivery-fee"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Tarif Kurir Antar-Jemput (Rp)
                    </label>
                    <input
                      id="set-delivery-fee"
                      type="number"
                      min={0}
                      value={sDeliveryFee}
                      onChange={(e) => setSDeliveryFee(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-sm font-mono-num"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="set-op-expense"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Beban Operasional / Bulan (Rp)
                    </label>
                    <input
                      id="set-op-expense"
                      type="number"
                      min={0}
                      value={sOpExpense}
                      onChange={(e) => setSOpExpense(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-sm font-mono-num"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="set-promo"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Teks Banner Promo Atas
                  </label>
                  <input
                    id="set-promo"
                    type="text"
                    value={sPromo}
                    onChange={(e) => setSPromo(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-sm"
                  />
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-pink-600 to-blue-600 hover:from-pink-500 hover:to-blue-500 cursor-pointer"
                  >
                    Simpan Pengaturan Toko
                  </button>
                </div>
              </form>
            )}
          </main>
        </div>
      </div>

      {/* Add / Edit Product Modal */}
      {showProductModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="product-form-title"
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <form
            onSubmit={handleSaveProduct}
            className="w-full max-w-xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
          >
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h2
                id="product-form-title"
                className="font-display text-lg font-bold text-slate-900 dark:text-slate-100"
              >
                {editingProduct ? 'Edit Produk Inventaris' : 'Tambah Barang Baru'}
              </h2>
              <button
                type="button"
                onClick={() => setShowProductModal(false)}
                aria-label="Tutup form produk"
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="prod-cat"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Kategori *
                  </label>
                  <select
                    id="prod-cat"
                    value={pCategory}
                    onChange={(e) => setPCategory(e.target.value as ProductCategory)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-sm"
                  >
                    {PRODUCT_CATEGORIES.filter((c) => c !== 'Semua').map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="prod-name"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Nama Produk *
                  </label>
                  <input
                    id="prod-name"
                    type="text"
                    required
                    value={pName}
                    onChange={(e) => setPName(e.target.value)}
                    placeholder="Contoh: Whiskas Junior Ocean Fish"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-sm"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="prod-brand"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Merek
                  </label>
                  <input
                    id="prod-brand"
                    type="text"
                    value={pBrand}
                    onChange={(e) => setPBrand(e.target.value)}
                    placeholder="Contoh: Whiskas / Umum"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-sm"
                  />
                </div>

                <div>
                  <label
                    htmlFor="prod-variant"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Ukuran / Varian
                  </label>
                  <input
                    id="prod-variant"
                    type="text"
                    value={pVariant}
                    onChange={(e) => setPVariant(e.target.value)}
                    placeholder="Contoh: 1,2 kg / 500 ml"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-sm"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="prod-cost"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Harga Modal (Rp) *
                  </label>
                  <input
                    id="prod-cost"
                    type="number"
                    min={0}
                    required
                    value={pCost}
                    onChange={(e) => setPCost(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-sm font-mono-num"
                  />
                </div>

                <div>
                  <label
                    htmlFor="prod-sell"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Harga Jual (Rp) *
                  </label>
                  <input
                    id="prod-sell"
                    type="number"
                    min={1}
                    required
                    value={pSell}
                    onChange={(e) => setPSell(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-sm font-mono-num"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-xs flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-300">Estimasi Margin Keuntungan</span>
                <span className="font-mono-num font-bold text-blue-700 dark:text-blue-300">
                  {formatRupiah(formMargin.marginAmount)} ({formMargin.marginPercent}%)
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {!editingProduct && (
                  <div>
                    <label
                      htmlFor="prod-stock"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Stok Awal
                    </label>
                    <input
                      id="prod-stock"
                      type="number"
                      min={0}
                      value={pStock}
                      onChange={(e) => setPStock(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-sm font-mono-num"
                    />
                  </div>
                )}
                <div>
                  <label
                    htmlFor="prod-min-stock"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Stok Minimum
                  </label>
                  <input
                    id="prod-min-stock"
                    type="number"
                    min={1}
                    value={pMinStock}
                    onChange={(e) => setPMinStock(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-sm font-mono-num"
                  />
                </div>
                <div className={editingProduct ? 'col-span-2' : ''}>
                  <label
                    htmlFor="prod-supplier"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Supplier
                  </label>
                  <input
                    id="prod-supplier"
                    type="text"
                    value={pSupplier}
                    onChange={(e) => setPSupplier(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-sm"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="prod-notes"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Keterangan Produk
                </label>
                <input
                  id="prod-notes"
                  type="text"
                  value={pNotes}
                  onChange={(e) => setPNotes(e.target.value)}
                  placeholder="Contoh: Makanan kering kucing dewasa"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-sm"
                />
              </div>
            </div>

            <div className="p-5 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowProductModal(false)}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-pink-600 to-blue-600 hover:from-pink-500 hover:to-blue-500 cursor-pointer"
              >
                {editingProduct ? 'Simpan Perubahan' : 'Simpan Barang'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
