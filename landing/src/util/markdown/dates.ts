export function getRelativeDateFormat(date: Date): [string, number] {
  const diff = date.getTime() - Date.now();
  const sec = Math.floor(diff / 1000);
  const abs = Math.abs(sec);

  if (abs < 60) return ["second", sec];
  if (abs < 3600) return ["minute", Math.floor(sec / 60)];
  if (abs < 86400) return ["hour", Math.floor(sec / 3600)];
  if (abs < 2592000) return ["day", Math.floor(sec / 86400)];
  if (abs < 31536000) return ["month", Math.floor(sec / 2592000)];
  return ["year", Math.floor(sec / 31536000)];
}
