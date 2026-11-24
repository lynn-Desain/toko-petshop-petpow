import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatRupiah } from '../lib/petshopLogic';
import type {
  MonthlyFinancialSummary,
  OrderBooking,
  Product,
  StoreSettings,
} from '../lib/types';

export function generateMonthlyFinancialPdf(
  summary: MonthlyFinancialSummary,
  orders: OrderBooking[],
  products: Product[],
  settings: StoreSettings
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header band (Pink & Blue brand accent)
  doc.setFillColor(29, 78, 216); // Royal Blue
  doc.rect(0, 0, pageWidth, 28, 'F');
  doc.setFillColor(219, 39, 119); // Pink accent strip
  doc.rect(0, 28, pageWidth, 2.5, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(settings.storeName, 14, 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(`Laporan Keuangan Bulanan Otomatis · Periode ${summary.monthLabel}`, 14, 20);
  doc.text(
    `Dicetak: ${new Date().toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })}`,
    pageWidth - 14,
    20,
    { align: 'right' }
  );

  // Ringkasan Laba Rugi
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.text('1. Ringkasan Keuangan Bulanan', 14, 41);

  autoTable(doc, {
    startY: 45,
    head: [['Komponen Keuangan', 'Nilai (IDR)']],
    body: [
      ['Pendapatan Layanan Grooming', formatRupiah(summary.groomingRevenue)],
      ['Pendapatan Penjualan Produk', formatRupiah(summary.productRevenue)],
      ['Pendapatan Pengiriman Kurir', formatRupiah(summary.deliveryRevenue)],
      ['Total Pendapatan Kotor', formatRupiah(summary.totalRevenue)],
      ['Harga Pokok Penjualan (HPP / Modal)', `(${formatRupiah(summary.totalCogs)})`],
      ['Laba Kotor (Gross Profit)', `${formatRupiah(summary.grossProfit)} (${summary.grossMarginPercent}%)`],
      ['Beban Operasional Bulanan', `(${formatRupiah(summary.operationalExpense)})`],
      ['Laba Bersih (Net Profit)', formatRupiah(summary.netProfit)],
      ['Valuasi Stok Gudang (Harga Modal)', formatRupiah(summary.inventoryValuationCost)],
      ['Valuasi Stok Gudang (Harga Jual)', formatRupiah(summary.inventoryValuationRetail)],
    ],
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [37, 99, 235], textColor: 255 },
    columnStyles: {
      1: { halign: 'right', fontStyle: 'bold' },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  const afterSummaryY =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 125;

  // Rincian Transaksi Bulan Ini
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.text('2. Rincian Transaksi & Antrian Periode Ini', 14, afterSummaryY + 10);

  const monthOrders = orders.filter(
    (o) => o.createdAt.slice(0, 7) === summary.monthKey && o.status !== 'Dibatalkan'
  );

  autoTable(doc, {
    startY: afterSummaryY + 14,
    head: [['No. Antrian', 'Pelanggan', 'Layanan / Order', 'Metode Bayar', 'Status', 'Total']],
    body:
      monthOrders.length > 0
        ? monthOrders.map((o) => [
            o.queueNumber,
            `${o.customerName}\n${o.customerPhone}`,
            o.serviceName,
            `${o.paymentMethod} (${o.paymentStatus})`,
            o.status,
            formatRupiah(o.totalAmount),
          ])
        : [['-', 'Belum ada transaksi tercatat pada periode ini', '-', '-', '-', formatRupiah(0)]],
    styles: { fontSize: 8.2, cellPadding: 2.5 },
    headStyles: { fillColor: [219, 39, 119], textColor: 255 },
    columnStyles: { 5: { halign: 'right' } },
    alternateRowStyles: { fillColor: [253, 242, 248] },
  });

  const afterOrdersY =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 190;

  // Catatan Stok Menipis & Keterangan Katalog
  const lowStock = products.filter((p) => p.stock <= p.minStock);
  if (afterOrdersY < 245) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text(
      `3. Peringatan Stok Menipis (${lowStock.length} item di bawah batas minimum)`,
      14,
      afterOrdersY + 10
    );
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    const lowStockSummary =
      lowStock.length > 0
        ? lowStock.map((p) => `${p.name} (Sisa ${p.stock})`).join(' · ')
        : 'Seluruh item inventaris dalam kondisi aman.';
    doc.text(lowStockSummary, 14, afterOrdersY + 16, { maxWidth: pageWidth - 28 });
    doc.text(`Catatan: ${settings.vetDisclaimer}`, 14, afterOrdersY + 24, {
      maxWidth: pageWidth - 28,
    });
  }

  doc.save(`Laporan-Keuangan-${summary.monthKey}.pdf`);
}
