import { format, formatDistanceToNow, differenceInMilliseconds } from 'date-fns';

export function formatDate(date: Date | string | number, fmt: string = 'MMM d, yyyy, h:mm a'): string {
  return format(new Date(date), fmt);
}

export function formatShortDate(date: Date | string | number): string {
  return format(new Date(date), 'MMM d');
}

export function formatTime(date: Date | string | number): string {
  return format(new Date(date), 'HH:mm:ss');
}

export function formatDateOnly(date: Date | string | number): string {
  return format(new Date(date), 'MMM d, yyyy');
}

export function timeAgo(date: Date | string | number): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}
