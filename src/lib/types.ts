export type ProductCategory =
  | 'Makanan Kucing'
  | 'Makanan Anjing'
  | 'Minuman & Susu'
  | 'Perawatan'
  | 'Aksesori'
  | 'Obat & Vitamin';

export type StockStatus = 'Tersedia' | 'Stok Menipis' | 'Habis';

export interface Product {
  id: string;
  sku: string;
  no: number;
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
  updatedAt: string;
}

export type StockMovementType = 'Masuk' | 'Keluar' | 'Penyesuaian';

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  type: StockMovementType;
  quantity: number;
  previousStock: number;
  newStock: number;
  unitCost: number;
  note: string;
  actor: string;
  createdAt: string;
}

export type OrderType = 'Grooming' | 'Produk & Pengiriman';

export type OrderStatus =
  | 'Menunggu Pembayaran'
  | 'Antrian Dikonfirmasi'
  | 'Sedang Diproses'
  | 'Kurir Menuju Lokasi'
  | 'Selesai'
  | 'Dibatalkan';

export type PaymentMethod = 'QRIS' | 'Virtual Account' | 'E-Wallet' | 'Bayar di Toko';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface GroomingServiceOption {
  id: string;
  name: string;
  petType: 'Kucing' | 'Anjing' | 'Kucing & Anjing';
  durationMinutes: number;
  price: number;
  description: string;
}

export interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  sellPrice: number;
  costPrice: number;
}

export interface OrderBooking {
  id: string;
  queueNumber: string;
  orderType: OrderType;
  customerName: string;
  customerPhone: string;
  petType: 'Kucing' | 'Anjing' | 'Lainnya';
  petNameOrBreed: string;
  serviceName: string;
  complaintOrNotes: string;
  branchId: string;
  branchName: string;
  deliveryMode: 'Datang ke Toko' | 'Antar-Jemput Kurir';
  deliveryAddress: string;
  destinationCoords: LatLng;
  courierCoords: LatLng;
  courierName: string;
  courierPhone: string;
  etaMinutes: number;
  items: OrderItem[];
  serviceFee: number;
  deliveryFee: number;
  totalAmount: number;
  estimatedCost: number;
  paymentMethod: PaymentMethod;
  paymentStatus: 'Lunas' | 'Menunggu' | 'Bayar di Toko';
  channel: 'Web Payment Gateway' | 'WhatsApp';
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PushNotification {
  id: string;
  kind: 'promo' | 'order_update' | 'stock_alert';
  title: string;
  message: string;
  orderId?: string;
  queueNumber?: string;
  createdAt: string;
}

export interface CustomerReview {
  id: string;
  customerName: string;
  petLabel: string;
  serviceOrProduct: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface StoreBranch {
  id: string;
  name: string;
  district: string;
  address: string;
  phone: string;
  hours: string;
  coords: LatLng;
  distanceKm?: number;
}

export interface StoreSettings {
  storeName: string;
  tagline: string;
  whatsappNumber: string;
  operatingHours: string;
  promoBannerText: string;
  vetDisclaimer: string;
  monthlyOperationalExpense: number;
  deliveryBaseFee: number;
}

export interface MonthlyFinancialSummary {
  monthKey: string;
  monthLabel: string;
  totalOrders: number;
  groomingOrders: number;
  productOrders: number;
  groomingRevenue: number;
  productRevenue: number;
  deliveryRevenue: number;
  totalRevenue: number;
  totalCogs: number;
  grossProfit: number;
  operationalExpense: number;
  netProfit: number;
  grossMarginPercent: number;
  inventoryValuationCost: number;
  inventoryValuationRetail: number;
}

export interface StoreDatabase {
  adminCredentialHash: string | null;
  settings: StoreSettings;
  branches: StoreBranch[];
  groomingServices: GroomingServiceOption[];
  products: Product[];
  stockMovements: StockMovement[];
  orders: OrderBooking[];
  notifications: PushNotification[];
  reviews: CustomerReview[];
}
