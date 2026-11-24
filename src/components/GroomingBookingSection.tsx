import {
  CheckCircle2,
  Copy,
  CreditCard,
  MessageCircle,
  Printer,
  QrCode,
  Scissors,
  ShieldCheck,
  Smartphone,
  Store,
  Wallet,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { buildWhatsAppGroomingUrl, formatRupiah } from '../lib/petshopLogic';
import type {
  GroomingServiceOption,
  OrderBooking,
  PaymentMethod,
  StoreBranch,
  StoreSettings,
} from '../lib/types';

interface GroomingBookingSectionProps {
  services: GroomingServiceOption[];
  branches: StoreBranch[];
  settings: StoreSettings;
  onBookingCreated: (order: OrderBooking) => void;
  onJumpToOrder: (orderId: string) => void;
}

export function GroomingBookingSection({
  services,
  branches,
  settings,
  onBookingCreated,
  onJumpToOrder,
}: GroomingBookingSectionProps) {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [petType, setPetType] = useState<'Kucing' | 'Anjing' | 'Lainnya'>('Kucing');
  const [petNameOrBreed, setPetNameOrBreed] = useState('');
  const [serviceId, setServiceId] = useState(services[0]?.id || '');
  const [branchId, setBranchId] = useState(branches[0]?.id || '');
  const [deliveryMode, setDeliveryMode] = useState<'Datang ke Toko' | 'Antar-Jemput Kurir'>(
    'Datang ke Toko'
  );
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [complaintOrNotes, setComplaintOrNotes] = useState('');

  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Payment Gateway Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('QRIS');

  // Queue Proof Receipt State
  const [completedOrder, setCompletedOrder] = useState<OrderBooking | null>(null);
  const [copiedQueue, setCopiedQueue] = useState(false);

  const selectedService = useMemo(
    () => services.find((s) => s.id === serviceId) || services[0],
    [services, serviceId]
  );

  const selectedBranch = useMemo(
    () => branches.find((b) => b.id === branchId) || branches[0],
    [branches, branchId]
  );

  const deliveryFee =
    deliveryMode === 'Antar-Jemput Kurir' ? settings.deliveryBaseFee : 0;
  const totalAmount = (selectedService?.price || 0) + deliveryFee;

  const validateForm = (): boolean => {
    if (customerName.trim().length < 2) {
      setFormError('Nama pelanggan wajib diisi minimal 2 karakter.');
      return false;
    }
    if (customerPhone.replace(/[^0-9]/g, '').length < 8) {
      setFormError('No. HP / WhatsApp wajib diisi dengan format yang valid.');
      return false;
    }
    if (deliveryMode === 'Antar-Jemput Kurir' && deliveryAddress.trim().length < 6) {
      setFormError('Masukkan alamat lengkap untuk penjemputan & pengantaran kurir.');
      return false;
    }
    setFormError(null);
    return true;
  };

  const submitBooking = async (
    channel: 'Web Payment Gateway' | 'WhatsApp',
    chosenPayment: PaymentMethod
  ) => {
    setIsSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch('/api/grooming/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          petType,
          petNameOrBreed: petNameOrBreed.trim(),
          serviceId: selectedService?.id,
          complaintOrNotes: complaintOrNotes.trim(),
          branchId: selectedBranch?.id,
          deliveryMode,
          deliveryAddress: deliveryAddress.trim(),
          channel,
          paymentMethod: chosenPayment,
        }),
      });

      const data = (await res.json()) as { order?: OrderBooking; error?: string };
      if (!res.ok || !data.order) {
        setFormError(data.error || 'Gagal menyimpan pendaftaran grooming.');
        return;
      }

      onBookingCreated(data.order);
      setShowPaymentModal(false);
      setCompletedOrder(data.order);

      if (channel === 'WhatsApp') {
        const waUrl = buildWhatsAppGroomingUrl(settings.whatsappNumber, {
          customerName: data.order.customerName,
          customerPhone: data.order.customerPhone,
          petType: data.order.petType,
          petNameOrBreed: data.order.petNameOrBreed,
          serviceName: data.order.serviceName,
          complaintOrNotes: data.order.complaintOrNotes,
          branchName: data.order.branchName,
          deliveryMode: data.order.deliveryMode,
          deliveryAddress:
            data.order.deliveryMode === 'Antar-Jemput Kurir'
              ? data.order.deliveryAddress
              : undefined,
          queueNumber: data.order.queueNumber,
        });
        const link = document.createElement('a');
        link.href = waUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.click();
      }
    } catch {
      setFormError('Terjadi kendala koneksi saat memproses pendaftaran.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenPaymentGateway = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setShowPaymentModal(true);
  };

  const handleBookWhatsApp = () => {
    if (!validateForm()) return;
    void submitBooking('WhatsApp', 'Bayar di Toko');
  };

  const handleCopyQueue = async () => {
    if (!completedOrder) return;
    try {
      await navigator.clipboard.writeText(
        `Bukti Antrian ${settings.storeName} | No. Antrian: ${completedOrder.queueNumber} | ID: ${completedOrder.id} | Layanan: ${completedOrder.serviceName}`
      );
      setCopiedQueue(true);
      setTimeout(() => setCopiedQueue(false), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  return (
    <section
      id="grooming"
      className="scroll-mt-28 py-14 lg:py-20 bg-white dark:bg-slate-950 border-y border-slate-200 dark:border-slate-800"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Left: Service packages overview */}
          <div className="lg:col-span-5 space-y-5">
            <div>
              <p className="text-xs font-semibold tracking-wider text-blue-600 dark:text-blue-400 mb-2">
                Pendaftaran Grooming &amp; Antrian Otomatis
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-50 text-balance">
                Booking Grooming Mudah via Payment Gateway atau WhatsApp
              </h2>
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">
                Lengkapi data pelanggan, jenis hewan, dan keluhan anabul. Anda dapat langsung
                menyelesaikan pembayaran untuk menerima nomor antrian otomatis atau terhubung ke
                WhatsApp admin toko.
              </p>
            </div>

            <div className="space-y-3">
              {services.map((srv) => {
                const isSelected = srv.id === selectedService?.id;
                return (
                  <button
                    key={srv.id}
                    type="button"
                    onClick={() => setServiceId(srv.id)}
                    className={`w-full text-left p-4 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-pink-50/70 dark:bg-pink-950/30 border-pink-500 dark:border-pink-500'
                        : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-blue-400'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-display font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100">
                        {srv.name}
                      </span>
                      <span className="font-mono-num font-bold text-sm text-pink-600 dark:text-pink-400 shrink-0">
                        {formatRupiah(srv.price)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {srv.petType} · Estimasi {srv.durationMinutes} menit
                    </p>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1.5">
                      {srv.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Clean Ergonomic Grooming Form */}
          <div className="lg:col-span-7">
            <form
              onSubmit={handleOpenPaymentGateway}
              className="p-6 sm:p-8 rounded-2xl bg-[#FAFBFD] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-5"
            >
              <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <Scissors className="w-5 h-5 text-pink-600 dark:text-pink-400" aria-hidden="true" />
                  <h3 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
                    Formulir Pendaftaran Grooming
                  </h3>
                </div>
                <span className="font-mono-num text-sm font-bold text-blue-600 dark:text-blue-400">
                  Total: {formatRupiah(totalAmount)}
                </span>
              </div>

              {formError && (
                <div
                  role="alert"
                  className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs sm:text-sm text-rose-700 dark:text-rose-200"
                >
                  {formError}
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="grooming-name"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Nama Pelanggan *
                  </label>
                  <input
                    id="grooming-name"
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Contoh: Ayu Lestari"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-pink-500/50"
                  />
                </div>

                <div>
                  <label
                    htmlFor="grooming-phone"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    No. HP / WhatsApp *
                  </label>
                  <input
                    id="grooming-phone"
                    type="tel"
                    required
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="Contoh: 081234567890"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-pink-500/50"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="grooming-pet-type"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Jenis Hewan *
                  </label>
                  <select
                    id="grooming-pet-type"
                    value={petType}
                    onChange={(e) =>
                      setPetType(e.target.value as 'Kucing' | 'Anjing' | 'Lainnya')
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-pink-500/50"
                  >
                    <option value="Kucing">Kucing</option>
                    <option value="Anjing">Anjing</option>
                    <option value="Lainnya">Hewan Peliharaan Lainnya</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="grooming-pet-breed"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Nama &amp; Ras Hewan
                  </label>
                  <input
                    id="grooming-pet-breed"
                    type="text"
                    value={petNameOrBreed}
                    onChange={(e) => setPetNameOrBreed(e.target.value)}
                    placeholder="Contoh: Milo · Persia"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-pink-500/50"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="grooming-service"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Layanan yang Diinginkan *
                  </label>
                  <select
                    id="grooming-service"
                    value={serviceId}
                    onChange={(e) => setServiceId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-pink-500/50"
                  >
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({formatRupiah(s.price)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="grooming-branch"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Cabang Toko *
                  </label>
                  <select
                    id="grooming-branch"
                    value={branchId}
                    onChange={(e) => setBranchId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-pink-500/50"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Metode Kunjungan / Pengantaran
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setDeliveryMode('Datang ke Toko')}
                    className={`px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold border transition-colors cursor-pointer ${
                      deliveryMode === 'Datang ke Toko'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    Datang ke Toko (Gratis)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeliveryMode('Antar-Jemput Kurir')}
                    className={`px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold border transition-colors cursor-pointer ${
                      deliveryMode === 'Antar-Jemput Kurir'
                        ? 'bg-pink-600 text-white border-pink-600'
                        : 'bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    Antar-Jemput Kurir (+{formatRupiah(settings.deliveryBaseFee)})
                  </button>
                </div>
              </div>

              {deliveryMode === 'Antar-Jemput Kurir' && (
                <div>
                  <label
                    htmlFor="grooming-address"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Alamat Lengkap Penjemputan &amp; Pengantaran *
                  </label>
                  <input
                    id="grooming-address"
                    type="text"
                    required
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="Contoh: Jl. Kemang Timur No. 14, Jakarta Selatan"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-pink-500/50"
                  />
                </div>
              )}

              <div>
                <label
                  htmlFor="grooming-complaint"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Keluhan atau Catatan Khusus Hewan
                </label>
                <textarea
                  id="grooming-complaint"
                  rows={3}
                  value={complaintOrNotes}
                  onChange={(e) => setComplaintOrNotes(e.target.value)}
                  placeholder="Contoh: Ada sedikit kutu di tengkuk, agak sensitif saat dipotong kuku."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-pink-500/50"
                />
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-pink-600 to-blue-600 hover:from-pink-500 hover:to-blue-500 shadow-sm transition-all cursor-pointer disabled:opacity-60"
                >
                  <CreditCard className="w-4 h-4" aria-hidden="true" />
                  <span>Bayar &amp; Dapatkan No. Antrian</span>
                </button>

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleBookWhatsApp}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors cursor-pointer disabled:opacity-60"
                >
                  <MessageCircle className="w-4 h-4" aria-hidden="true" />
                  <span>Daftar via WhatsApp</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Payment Gateway Checkout Modal */}
      {showPaymentModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="payment-modal-title"
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                <h3
                  id="payment-modal-title"
                  className="font-display text-lg font-bold text-slate-900 dark:text-slate-100"
                >
                  Gateway Pembayaran Aman
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                aria-label="Tutup jendela pembayaran"
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Layanan</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {selectedService?.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Pelanggan</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {customerName} ({petType})
                  </span>
                </div>
                {deliveryFee > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Antar-Jemput Kurir</span>
                    <span className="font-mono-num">{formatRupiah(deliveryFee)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-slate-700 font-bold text-base">
                  <span>Total Bayar</span>
                  <span className="font-mono-num text-pink-600 dark:text-pink-400">
                    {formatRupiah(totalAmount)}
                  </span>
                </div>
              </div>

              <div>
                <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Pilih Metode Pembayaran
                </span>
                <div className="grid grid-cols-2 gap-2.5">
                  {(
                    [
                      { id: 'QRIS', label: 'QRIS Instan', icon: QrCode },
                      { id: 'Virtual Account', label: 'Virtual Account', icon: CreditCard },
                      { id: 'E-Wallet', label: 'GoPay / OVO / DANA', icon: Wallet },
                      { id: 'Bayar di Toko', label: 'Bayar di Kasir', icon: Store },
                    ] as const
                  ).map((method) => {
                    const Icon = method.icon;
                    const active = paymentMethod === method.id;
                    return (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => setPaymentMethod(method.id)}
                        className={`p-3 rounded-xl border text-left text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                          active
                            ? 'bg-pink-50 dark:bg-pink-950/40 border-pink-500 text-pink-700 dark:text-pink-300'
                            : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                        <span>{method.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {paymentMethod === 'QRIS' && (
                <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 flex items-center gap-3 text-xs text-slate-700 dark:text-slate-200">
                  <Smartphone className="w-8 h-8 text-blue-600 dark:text-blue-400 shrink-0" />
                  <p>
                    Pembayaran QRIS terverifikasi otomatis dan langsung menerbitkan{' '}
                    <strong>No. Antrian Resmi</strong> Anda.
                  </p>
                </div>
              )}

              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => void submitBooking('Web Payment Gateway', paymentMethod)}
                className="w-full py-3 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-pink-600 to-blue-600 hover:from-pink-500 hover:to-blue-500 shadow-sm cursor-pointer disabled:opacity-60"
              >
                {isSubmitting
                  ? 'Memproses Pembayaran...'
                  : `Konfirmasi & Bayar ${formatRupiah(totalAmount)}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Automatic Queue Number Proof Modal */}
      {completedOrder && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="queue-receipt-title"
          data-testid="queue-receipt-modal"
          className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
            <div className="p-6 bg-gradient-to-r from-pink-600 to-blue-600 text-white text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 mx-auto" aria-hidden="true" />
              <h3 id="queue-receipt-title" className="font-display text-xl font-bold">
                Pendaftaran Berhasil!
              </h3>
              <p className="text-xs text-pink-100">
                Simpan nomor antrian ini sebagai bukti resmi kedatangan / pelacakan.
              </p>
              <div className="pt-2">
                <span className="inline-block px-5 py-2 rounded-xl bg-white text-slate-900 font-mono-num text-2xl font-extrabold tracking-wider shadow-sm">
                  {completedOrder.queueNumber}
                </span>
              </div>
            </div>

            <div className="p-6 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">ID Transaksi</span>
                <span className="font-mono-num font-semibold">{completedOrder.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Pelanggan</span>
                <span className="font-semibold">
                  {completedOrder.customerName} · {completedOrder.customerPhone}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Hewan &amp; Layanan</span>
                <span className="font-semibold text-right">
                  {completedOrder.petNameOrBreed} · {completedOrder.serviceName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Cabang</span>
                <span className="font-medium text-right">{completedOrder.branchName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Pembayaran</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {completedOrder.paymentMethod} ({completedOrder.paymentStatus})
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-slate-800 font-bold">
                <span>Total</span>
                <span className="font-mono-num text-pink-600 dark:text-pink-400">
                  {formatRupiah(completedOrder.totalAmount)}
                </span>
              </div>

              <div className="pt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleCopyQueue()}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{copiedQueue ? 'Tersalin!' : 'Salin Bukti'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Cetak</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const id = completedOrder.id;
                    setCompletedOrder(null);
                    onJumpToOrder(id);
                  }}
                  className="w-full py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-pink-600 to-blue-600 hover:from-pink-500 hover:to-blue-500 cursor-pointer"
                >
                  Lacak Antrian &amp; Peta Kurir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
