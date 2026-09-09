export function validDay(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return day <= [31, leap ? 29 : 28, 31,30,31,30,31,31,30,31,30,31][month - 1];
}
export function normalizeTimestamp(value: unknown, endOfDay = false): string | null | undefined {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'string') throw new Error('日期必须是有效字符串');
  if (validDay(value)) {
    const date = new Date(value + (endOfDay ? 'T23:59:59.999' : 'T00:00:00'));
    if (!matchesLocalDay(date, value)) throw new Error('该日期在本地时区不存在');
    return date.toISOString();
  }
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})?$/.exec(value);
  if (!match || !validDay(match[1]) || +match[2] > 23 || +match[3] > 59 || +(match[4] ?? 0) > 59) throw new Error('日期或时间无效');
  const zone = match[6];
  if (zone && zone !== 'Z' && (+zone.slice(1,3) > 14 || +zone.slice(4) > 59 || (+zone.slice(1,3) === 14 && +zone.slice(4) !== 0))) throw new Error('时区偏移无效');
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('日期无效');
  if (!zone && (!matchesLocalDay(date, match[1]) || date.getHours() !== +match[2] || date.getMinutes() !== +match[3])) throw new Error('该本地时间因夏令时切换不存在，请选择其他时间');
  return date.toISOString();
}

function matchesLocalDay(date: Date, value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return date.getFullYear() === year && date.getMonth() + 1 === month && date.getDate() === day;
}
