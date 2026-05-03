export function birthdayText(month: number, day: number): string {
  return `${month}月${day}日`;
}

export function parseMonthDay(value: string): { month: number; day: number } | null {
  const match = value.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (!match) return null;
  return { month: Number(match[1]), day: Number(match[2]) };
}

export function getMonthDayInTimezone(date: Date, timeZone: string): { month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "numeric",
    day: "numeric"
  }).formatToParts(date);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  if (!month || !day) {
    throw new Error(`Unable to format date in timezone ${timeZone}`);
  }
  return { month, day };
}

export function toIsoDate(year: number, month: number, day: number, timeZone = "Asia/Tokyo"): string {
  const isoDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  if (timeZone === "Asia/Tokyo" || timeZone === "Asia/Shanghai") {
    return `${isoDate}T00:00:00+09:00`;
  }
  return `${isoDate}T00:00:00Z`;
}
