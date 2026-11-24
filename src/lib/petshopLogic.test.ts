import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWhatsAppGroomingUrl,
  calculateDistanceKm,
  calculateMargin,
  computeMonthlyFinancials,
  filterProducts,
  findNearestBranches,
  generateQueueNumber,
  getStockStatus,
  parseInventoryCsv,
  serializeToCsv,
} from './petshopLogic';
import { createSeedDatabase } from './seedData';

test('seed database includes all 23 PDF items plus Obat & Vitamin category', () => {
  const db = createSeedDatabase();
  assert.ok(db.products.length >= 26);
  const whiskas = db.products.find((p) => p.name === 'Whiskas Adult Tuna');
  assert.ok(whiskas);
  assert.equal(whiskas.sellPrice, 30900);
  assert.equal(whiskas.variant, '480 gram');

  const natureBridge = db.products.find((p) => p.name === 'Nature Bridge Puppy');
  assert.ok(natureBridge);
  assert.equal(natureBridge.sellPrice, 550000);

  const vetItems = db.products.filter((p) => p.category === 'Obat & Vitamin');
  assert.ok(vetItems.length >= 3);
});

test('calculateMargin computes profit amount and percentage accurately', () => {
  const { marginAmount, marginPercent } = calculateMargin(75000, 100000);
  assert.equal(marginAmount, 25000);
  assert.equal(marginPercent, 25);
});

test('getStockStatus returns correct threshold labels', () => {
  assert.equal(getStockStatus(0, 5), 'Habis');
  assert.equal(getStockStatus(4, 5), 'Stok Menipis');
  assert.equal(getStockStatus(12, 5), 'Tersedia');
});

test('filterProducts matches search query and category', () => {
  const db = createSeedDatabase();
  const catOnly = filterProducts(db.products, '', 'Makanan Kucing');
  assert.equal(catOnly.length, 4);

  const searchMilk = filterProducts(db.products, 'goat milk', 'Semua');
  assert.equal(searchMilk.length, 1);
  assert.equal(searchMilk[0].name, 'Papillon Goat Milk');
});

test('calculateDistanceKm and findNearestBranches sort branches by proximity', () => {
  const db = createSeedDatabase();
  // User near Kemang (-6.261, 106.814)
  const sorted = findNearestBranches(db.branches, -6.261, 106.814);
  assert.equal(sorted[0].id, 'branch-jaksel');
  assert.ok((sorted[0].distanceKm ?? 999) < 1);
  assert.ok(calculateDistanceKm(-6.2607, 106.8142, -6.1882, 106.7375) > 5);
});

test('generateQueueNumber increments sequentially without duplicates', () => {
  const db = createSeedDatabase();
  const nextQueue = generateQueueNumber(db.orders, '2026-11-24T09:00:00.000Z');
  assert.equal(nextQueue, 'ANT-005');
});

test('computeMonthlyFinancials aggregates revenue, COGS, and net profit', () => {
  const db = createSeedDatabase();
  const report = computeMonthlyFinancials(
    db.orders,
    db.products,
    '2026-11',
    db.settings.monthlyOperationalExpense
  );
  assert.equal(report.totalOrders, 4);
  assert.ok(report.totalRevenue > report.totalCogs);
  assert.equal(report.grossProfit, report.totalRevenue - report.totalCogs);
  assert.equal(report.netProfit, report.grossProfit - db.settings.monthlyOperationalExpense);
});

test('buildWhatsAppGroomingUrl produces valid encoded wa.me link', () => {
  const url = buildWhatsAppGroomingUrl('62812-9988-7766', {
    customerName: 'Ayu Lestari',
    customerPhone: '08123456789',
    petType: 'Kucing',
    petNameOrBreed: 'Luna',
    serviceName: 'Mandi Sehat Kucing',
    complaintOrNotes: 'Takut hairdryer keras',
    branchName: 'Pet Kemang',
    deliveryMode: 'Datang ke Toko',
    queueNumber: 'ANT-004',
  });
  assert.ok(url.startsWith('https://wa.me/6281299887766?text='));
  assert.ok(decodeURIComponent(url).includes('ANT-004'));
  assert.ok(decodeURIComponent(url).includes('Ayu Lestari'));
});

test('serializeToCsv and parseInventoryCsv round-trip cleanly with Excel BOM', () => {
  const csv = serializeToCsv(
    ['Kategori', 'Nama Produk', 'Merek', 'Varian', 'Harga Jual', 'Harga Modal', 'Stok', 'Stok Min', 'Supplier', 'Keterangan'],
    [['Makanan Kucing', 'Pro Plan Adult', 'Purina', '1.5 kg', 185000, 145000, 12, 4, 'PT Nestle', 'Kibble salmon']]
  );
  assert.ok(csv.startsWith('\uFEFF'));
  const parsed = parseInventoryCsv(csv);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].name, 'Pro Plan Adult');
  assert.equal(parsed[0].sellPrice, 185000);
  assert.equal(parsed[0].costPrice, 145000);
  assert.equal(parsed[0].stock, 12);
});
