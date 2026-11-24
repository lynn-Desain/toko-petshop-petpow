import type { ProductCategory } from '../lib/types';

export const STORE_LOGO_URL =
  '/assets/aistudio/WhatsApp_Image_2026-11-24_at_20.26.21_439f3c4c.jpeg';

export const HERO_BANNER_URL =
  '/src/assets/images/hero_petshop_grooming_1795525616736.jpg';

export function getCategoryImage(category: ProductCategory): string {
  switch (category) {
    case 'Makanan Kucing':
      return '/src/assets/images/cat_food_showcase_1795525616070.jpg';
    case 'Makanan Anjing':
    case 'Minuman & Susu':
      return '/src/assets/images/dog_food_milk_showcase_1795525617754.jpg';
    case 'Perawatan':
    case 'Aksesori':
    case 'Obat & Vitamin':
    default:
      return '/src/assets/images/grooming_accessories_showcase_1795525618109.jpg';
  }
}

export function triggerDownload(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
