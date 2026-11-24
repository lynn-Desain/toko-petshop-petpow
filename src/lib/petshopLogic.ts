import type {
  MonthlyFinancialSummary,
  OrderBooking,
  Product,
  ProductCategory,
  StockStatus,
  StoreBranch,
} from './types';

export const PRODUCT_CATEGORIES: Array<'Semua' | ProductCategory> = [
  'Semua',
  'Makanan Kucing',
  'Makanan Anjing',
  'Minuman & Susu',
  'Perawatan',
  'Aksesori',
  'Obat & Vitamin',
];

export function formatRupiah(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.round(amount) : 0;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(safe);
}

export function calculateMargin(costPrice: number, sellPrice: number): {
  marginAmount: number;
  marginPercent: number;
} {
  const safeCost = Math.max(0, Number(costPrice) || 0);
  const safeSell = Math.max(0, Number(sellPrice) || 0);
  const marginAmount = safeSell - safeCost;
  const marginPercent = safeSell > 0 ? Math.round((marginAmount / safeSell) * 1000) / 10 : 0;
  return { marginAmount, marginPercent };
}

export function getStockStatus(stock: number, minStock: number): StockStatus {
  if (stock <= 0) return 'Habis';
  if (stock <= minStock) return 'Stok Menipis';
  return 'Tersedia';
}

export function filterProducts(
  products: Product[],
  query: string,
  category: 'Semua' | ProductCategory
): Product[] {
  const q = query.trim().toLowerCase();
  return products.filter((item) => {
    const matchesCategory = category === 'Semua' || item.category === category;
    if (!matchesCategory) return false;
    if (!q) return true;
    return (
      item.name.toLowerCase().includes(q) ||
      item.brand.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      item.variant.toLowerCase().includes(q) ||
      item.notes.toLowerCase().includes(q) ||
      item.sku.toLowerCase().includes(q)
    );
  });
}

export function calculateDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

export function findNearestBranches(
  branches: StoreBranch[],
  userLat: number,
  userLng: number
): StoreBranch[] {
  return branches
    .map((branch) => ({
      ...branch,
      distanceKm: calculateDistanceKm(userLat, userLng, branch.coords.lat, branch.coords.lng),
    }))
    .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
}

export function generateQueueNumber(existingOrders: OrderBooking[], _dateIso?: string): string {
  const maxNum = existingOrders.reduce((max, order) => {
    const match = order.queueNumber.match(/ANT-(\d+)/);
    if (!match) return max;
    const val = Number.parseInt(match[1], 10);
    return Number.isFinite(val) ? Math.max(max, val) : max;
  }, 0);
  const next = maxNum + 1;
  return `ANT-${String(next).padStart(3, '0')}`;
}

export function buildWhatsAppGroomingUrl(
  whatsappNumber: string,
  booking: {
    customerName: string;
    customerPhone: string;
    petType: string;
    petNameOrBreed: string;
    serviceName: string;
    complaintOrNotes: string;
    branchName: string;
    deliveryMode: string;
    deliveryAddress?: string;
    queueNumber?: string;
  }
): string {
  const cleanPhone = whatsappNumber.replace(/[^0-9]/g, '');
  const lines = [
    'Halo Admin Pet — Dogs & Cats, saya ingin mendaftar layanan Grooming:',
    booking.queueNumber ? `No. Antrian: ${booking.queueNumber}` : null,
    `Nama Pelanggan: ${booking.customerName}`,
    `No. HP/WA: ${booking.customerPhone}`,
    `Jenis Hewan: ${booking.petType}${booking.petNameOrBreed ? ` (${booking.petNameOrBreed})` : ''}`,
    `Layanan: ${booking.serviceName}`,
    `Cabang Toko: ${booking.branchName}`,
    `Metode: ${booking.deliveryMode}`,
    booking.deliveryAddress ? `Alamat Antar-Jemput: ${booking.deliveryAddress}` : null,
    `Keluhan / Catatan: ${booking.complaintOrNotes || '-'}`,
  ].filter(Boolean);

  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(lines.join('\n'))}`;
}

export function buildWhatsAppProductUrl(
  whatsappNumber: string,
  product: Pick<Product, 'name' | 'brand' | 'variant' | 'sellPrice' | 'stock'>
): string {
  const cleanPhone = whatsappNumber.replace(/[^0-9]/g, '');
  const message = [
    'Halo Admin Pet — Dogs & Cats, saya tertarik menanyakan stok/pemesanan produk:',
    `Produk: ${product.name} (${product.brand} - ${product.variant})`,
    `Harga Katalog: ${formatRupiah(product.sellPrice)}`,
    `Status Ketersediaan: ${product.stock > 0 ? `Tersedia (${product.stock} unit)` : 'Stok Habis'}`,
  ].join('\n');
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

const MONTH_NAMES_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

export function formatMonthLabel(monthKey: string): string {
  const [yearStr, monthStr] = monthKey.split('-');
  const monthIdx = Number.parseInt(monthStr, 10) - 1;
  if (!yearStr || monthIdx < 0 || monthIdx > 11) return monthKey;
  return `${MONTH_NAMES_ID[monthIdx]} ${yearStr}`;
}

export function computeMonthlyFinancials(
  orders: OrderBooking[],
  products: Product[],
  monthKey: string,
  operationalExpense: number
): MonthlyFinancialSummary {
  const monthOrders = orders.filter(
    (o) =>
      o.createdAt.slice(0, 7) === monthKey &&
      o.status !== 'Dibatalkan' &&
      (o.paymentStatus === 'Lunas' || o.status === 'Selesai' || o.paymentStatus === 'Bayar di Toko')
  );

  let groomingRevenue = 0;
  let productRevenue = 0;
  let deliveryRevenue = 0;
  let totalCogs = 0;
  let groomingOrders = 0;
  let productOrders = 0;

  for (const order of monthOrders) {
    if (order.orderType === 'Grooming') {
      groomingOrders += 1;
      groomingRevenue += order.serviceFee;
    } else {
      productOrders += 1;
    }
    const itemsRevenue = order.items.reduce(
      (sum, item) => sum + item.sellPrice * item.quantity,
      0
    );
    const itemsCost = order.items.reduce(
      (sum, item) => sum + item.costPrice * item.quantity,
      0
    );
    productRevenue += itemsRevenue;
    deliveryRevenue += order.deliveryFee;
    totalCogs += itemsCost > 0 ? itemsCost : order.estimatedCost;
  }

  const totalRevenue = groomingRevenue + productRevenue + deliveryRevenue;
  const grossProfit = totalRevenue - totalCogs;
  const netProfit = grossProfit - operationalExpense;
  const grossMarginPercent =
    totalRevenue > 0 ? Math.round((grossProfit / totalRevenue) * 1000) / 10 : 0;

  const inventoryValuationCost = products.reduce(
    (sum, p) => sum + Math.max(0, p.stock) * p.costPrice,
    0
  );
  const inventoryValuationRetail = products.reduce(
    (sum, p) => sum + Math.max(0, p.stock) * p.sellPrice,
    0
  );

  return {
    monthKey,
    monthLabel: formatMonthLabel(monthKey),
    totalOrders: monthOrders.length,
    groomingOrders,
    productOrders,
    groomingRevenue,
    productRevenue,
    deliveryRevenue,
    totalRevenue,
    totalCogs,
    grossProfit,
    operationalExpense,
    netProfit,
    grossMarginPercent,
    inventoryValuationCost,
    inventoryValuationRetail,
  };
}

export function serializeToCsv(
  headers: string[],
  rows: Array<Array<string | number | boolean | null | undefined>>
): string {
  const escapeCell = (val: string | number | boolean | null | undefined): string => {
    const str = val === null || val === undefined ? '' : String(val);
    if (/[",\n\r;]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [
    headers.map(escapeCell).join(','),
    ...rows.map((row) => row.map(escapeCell).join(',')),
  ];
  // UTF-8 BOM for clean Excel opening
  return '\uFEFF' + lines.join('\r\n');
}

export function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

export function parseInventoryCsv(csvText: string): Array<{
  category: ProductCategory;
  name: string;
  brand: string;
  variant: string;
  costPrice: number;
  sellPrice: number;
  stock: number;
  minStock: number;
  supplier: string;
  notes: string;
}> {
  const cleaned = csvText.replace(/^\uFEFF/, '').trim();
  if (!cleaned) return [];
  const lines = cleaned.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const validCategories: ProductCategory[] = [
    'Makanan Kucing',
    'Makanan Anjing',
    'Minuman & Susu',
    'Perawatan',
    'Aksesori',
    'Obat & Vitamin',
  ];

  const items: Array<{
    category: ProductCategory;
    name: string;
    brand: string;
    variant: string;
    costPrice: number;
    sellPrice: number;
    stock: number;
    minStock: number;
    supplier: string;
    notes: string;
  }> = [];

  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length < 4) continue;
    const rawCat = cols[0] as ProductCategory;
    const category = validCategories.includes(rawCat) ? rawCat : 'Aksesori';
    const name = cols[1] || 'Produk Baru';
    const brand = cols[2] || 'Umum';
    const variant = cols[3] || 'Standar';
    const sellPrice = Math.max(0, Number(cols[4]?.replace(/[^0-9.-]/g, '')) || 0);
    const costPrice = Math.max(
      0,
      Number(cols[5]?.replace(/[^0-9.-]/g, '')) || Math.round(sellPrice * 0.72)
    );
    const stock = Math.max(0, Math.round(Number(cols[6]?.replace(/[^0-9.-]/g, '')) || 10));
    const minStock = Math.max(1, Math.round(Number(cols[7]?.replace(/[^0-9.-]/g, '')) || 5));
    const supplier = cols[8] || 'Supplier Utama';
    const notes = cols[9] || '';

    items.push({
      category,
      name,
      brand,
      variant,
      costPrice,
      sellPrice,
      stock,
      minStock,
      supplier,
      notes,
    });
  }

  return items;
}
