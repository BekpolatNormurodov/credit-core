import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatMoney(n: number | null | undefined): string {
  if (n == null) return '—';
  return new Intl.NumberFormat('ru-RU').format(n) + " so'm";
}
