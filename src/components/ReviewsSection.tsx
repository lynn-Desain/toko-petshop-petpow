import { MessageSquarePlus, Star } from 'lucide-react';
import { useState } from 'react';
import type { CustomerReview } from '../lib/types';

interface ReviewsSectionProps {
  reviews: CustomerReview[];
  onReviewAdded: (review: CustomerReview) => void;
}

export function ReviewsSection({ reviews, onReviewAdded }: ReviewsSectionProps) {
  const [customerName, setCustomerName] = useState('');
  const [petLabel, setPetLabel] = useState('');
  const [serviceOrProduct, setServiceOrProduct] = useState('Full Grooming & Styling Spa');
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (customerName.trim().length < 2 || comment.trim().length < 5) {
      setError('Mohon isi nama dan ulasan minimal 5 karakter.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: customerName.trim(),
          petLabel: petLabel.trim() || 'Pemilik Anabul',
          serviceOrProduct: serviceOrProduct.trim(),
          rating,
          comment: comment.trim(),
        }),
      });
      const data = (await res.json()) as { review?: CustomerReview; error?: string };
      if (!res.ok || !data.review) {
        setError(data.error || 'Gagal mengirim ulasan.');
        return;
      }
      onReviewAdded(data.review);
      setCustomerName('');
      setPetLabel('');
      setComment('');
      setRating(5);
      setSuccessMsg('Terima kasih! Ulasan Anda sudah tampil di halaman toko.');
    } catch {
      setError('Gagal menghubungi server.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      id="ulasan"
      className="scroll-mt-28 py-14 lg:py-20 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Reviews list */}
          <div className="lg:col-span-7 space-y-6">
            <div>
              <p className="text-xs font-semibold tracking-wider text-blue-600 dark:text-blue-400 mb-2">
                Kepercayaan Pelanggan
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-50 text-balance">
                Ulasan Pelanggan Terverifikasi
              </h2>
            </div>

            <div className="space-y-4">
              {reviews.map((rev) => (
                <article
                  key={rev.id}
                  data-testid="customer-review-card"
                  className="p-5 rounded-2xl bg-[#FAFBFD] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1" aria-label={`Rating ${rev.rating} dari 5`}>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`w-4 h-4 ${
                            i < rev.rating
                              ? 'text-amber-500 fill-amber-500'
                              : 'text-slate-300 dark:text-slate-700'
                          }`}
                          aria-hidden="true"
                        />
                      ))}
                    </div>
                    <span className="font-mono-num text-xs text-slate-500 dark:text-slate-400">
                      {new Date(rev.createdAt).toLocaleDateString('id-ID')}
                    </span>
                  </div>

                  <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
                    “{rev.comment}”
                  </p>

                  <div className="text-xs text-slate-500 dark:text-slate-400 pt-1">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {rev.customerName}
                    </span>
                    <span aria-hidden="true"> · </span>
                    <span>{rev.petLabel}</span>
                    <span aria-hidden="true"> · </span>
                    <span className="text-pink-600 dark:text-pink-400">{rev.serviceOrProduct}</span>
                  </div>
                </article>
              ))}
            </div>
          </div>

          {/* Add Review Form */}
          <div className="lg:col-span-5">
            <form
              onSubmit={handleSubmit}
              className="p-6 rounded-2xl bg-[#FAFBFD] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4"
            >
              <div className="flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
                <MessageSquarePlus
                  className="w-5 h-5 text-pink-600 dark:text-pink-400"
                  aria-hidden="true"
                />
                <h3 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
                  Bagikan Pengalaman Anda
                </h3>
              </div>

              {error && (
                <p role="alert" className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                  {error}
                </p>
              )}
              {successMsg && (
                <p role="status" className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                  {successMsg}
                </p>
              )}

              <div>
                <label
                  htmlFor="review-name"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Nama Anda *
                </label>
                <input
                  id="review-name"
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Contoh: Reza Pratama"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="review-pet"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Nama / Jenis Anabul
                  </label>
                  <input
                    id="review-pet"
                    type="text"
                    value={petLabel}
                    onChange={(e) => setPetLabel(e.target.value)}
                    placeholder="Contoh: Pemilik Oyen"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-sm"
                  />
                </div>
                <div>
                  <label
                    htmlFor="review-rating"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Rating
                  </label>
                  <select
                    id="review-rating"
                    value={rating}
                    onChange={(e) => setRating(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-sm"
                  >
                    <option value={5}>5 Bintang · Sangat Puas</option>
                    <option value={4}>4 Bintang · Puas</option>
                    <option value={3}>3 Bintang · Cukup</option>
                    <option value={2}>2 Bintang · Kurang</option>
                    <option value={1}>1 Bintang · Buruk</option>
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="review-item"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Layanan / Produk
                </label>
                <input
                  id="review-item"
                  type="text"
                  value={serviceOrProduct}
                  onChange={(e) => setServiceOrProduct(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="review-comment"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Ulasan Anda *
                </label>
                <textarea
                  id="review-comment"
                  rows={3}
                  required
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Ceritakan pengalaman belanja atau grooming di toko kami..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-pink-600 to-blue-600 hover:from-pink-500 hover:to-blue-500 cursor-pointer disabled:opacity-60"
              >
                {submitting ? 'Mengirim...' : 'Kirim Ulasan'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
