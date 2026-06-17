import { format, formatDistanceToNow, subDays, isAfter, differenceInMilliseconds, formatISO } from 'date-fns';

export function toISOString(date: Date = new Date()): string {
  return date.toISOString();
}

export function toISODateString(date: Date = new Date()): string {
  return format(date, 'yyyy-MM-dd');
}

export function formatDate(date: Date, fmt: string = 'MMM d, yyyy, h:mm a'): string {
  return format(date, fmt);
}

export function daysAgo(days: number, from: Date = new Date()): Date {
  return subDays(from, days);
}

export function timeAgo(date: Date): string {
  return formatDistanceToNow(date, { addSuffix: true });
}

export function isFresh(date: Date, withinMs: number): boolean {
  return differenceInMilliseconds(new Date(), date) < withinMs;
}

export function unixTimestamp(date: Date = new Date()): number {
  return Math.floor(date.getTime() / 1000);
}
