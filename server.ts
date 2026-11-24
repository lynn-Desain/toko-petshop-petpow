import crypto from 'crypto';
import dotenv from 'dotenv';
import express, { type NextFunction, type Request, type Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  computeMonthlyFinancials,
  generateQueueNumber,
} from './src/lib/petshopLogic';
import type {
  OrderBooking,
  OrderStatus,
  PaymentMethod,
  Product,
  ProductCategory,
  PushNotification,
  StockMovement,
} from './src/lib/types';
import { loadDatabase, saveDatabase } from './server/store';

dotenv.config();

const PORT = Number(process.env.PORT || 3000);
const SESSION_SECRET =
  process.env.SESSION_SECRET && process.env.SESSION_SECRET.trim().length >= 16
    ? process.env.SESSION_SECRET.trim()
    : crypto.randomBytes(32).toString('hex');

const VALID_CATEGORIES: ProductCategory[] = [
  'Makanan Kucing',
  'Makanan Anjing',
  'Minuman & Susu',
  'Perawatan',
  'Aksesori',
  'Obat & Vitamin',
];

const VALID_STATUSES: OrderStatus[] = [
  'Menunggu Pembayaran',
  'Antrian Dikonfirmasi',
  'Sedang Diproses',
  'Kurir Menuju Lokasi',
  'Selesai',
  'Dibatalkan',
];

const VALID_PAYMENT_METHODS: PaymentMethod[] = [
  'QRIS',
  'Virtual Account',
  'E-Wallet',
  'Bayar di Toko',
];

// SSE Clients for real-time push notifications
const sseClients = new Set<Response>();

function broadcastNotification(notification: PushNotification): void {
  const payload = `event: notification\ndata: ${JSON.stringify(notification)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPasswordHash(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  const keyBuf = Buffer.from(keyHex, 'hex');
  const derivedBuf = crypto.scryptSync(password, salt, 64);
  if (keyBuf.length !== derivedBuf.length) return false;
  return crypto.timingSafeEqual(keyBuf, derivedBuf);
}

function safeCompareStrings(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function createAdminToken(): string {
  const exp = Date.now() + 1000 * 60 * 60 * 12; // 12 hours
  const payload = Buffer.from(JSON.stringify({ role: 'admin', exp })).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyAdminToken(token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payload, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payload)
    .digest('base64url');
  if (!safeCompareStrings(sig, expectedSig)) return false;
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as {
      role?: string;
      exp?: number;
    };
    return decoded.role === 'admin' && typeof decoded.exp === 'number' && decoded.exp > Date.now();
  } catch {
    return false;
  }
}

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token || !verifyAdminToken(token)) {
    res.status(401).json({ error: 'Sesi admin tidak valid atau sudah berakhir. Silakan login kembali.' });
    return;
  }
  next();
}

function sanitizePublicProduct(p: Product) {
  return {
    id: p.id,
    sku: p.sku,
    no: p.no,
    category: p.category,
    name: p.name,
    brand: p.brand,
    variant: p.variant,
    sellPrice: p.sellPrice,
    stock: p.stock,
    minStock: p.minStock,
    notes: p.notes,
    updatedAt: p.updatedAt,
  };
}

function sanitizePublicOrder(o: OrderBooking) {
  return {
    id: o.id,
    queueNumber: o.queueNumber,
    orderType: o.orderType,
    customerName: o.customerName,
    customerPhone: o.customerPhone,
    petType: o.petType,
    petNameOrBreed: o.petNameOrBreed,
    serviceName: o.serviceName,
    complaintOrNotes: o.complaintOrNotes,
    branchId: o.branchId,
    branchName: o.branchName,
    deliveryMode: o.deliveryMode,
    deliveryAddress: o.deliveryAddress,
    destinationCoords: o.destinationCoords,
    courierCoords: o.courierCoords,
    courierName: o.courierName,
    courierPhone: o.courierPhone,
    etaMinutes: o.etaMinutes,
    items: o.items.map((item) => ({
      productId: item.productId,
      name: item.name,
      quantity: item.quantity,
      sellPrice: item.sellPrice,
    })),
    serviceFee: o.serviceFee,
    deliveryFee: o.deliveryFee,
    totalAmount: o.totalAmount,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    channel: o.channel,
    status: o.status,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // Public runtime config (non-secret Maps browser key fallback)
  app.get('/api/public-config', (_req, res) => {
    const mapsApiKey =
      process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '';
    res.json({ mapsApiKey });
  });

  // Public storefront bootstrap (no login required)
  app.get('/api/bootstrap', (_req, res) => {
    const db = loadDatabase();
    res.json({
      settings: db.settings,
      branches: db.branches,
      groomingServices: db.groomingServices,
      products: db.products.map(sanitizePublicProduct),
      notifications: db.notifications.slice(0, 20),
      reviews: db.reviews,
      recentOrders: db.orders.slice(0, 12).map(sanitizePublicOrder),
    });
  });

  // SSE stream for real-time push notifications
  app.get('/api/notifications/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    sseClients.add(res);
    res.write(`event: connected\ndata: ${JSON.stringify({ ok: true })}\n\n`);

    const keepAlive = setInterval(() => {
      try {
        res.write(': ping\n\n');
      } catch {
        clearInterval(keepAlive);
        sseClients.delete(res);
      }
    }, 25000);

    req.on('close', () => {
      clearInterval(keepAlive);
      sseClients.delete(res);
    });
  });

  // Order history & tracking lookup (by phone, queue number, or order ID)
  app.get('/api/orders/lookup', (req, res) => {
    const query = String(req.query.query || '').trim().toLowerCase();
    const db = loadDatabase();
    const matched = query
      ? db.orders.filter(
          (o) =>
            o.queueNumber.toLowerCase().includes(query) ||
            o.id.toLowerCase().includes(query) ||
            o.customerPhone.toLowerCase().includes(query) ||
            o.customerName.toLowerCase().includes(query)
        )
      : db.orders.slice(0, 15);
    res.json({ orders: matched.map(sanitizePublicOrder) });
  });

  // Grooming registration + Payment Gateway checkout (or WhatsApp booking)
  app.post('/api/grooming/book', (req, res) => {
    const body = req.body as Record<string, unknown>;
    const customerName = String(body.customerName || '').trim();
    const customerPhone = String(body.customerPhone || '').trim();
    const petTypeRaw = String(body.petType || 'Kucing').trim();
    const petType =
      petTypeRaw === 'Anjing' || petTypeRaw === 'Lainnya' ? petTypeRaw : 'Kucing';
    const petNameOrBreed = String(body.petNameOrBreed || '').trim();
    const serviceId = String(body.serviceId || '').trim();
    const complaintOrNotes = String(body.complaintOrNotes || '').trim();
    const branchId = String(body.branchId || '').trim();
    const deliveryMode =
      body.deliveryMode === 'Antar-Jemput Kurir' ? 'Antar-Jemput Kurir' : 'Datang ke Toko';
    const deliveryAddress = String(body.deliveryAddress || '').trim();
    const channel = body.channel === 'WhatsApp' ? 'WhatsApp' : 'Web Payment Gateway';
    const paymentMethodRaw = String(body.paymentMethod || 'QRIS') as PaymentMethod;
    const paymentMethod: PaymentMethod = VALID_PAYMENT_METHODS.includes(paymentMethodRaw)
      ? paymentMethodRaw
      : 'QRIS';

    if (customerName.length < 2) {
      res.status(400).json({ error: 'Nama pelanggan wajib diisi minimal 2 karakter.' });
      return;
    }
    if (customerPhone.replace(/[^0-9]/g, '').length < 8) {
      res.status(400).json({ error: 'Nomor HP / WhatsApp tidak valid.' });
      return;
    }
    if (deliveryMode === 'Antar-Jemput Kurir' && deliveryAddress.length < 6) {
      res.status(400).json({ error: 'Alamat lengkap wajib diisi untuk layanan Antar-Jemput Kurir.' });
      return;
    }

    const db = loadDatabase();
    const service =
      db.groomingServices.find((s) => s.id === serviceId) || db.groomingServices[0];
    const branch = db.branches.find((b) => b.id === branchId) || db.branches[0];

    const nowIso = new Date().toISOString();
    const queueNumber = generateQueueNumber(db.orders, nowIso);
    const orderId = `ORD-${nowIso.slice(2, 4)}${nowIso.slice(5, 7)}-${String(
      db.orders.length + 1
    ).padStart(3, '0')}`;

    const serviceFee = service.price;
    const deliveryFee =
      deliveryMode === 'Antar-Jemput Kurir' ? db.settings.deliveryBaseFee : 0;
    const totalAmount = serviceFee + deliveryFee;

    // Derive nearby destination coords around branch for map visualization if courier chosen
    const destCoords =
      deliveryMode === 'Antar-Jemput Kurir'
        ? {
            lat: Number((branch.coords.lat - 0.012).toFixed(5)),
            lng: Number((branch.coords.lng - 0.008).toFixed(5)),
          }
        : { ...branch.coords };

    const courierCoords =
      deliveryMode === 'Antar-Jemput Kurir'
        ? {
            lat: Number((branch.coords.lat - 0.004).toFixed(5)),
            lng: Number((branch.coords.lng - 0.003).toFixed(5)),
          }
        : { ...branch.coords };

    const isPaidOnline = channel === 'Web Payment Gateway' && paymentMethod !== 'Bayar di Toko';
    const paymentStatus: OrderBooking['paymentStatus'] = isPaidOnline
      ? 'Lunas'
      : 'Bayar di Toko';
    const initialStatus: OrderStatus =
      deliveryMode === 'Antar-Jemput Kurir' && isPaidOnline
        ? 'Kurir Menuju Lokasi'
        : 'Antrian Dikonfirmasi';

    const newOrder: OrderBooking = {
      id: orderId,
      queueNumber,
      orderType: 'Grooming',
      customerName,
      customerPhone,
      petType,
      petNameOrBreed: petNameOrBreed || petType,
      serviceName: service.name,
      complaintOrNotes: complaintOrNotes || '-',
      branchId: branch.id,
      branchName: branch.name,
      deliveryMode,
      deliveryAddress:
        deliveryMode === 'Antar-Jemput Kurir' ? deliveryAddress : branch.address,
      destinationCoords: destCoords,
      courierCoords,
      courierName: deliveryMode === 'Antar-Jemput Kurir' ? 'Raka Pratama' : 'Tim Grooming Toko',
      courierPhone: branch.phone,
      etaMinutes: deliveryMode === 'Antar-Jemput Kurir' ? 18 : 0,
      items: [],
      serviceFee,
      deliveryFee,
      totalAmount,
      estimatedCost: Math.round(serviceFee * 0.35),
      paymentMethod: channel === 'WhatsApp' ? 'Bayar di Toko' : paymentMethod,
      paymentStatus,
      channel,
      status: initialStatus,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    db.orders.unshift(newOrder);

    const notif: PushNotification = {
      id: `notif-${Date.now()}`,
      kind: 'order_update',
      title: `Antrian Terdaftar · ${queueNumber}`,
      message: `${customerName} (${service.name}) berhasil terdaftar via ${channel}. Status: ${initialStatus}.`,
      orderId: newOrder.id,
      queueNumber: newOrder.queueNumber,
      createdAt: nowIso,
    };
    db.notifications.unshift(notif);
    saveDatabase(db);
    broadcastNotification(notif);

    res.status(201).json({ order: sanitizePublicOrder(newOrder), notification: notif });
  });

  // Customer Reviews
  app.post('/api/reviews', (req, res) => {
    const body = req.body as Record<string, unknown>;
    const customerName = String(body.customerName || '').trim();
    const petLabel = String(body.petLabel || '').trim();
    const serviceOrProduct = String(body.serviceOrProduct || '').trim();
    const ratingRaw = Number(body.rating);
    const comment = String(body.comment || '').trim();

    if (customerName.length < 2 || comment.length < 5) {
      res.status(400).json({ error: 'Nama dan isi ulasan minimal 5 karakter.' });
      return;
    }

    const rating = Math.min(5, Math.max(1, Math.round(Number.isFinite(ratingRaw) ? ratingRaw : 5)));
    const db = loadDatabase();
    const review = {
      id: `rev-${Date.now()}`,
      customerName,
      petLabel: petLabel || 'Pelanggan Petshop',
      serviceOrProduct: serviceOrProduct || 'Layanan & Produk Toko',
      rating,
      comment,
      createdAt: new Date().toISOString(),
    };
    db.reviews.unshift(review);
    saveDatabase(db);
    res.status(201).json({ review });
  });

  // Admin Auth Status, First-Run Bootstrap, and Login
  app.get('/api/admin/auth/status', (_req, res) => {
    const db = loadDatabase();
    const envPasscode = process.env.ADMIN_PASSCODE?.trim();
    const needsSetup = !envPasscode && !db.adminCredentialHash;
    res.json({
      needsSetup,
      envConfigured: Boolean(envPasscode),
    });
  });

  app.post('/api/admin/auth/bootstrap', (req, res) => {
    const envPasscode = process.env.ADMIN_PASSCODE?.trim();
    const db = loadDatabase();
    if (envPasscode || db.adminCredentialHash) {
      res.status(409).json({ error: 'Password admin sudah dikonfigurasi.' });
      return;
    }
    const password = String((req.body as Record<string, unknown>).password || '');
    if (password.length < 6) {
      res.status(400).json({ error: 'Password admin minimal 6 karakter.' });
      return;
    }
    db.adminCredentialHash = hashPassword(password);
    saveDatabase(db);
    const token = createAdminToken();
    res.json({ token });
  });

  app.post('/api/admin/auth/login', (req, res) => {
    const password = String((req.body as Record<string, unknown>).password || '');
    if (!password) {
      res.status(400).json({ error: 'Password wajib diisi.' });
      return;
    }

    const db = loadDatabase();
    const envPasscode = process.env.ADMIN_PASSCODE?.trim();

    if (envPasscode) {
      if (!safeCompareStrings(password, envPasscode)) {
        res.status(401).json({ error: 'Passcode admin salah.' });
        return;
      }
      res.json({ token: createAdminToken() });
      return;
    }

    if (!db.adminCredentialHash) {
      res.status(400).json({ error: 'Akun admin belum diaktifkan. Silakan atur password pertama.' });
      return;
    }

    if (!verifyPasswordHash(password, db.adminCredentialHash)) {
      res.status(401).json({ error: 'Password admin salah.' });
      return;
    }

    res.json({ token: createAdminToken() });
  });

  // Protected Admin Dashboard Payload
  app.get('/api/admin/dashboard', requireAdmin, (req, res) => {
    const db = loadDatabase();
    const monthKey =
      typeof req.query.month === 'string' && /^\d{4}-\d{2}$/.test(req.query.month)
        ? req.query.month
        : new Date().toISOString().slice(0, 7);

    const financialSummary = computeMonthlyFinancials(
      db.orders,
      db.products,
      monthKey,
      db.settings.monthlyOperationalExpense
    );

    res.json({
      settings: db.settings,
      branches: db.branches,
      products: db.products,
      stockMovements: db.stockMovements,
      orders: db.orders,
      notifications: db.notifications,
      financialSummary,
    });
  });

  // Admin: Add Product
  app.post('/api/admin/products', requireAdmin, (req, res) => {
    const body = req.body as Record<string, unknown>;
    const name = String(body.name || '').trim();
    const brand = String(body.brand || 'Umum').trim();
    const variant = String(body.variant || 'Standar').trim();
    const categoryRaw = String(body.category || 'Aksesori') as ProductCategory;
    const category = VALID_CATEGORIES.includes(categoryRaw) ? categoryRaw : 'Aksesori';
    const costPrice = Math.max(0, Math.round(Number(body.costPrice) || 0));
    const sellPrice = Math.max(0, Math.round(Number(body.sellPrice) || 0));
    const stock = Math.max(0, Math.round(Number(body.stock) || 0));
    const minStock = Math.max(1, Math.round(Number(body.minStock) || 5));
    const supplier = String(body.supplier || 'Supplier Utama').trim();
    const notes = String(body.notes || '').trim();

    if (name.length < 2 || sellPrice <= 0) {
      res.status(400).json({ error: 'Nama produk dan harga jual harus valid.' });
      return;
    }

    const db = loadDatabase();
    const nextNo = db.products.reduce((m, p) => Math.max(m, p.no), 0) + 1;
    const nowIso = new Date().toISOString();
    const newProduct: Product = {
      id: `prd-${Date.now()}`,
      sku: String(body.sku || `PET-${String(nextNo).padStart(3, '0')}`).trim(),
      no: nextNo,
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
      updatedAt: nowIso,
    };

    db.products.unshift(newProduct);

    if (stock > 0) {
      const movement: StockMovement = {
        id: `mov-${Date.now()}`,
        productId: newProduct.id,
        productName: newProduct.name,
        sku: newProduct.sku,
        type: 'Masuk',
        quantity: stock,
        previousStock: 0,
        newStock: stock,
        unitCost: costPrice,
        note: `Stok awal produk baru dari ${supplier}`,
        actor: 'Admin Toko',
        createdAt: nowIso,
      };
      db.stockMovements.unshift(movement);
    }

    saveDatabase(db);
    res.status(201).json({ product: newProduct });
  });

  // Admin: Update Product
  app.patch('/api/admin/products/:id', requireAdmin, (req, res) => {
    const db = loadDatabase();
    const idx = db.products.findIndex((p) => p.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Produk tidak ditemukan.' });
      return;
    }
    const existing = db.products[idx];
    const body = req.body as Record<string, unknown>;
    const nowIso = new Date().toISOString();

    const updated: Product = {
      ...existing,
      name: typeof body.name === 'string' && body.name.trim() ? body.name.trim() : existing.name,
      brand: typeof body.brand === 'string' && body.brand.trim() ? body.brand.trim() : existing.brand,
      variant:
        typeof body.variant === 'string' && body.variant.trim() ? body.variant.trim() : existing.variant,
      category:
        typeof body.category === 'string' && VALID_CATEGORIES.includes(body.category as ProductCategory)
          ? (body.category as ProductCategory)
          : existing.category,
      costPrice:
        body.costPrice !== undefined ? Math.max(0, Math.round(Number(body.costPrice))) : existing.costPrice,
      sellPrice:
        body.sellPrice !== undefined ? Math.max(0, Math.round(Number(body.sellPrice))) : existing.sellPrice,
      minStock:
        body.minStock !== undefined ? Math.max(1, Math.round(Number(body.minStock))) : existing.minStock,
      supplier:
        typeof body.supplier === 'string' && body.supplier.trim()
          ? body.supplier.trim()
          : existing.supplier,
      notes: typeof body.notes === 'string' ? body.notes.trim() : existing.notes,
      updatedAt: nowIso,
    };

    db.products[idx] = updated;
    saveDatabase(db);
    res.json({ product: updated });
  });

  // Admin: Delete Product
  app.delete('/api/admin/products/:id', requireAdmin, (req, res) => {
    const db = loadDatabase();
    const exists = db.products.some((p) => p.id === req.params.id);
    if (!exists) {
      res.status(404).json({ error: 'Produk tidak ditemukan.' });
      return;
    }
    db.products = db.products.filter((p) => p.id !== req.params.id);
    saveDatabase(db);
    res.json({ ok: true });
  });

  // Admin: Import CSV Products
  app.post('/api/admin/products/import', requireAdmin, (req, res) => {
    const items = Array.isArray((req.body as Record<string, unknown>).items)
      ? ((req.body as Record<string, unknown>).items as Array<Record<string, unknown>>)
      : [];
    if (items.length === 0) {
      res.status(400).json({ error: 'Tidak ada baris produk yang valid untuk diimpor.' });
      return;
    }
    const db = loadDatabase();
    const nowIso = new Date().toISOString();
    let nextNo = db.products.reduce((m, p) => Math.max(m, p.no), 0) + 1;
    const added: Product[] = [];

    for (const raw of items) {
      const name = String(raw.name || '').trim();
      if (!name) continue;
      const categoryRaw = String(raw.category || 'Aksesori') as ProductCategory;
      const category = VALID_CATEGORIES.includes(categoryRaw) ? categoryRaw : 'Aksesori';
      const product: Product = {
        id: `prd-${Date.now()}-${nextNo}`,
        sku: `PET-${String(nextNo).padStart(3, '0')}`,
        no: nextNo,
        category,
        name,
        brand: String(raw.brand || 'Umum').trim(),
        variant: String(raw.variant || 'Standar').trim(),
        costPrice: Math.max(0, Math.round(Number(raw.costPrice) || 0)),
        sellPrice: Math.max(0, Math.round(Number(raw.sellPrice) || 0)),
        stock: Math.max(0, Math.round(Number(raw.stock) || 0)),
        minStock: Math.max(1, Math.round(Number(raw.minStock) || 5)),
        supplier: String(raw.supplier || 'Impor CSV').trim(),
        notes: String(raw.notes || '').trim(),
        updatedAt: nowIso,
      };
      nextNo += 1;
      db.products.unshift(product);
      added.push(product);
    }

    saveDatabase(db);
    res.status(201).json({ importedCount: added.length, products: added });
  });

  // Admin: Record Stock Movement (Masuk / Keluar / Penyesuaian)
  app.post('/api/admin/stock-movements', requireAdmin, (req, res) => {
    const body = req.body as Record<string, unknown>;
    const productId = String(body.productId || '').trim();
    const type =
      body.type === 'Keluar' || body.type === 'Penyesuaian' ? body.type : 'Masuk';
    const quantity = Math.round(Number(body.quantity) || 0);
    const note = String(body.note || '').trim();

    if (!productId || quantity <= 0) {
      res.status(400).json({ error: 'Pilih produk dan masukkan jumlah stok minimal 1.' });
      return;
    }

    const db = loadDatabase();
    const idx = db.products.findIndex((p) => p.id === productId);
    if (idx === -1) {
      res.status(404).json({ error: 'Produk tidak ditemukan.' });
      return;
    }

    const product = db.products[idx];
    const previousStock = product.stock;
    let newStock = previousStock;

    if (type === 'Masuk') {
      newStock = previousStock + quantity;
    } else if (type === 'Keluar') {
      newStock = Math.max(0, previousStock - quantity);
    } else {
      newStock = Math.max(0, quantity);
    }

    const nowIso = new Date().toISOString();
    db.products[idx] = { ...product, stock: newStock, updatedAt: nowIso };

    const movement: StockMovement = {
      id: `mov-${Date.now()}`,
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      type,
      quantity,
      previousStock,
      newStock,
      unitCost: product.costPrice,
      note: note || `Catatan ${type.toLowerCase()} oleh Admin`,
      actor: 'Admin Toko',
      createdAt: nowIso,
    };

    db.stockMovements.unshift(movement);
    saveDatabase(db);
    res.status(201).json({ product: db.products[idx], movement });
  });

  // Admin: Update Order Status & Courier Map Coordinates (triggers real-time Push Notification)
  app.patch('/api/admin/orders/:id', requireAdmin, (req, res) => {
    const db = loadDatabase();
    const idx = db.orders.findIndex((o) => o.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
      return;
    }

    const existing = db.orders[idx];
    const body = req.body as Record<string, unknown>;
    const statusRaw = String(body.status || existing.status) as OrderStatus;
    const status = VALID_STATUSES.includes(statusRaw) ? statusRaw : existing.status;
    const nowIso = new Date().toISOString();

    let courierCoords = existing.courierCoords;
    if (
      body.courierCoords &&
      typeof body.courierCoords === 'object' &&
      typeof (body.courierCoords as Record<string, unknown>).lat === 'number' &&
      typeof (body.courierCoords as Record<string, unknown>).lng === 'number'
    ) {
      courierCoords = {
        lat: (body.courierCoords as { lat: number }).lat,
        lng: (body.courierCoords as { lng: number }).lng,
      };
    } else if (status === 'Kurir Menuju Lokasi') {
      // Advance courier halfway closer to destination for real-time tracking
      courierCoords = {
        lat: Number(((existing.courierCoords.lat + existing.destinationCoords.lat) / 2).toFixed(5)),
        lng: Number(((existing.courierCoords.lng + existing.destinationCoords.lng) / 2).toFixed(5)),
      };
    } else if (status === 'Selesai') {
      courierCoords = { ...existing.destinationCoords };
    }

    const etaMinutes =
      body.etaMinutes !== undefined
        ? Math.max(0, Math.round(Number(body.etaMinutes)))
        : status === 'Selesai'
          ? 0
          : status === 'Kurir Menuju Lokasi'
            ? Math.max(3, existing.etaMinutes - 5)
            : existing.etaMinutes;

    const paymentStatus =
      status === 'Selesai' && existing.paymentStatus === 'Bayar di Toko'
        ? 'Lunas'
        : existing.paymentStatus;

    const updatedOrder: OrderBooking = {
      ...existing,
      status,
      courierCoords,
      etaMinutes,
      paymentStatus,
      updatedAt: nowIso,
    };

    db.orders[idx] = updatedOrder;

    const notif: PushNotification = {
      id: `notif-${Date.now()}`,
      kind: 'order_update',
      title: `Update ${updatedOrder.queueNumber}: ${status}`,
      message:
        status === 'Kurir Menuju Lokasi'
          ? `Kurir ${updatedOrder.courierName} sedang menuju lokasi pengantaran (${etaMinutes} mnt).`
          : `Status pesanan ${updatedOrder.customerName} (${updatedOrder.serviceName}) kini: ${status}.`,
      orderId: updatedOrder.id,
      queueNumber: updatedOrder.queueNumber,
      createdAt: nowIso,
    };
    db.notifications.unshift(notif);
    saveDatabase(db);
    broadcastNotification(notif);

    res.json({ order: updatedOrder, notification: notif });
  });

  // Admin: Broadcast Promo Push Notification
  app.post('/api/admin/promos', requireAdmin, (req, res) => {
    const body = req.body as Record<string, unknown>;
    const title = String(body.title || '').trim();
    const message = String(body.message || '').trim();

    if (title.length < 3 || message.length < 5) {
      res.status(400).json({ error: 'Judul dan isi promo wajib diisi.' });
      return;
    }

    const db = loadDatabase();
    const notif: PushNotification = {
      id: `notif-${Date.now()}`,
      kind: 'promo',
      title,
      message,
      createdAt: new Date().toISOString(),
    };
    db.notifications.unshift(notif);
    db.settings.promoBannerText = `${title}: ${message}`;
    saveDatabase(db);
    broadcastNotification(notif);

    res.status(201).json({ notification: notif, settings: db.settings });
  });

  // Admin: Update Store Settings
  app.patch('/api/admin/settings', requireAdmin, (req, res) => {
    const body = req.body as Record<string, unknown>;
    const db = loadDatabase();
    db.settings = {
      ...db.settings,
      storeName:
        typeof body.storeName === 'string' && body.storeName.trim()
          ? body.storeName.trim()
          : db.settings.storeName,
      tagline:
        typeof body.tagline === 'string' && body.tagline.trim()
          ? body.tagline.trim()
          : db.settings.tagline,
      whatsappNumber:
        typeof body.whatsappNumber === 'string' && body.whatsappNumber.trim()
          ? body.whatsappNumber.trim()
          : db.settings.whatsappNumber,
      operatingHours:
        typeof body.operatingHours === 'string' && body.operatingHours.trim()
          ? body.operatingHours.trim()
          : db.settings.operatingHours,
      promoBannerText:
        typeof body.promoBannerText === 'string'
          ? body.promoBannerText.trim()
          : db.settings.promoBannerText,
      monthlyOperationalExpense:
        body.monthlyOperationalExpense !== undefined
          ? Math.max(0, Math.round(Number(body.monthlyOperationalExpense)))
          : db.settings.monthlyOperationalExpense,
      deliveryBaseFee:
        body.deliveryBaseFee !== undefined
          ? Math.max(0, Math.round(Number(body.deliveryBaseFee)))
          : db.settings.deliveryBaseFee,
    };
    saveDatabase(db);
    res.json({ settings: db.settings });
  });

  // Vite middleware in development, static files in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Pet — Dogs & Cats server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
