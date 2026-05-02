import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, isToday, isYesterday } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string | any) {
  if (!date) return '';
  const d = date?.toDate ? date.toDate() : (typeof date === 'string' ? new Date(date) : date);
  
  if (isToday(d)) {
    return format(d, 'HH:mm');
  }
  if (isYesterday(d)) {
    return 'Yesterday';
  }
  return format(d, 'dd/MM/yy');
}

export function formatLastSeen(date: Date | string | any) {
  if (!date) return '';
  const d = date?.toDate ? date.toDate() : (typeof date === 'string' ? new Date(date) : date);
  
  if (isToday(d)) {
    return `at ${format(d, 'HH:mm')}`;
  }
  if (isYesterday(d)) {
    return `yesterday at ${format(d, 'HH:mm')}`;
  }
  return `on ${format(d, 'dd/MM/yy')} at ${format(d, 'HH:mm')}`;
}
