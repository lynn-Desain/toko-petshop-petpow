import { Bell, BellRing, Check, Tag, Truck, X } from 'lucide-react';
import type { PushNotification } from '../lib/types';

interface NotificationDrawerProps {
  open: boolean;
  onClose: () => void;
  notifications: PushNotification[];
  browserPushEnabled: boolean;
  onRequestBrowserPush: () => void;
  onClearUnread: () => void;
}

export function NotificationDrawer({
  open,
  onClose,
  notifications,
  browserPushEnabled,
  onRequestBrowserPush,
  onClearUnread,
}: NotificationDrawerProps) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="notif-drawer-title"
      className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex justify-end"
    >
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 h-full flex flex-col shadow-2xl">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Bell className="w-5 h-5 text-pink-600 dark:text-pink-400" aria-hidden="true" />
            <h2
              id="notif-drawer-title"
              className="font-display text-lg font-bold text-slate-900 dark:text-slate-100"
            >
              Pusat Notifikasi Real-Time
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup panel notifikasi"
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 bg-blue-50/70 dark:bg-blue-950/40 border-b border-blue-200 dark:border-blue-900 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-700 dark:text-slate-300">
            <p className="font-semibold text-blue-800 dark:text-blue-300">
              Notifikasi Push Browser
            </p>
            <p className="mt-0.5">
              Terima info promo terbaru dan pembaruan status kurir/grooming secara otomatis.
            </p>
          </div>
          <button
            type="button"
            onClick={onRequestBrowserPush}
            disabled={browserPushEnabled}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 ${
              browserPushEnabled
                ? 'bg-emerald-600 text-white cursor-default'
                : 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer'
            }`}
          >
            {browserPushEnabled ? (
              <>
                <Check className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Aktif</span>
              </>
            ) : (
              <>
                <BellRing className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Aktifkan</span>
              </>
            )}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {notifications.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-10">
              Belum ada notifikasi promo atau pembaruan pesanan.
            </p>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-pink-600 dark:text-pink-400">
                    {n.kind === 'promo' ? (
                      <Tag className="w-3.5 h-3.5" aria-hidden="true" />
                    ) : (
                      <Truck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                    )}
                    <span>{n.kind === 'promo' ? 'Promo Toko' : 'Update Pesanan'}</span>
                  </span>
                  <span className="font-mono-num text-[11px] text-slate-500 dark:text-slate-400">
                    {new Date(n.createdAt).toLocaleTimeString('id-ID', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <p className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                  {n.title}
                </p>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {n.message}
                </p>
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={() => {
              onClearUnread();
              onClose();
            }}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:opacity-90 cursor-pointer"
          >
            Tandai Semua Dibaca
          </button>
        </div>
      </div>
    </div>
  );
}
