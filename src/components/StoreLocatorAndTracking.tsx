import { Clock, LocateFixed, MapPin, Navigation, Search, Truck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { findNearestBranches, formatRupiah } from '../lib/petshopLogic';
import type { OrderBooking, StoreBranch } from '../lib/types';
import { GoogleMapsView, type MapMarkerItem } from './GoogleMapsView';

interface StoreLocatorAndTrackingProps {
  mapsApiKey: string;
  branches: StoreBranch[];
  orders: OrderBooking[];
  highlightedOrderId: string | null;
}

const CITY_PRESETS = [
  { label: 'Kemang / Jakarta Selatan', lat: -6.2615, lng: 106.8135 },
  { label: 'Puri Indah / Jakarta Barat', lat: -6.189, lng: 106.738 },
  { label: 'BSD City / Tangerang Selatan', lat: -6.291, lng: 106.664 },
  { label: 'Pusat Kota / Monas', lat: -6.1754, lng: 106.8272 },
];

const TIMELINE_STEPS = [
  'Antrian Dikonfirmasi',
  'Sedang Diproses',
  'Kurir Menuju Lokasi',
  'Selesai',
] as const;

export function StoreLocatorAndTracking({
  mapsApiKey,
  branches,
  orders,
  highlightedOrderId,
}: StoreLocatorAndTrackingProps) {
  const [activeTab, setActiveTab] = useState<'tracking' | 'locator'>('tracking');
  const [orderQuery, setOrderQuery] = useState('');
  const [searchedOrders, setSearchedOrders] = useState<OrderBooking[] | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string>(orders[0]?.id || '');

  // Store locator state
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number }>({
    lat: -6.2615,
    lng: 106.8135,
  });
  const [geoMessage, setGeoMessage] = useState<string>('');

  useEffect(() => {
    if (highlightedOrderId) {
      setActiveTab('tracking');
      setSelectedOrderId(highlightedOrderId);
      setSearchedOrders(null);
    }
  }, [highlightedOrderId]);

  const displayedOrders = searchedOrders ?? orders;

  const selectedOrder = useMemo(
    () =>
      displayedOrders.find((o) => o.id === selectedOrderId) ||
      orders.find((o) => o.id === selectedOrderId) ||
      displayedOrders[0] ||
      null,
    [displayedOrders, orders, selectedOrderId]
  );

  const sortedBranches = useMemo(
    () => findNearestBranches(branches, userCoords.lat, userCoords.lng),
    [branches, userCoords]
  );

  const handleOrderLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(
        `/api/orders/lookup?query=${encodeURIComponent(orderQuery.trim())}`
      );
      if (res.ok) {
        const data = (await res.json()) as { orders: OrderBooking[] };
        setSearchedOrders(data.orders);
        if (data.orders[0]) {
          setSelectedOrderId(data.orders[0].id);
        }
      }
    } catch {
      // Keep local list on transient error
    }
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setGeoMessage('Browser tidak mendukung geolokasi. Pilih wilayah terdekat di bawah.');
      return;
    }
    setGeoMessage('Mencari koordinat lokasi Anda...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({
          lat: Number(pos.coords.latitude.toFixed(5)),
          lng: Number(pos.coords.longitude.toFixed(5)),
        });
        setGeoMessage('Lokasi Anda terdeteksi. Cabang diurutkan dari yang terdekat.');
      },
      () => {
        setGeoMessage('Izin lokasi ditolak. Pilih area Jakarta/Tangerang pada tombol cepat.');
      },
      { timeout: 6000 }
    );
  };

  // Build map markers & route for Tracking tab
  const trackingMapData = useMemo(() => {
    if (!selectedOrder) {
      return {
        center: branches[0]?.coords || { lat: -6.2607, lng: 106.8142 },
        markers: [] as MapMarkerItem[],
        routePoints: [] as Array<{ lat: number; lng: number }>,
      };
    }

    const branch =
      branches.find((b) => b.id === selectedOrder.branchId) || branches[0];
    const markers: MapMarkerItem[] = [
      {
        id: 'store-origin',
        position: branch.coords,
        title: branch.name,
        subtitle: branch.address,
        kind: 'store',
      },
    ];

    if (selectedOrder.deliveryMode === 'Antar-Jemput Kurir') {
      markers.push(
        {
          id: 'courier-live',
          position: selectedOrder.courierCoords,
          title: `Kurir: ${selectedOrder.courierName}`,
          subtitle: `Status: ${selectedOrder.status} · ETA ${selectedOrder.etaMinutes} mnt`,
          kind: 'courier',
        },
        {
          id: 'customer-dest',
          position: selectedOrder.destinationCoords,
          title: `Tujuan: ${selectedOrder.customerName}`,
          subtitle: selectedOrder.deliveryAddress,
          kind: 'destination',
        }
      );
    }

    const routePoints =
      selectedOrder.deliveryMode === 'Antar-Jemput Kurir'
        ? [branch.coords, selectedOrder.courierCoords, selectedOrder.destinationCoords]
        : [];

    return {
      center:
        selectedOrder.deliveryMode === 'Antar-Jemput Kurir'
          ? selectedOrder.courierCoords
          : branch.coords,
      markers,
      routePoints,
    };
  }, [selectedOrder, branches]);

  // Build map markers for Nearest Store Locator tab
  const locatorMarkers: MapMarkerItem[] = useMemo(() => {
    const items: MapMarkerItem[] = sortedBranches.map((b, idx) => ({
      id: b.id,
      position: b.coords,
      title: `${idx === 0 ? '[Terdekat] ' : ''}${b.name}`,
      subtitle: `${b.address} (${b.distanceKm ?? 0} km)`,
      kind: 'store',
    }));
    items.push({
      id: 'user-pos',
      position: userCoords,
      title: 'Posisi Anda Saat Ini',
      subtitle: `${userCoords.lat.toFixed(4)}, ${userCoords.lng.toFixed(4)}`,
      kind: 'user',
    });
    return items;
  }, [sortedBranches, userCoords]);

  const currentStepIndex = selectedOrder
    ? Math.max(
        0,
        TIMELINE_STEPS.findIndex((s) => s === selectedOrder.status)
      )
    : 0;

  return (
    <section id="lacak" className="scroll-mt-28 py-14 lg:py-20 bg-[#FAFBFD] dark:bg-[#090D16]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <p className="text-xs font-semibold tracking-wider text-pink-600 dark:text-pink-400 mb-2">
              Riwayat Transaksi, Pelacakan Kurir &amp; Lokasi Cabang
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-50 text-balance">
              Lacak Pengiriman Aktif &amp; Temukan Toko Terdekat
            </h2>
          </div>

          <div
            role="tablist"
            aria-label="Mode pelacakan peta"
            className="inline-flex p-1 rounded-xl bg-slate-200/70 dark:bg-slate-800 self-start"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'tracking'}
              onClick={() => setActiveTab('tracking')}
              className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'tracking'
                  ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              <Truck className="w-4 h-4 text-pink-600 dark:text-pink-400" aria-hidden="true" />
              <span>Riwayat &amp; Lacak Kurir</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'locator'}
              onClick={() => setActiveTab('locator')}
              className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'locator'
                  ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              <MapPin className="w-4 h-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
              <span>Cari Toko Terdekat</span>
            </button>
          </div>
        </div>

        {activeTab === 'tracking' ? (
          <div className="grid lg:grid-cols-12 gap-6 items-start">
            {/* Order History Search & List */}
            <div className="lg:col-span-5 space-y-4">
              <form onSubmit={handleOrderLookup} className="flex gap-2">
                <label htmlFor="order-lookup-input" className="sr-only">
                  Cari nomor antrian, nomor HP, atau ID pesanan
                </label>
                <div className="relative flex-1">
                  <Search
                    className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    id="order-lookup-input"
                    type="search"
                    value={orderQuery}
                    onChange={(e) => setOrderQuery(e.target.value)}
                    placeholder="Cari No. Antrian (ANT-001) atau No. HP..."
                    className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 cursor-pointer whitespace-nowrap"
                >
                  Cari
                </button>
              </form>

              <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                {displayedOrders.length === 0 ? (
                  <div className="p-6 text-center rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm text-slate-500">
                    Tidak ada transaksi yang cocok dengan pencarian Anda.
                  </div>
                ) : (
                  displayedOrders.map((order) => {
                    const active = selectedOrder?.id === order.id;
                    return (
                      <button
                        key={order.id}
                        type="button"
                        onClick={() => setSelectedOrderId(order.id)}
                        className={`w-full text-left p-4 rounded-xl border transition-all cursor-pointer ${
                          active
                            ? 'bg-pink-50/70 dark:bg-pink-950/30 border-pink-500'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-blue-400'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono-num text-xs font-bold text-pink-600 dark:text-pink-400">
                            {order.queueNumber} · {order.id}
                          </span>
                          <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                            {order.status}
                          </span>
                        </div>
                        <p className="font-display font-bold text-sm text-slate-900 dark:text-slate-100 mt-1">
                          {order.customerName} — {order.serviceName}
                        </p>
                        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                          <span>{order.deliveryMode}</span>
                          <span className="font-mono-num font-semibold text-slate-800 dark:text-slate-200">
                            {formatRupiah(order.totalAmount)}
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Active Order Details + Live Google Map */}
            <div className="lg:col-span-7 space-y-4">
              {selectedOrder ? (
                <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-mono-num font-bold text-pink-600 dark:text-pink-400">
                          {selectedOrder.queueNumber}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{selectedOrder.paymentMethod}</span>
                        <span aria-hidden="true">·</span>
                        <span>{selectedOrder.paymentStatus}</span>
                      </div>
                      <h3 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                        {selectedOrder.customerName} ({selectedOrder.petNameOrBreed})
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-0.5">
                        {selectedOrder.deliveryMode} · {selectedOrder.deliveryAddress}
                      </p>
                    </div>

                    {selectedOrder.deliveryMode === 'Antar-Jemput Kurir' && (
                      <div className="text-right">
                        <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                          Kurir · {selectedOrder.courierName}
                        </span>
                        <span className="inline-flex items-center gap-1 font-mono-num text-sm font-bold text-blue-600 dark:text-blue-400">
                          <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>
                            {selectedOrder.status === 'Selesai'
                              ? 'Tiba di Tujuan'
                              : `ETA ${selectedOrder.etaMinutes} menit`}
                          </span>
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Step Timeline */}
                  <div className="grid grid-cols-4 gap-2 pt-1">
                    {TIMELINE_STEPS.map((step, index) => {
                      const reached = index <= currentStepIndex;
                      return (
                        <div key={step} className="space-y-1.5">
                          <div
                            className={`h-1.5 rounded-full transition-colors ${
                              reached
                                ? 'bg-gradient-to-r from-pink-600 to-blue-600'
                                : 'bg-slate-200 dark:bg-slate-800'
                            }`}
                          />
                          <p
                            className={`text-[11px] font-medium leading-tight ${
                              reached
                                ? 'text-slate-900 dark:text-slate-100'
                                : 'text-slate-400 dark:text-slate-500'
                            }`}
                          >
                            {step}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Live Google Maps View */}
                  <GoogleMapsView
                    apiKey={mapsApiKey}
                    center={trackingMapData.center}
                    zoom={13}
                    markers={trackingMapData.markers}
                    routePoints={trackingMapData.routePoints}
                    heightClassName="h-[320px]"
                  />
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="grid lg:grid-cols-12 gap-6 items-start">
            {/* Nearest Branch Finder */}
            <div className="lg:col-span-5 space-y-4">
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Deteksi Jarak Lokasi Anda
                  </span>
                  <button
                    type="button"
                    onClick={handleUseMyLocation}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-pink-600 to-blue-600 hover:from-pink-500 hover:to-blue-500 cursor-pointer"
                  >
                    <LocateFixed className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Gunakan Lokasi Saya</span>
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {CITY_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setUserCoords({ lat: preset.lat, lng: preset.lng });
                        setGeoMessage(`Menampilkan cabang terdekat dari ${preset.label}.`);
                      }}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-950/50 cursor-pointer"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                {geoMessage && (
                  <p className="text-xs text-blue-600 dark:text-blue-400">{geoMessage}</p>
                )}
              </div>

              <div className="space-y-3">
                {sortedBranches.map((branch, idx) => (
                  <div
                    key={branch.id}
                    className={`p-4 rounded-xl border ${
                      idx === 0
                        ? 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-500'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[11px] font-semibold text-pink-600 dark:text-pink-400">
                          {idx === 0 ? 'Cabang Terdekat' : branch.district}
                        </span>
                        <h3 className="font-display font-bold text-sm text-slate-900 dark:text-slate-100">
                          {branch.name}
                        </h3>
                      </div>
                      <span className="font-mono-num text-xs font-bold text-blue-600 dark:text-blue-400 shrink-0">
                        {branch.distanceKm?.toFixed(2)} km
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                      {branch.address}
                    </p>
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mt-2.5 pt-2 border-t border-slate-200/70 dark:border-slate-800">
                      <span>{branch.hours}</span>
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${branch.coords.lat},${branch.coords.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        <Navigation className="w-3 h-3" aria-hidden="true" />
                        <span>Petunjuk Arah</span>
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-7">
              <GoogleMapsView
                apiKey={mapsApiKey}
                center={sortedBranches[0]?.coords || userCoords}
                zoom={11}
                markers={locatorMarkers}
                heightClassName="h-[460px]"
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
