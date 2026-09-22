/** GA reports use Korean business dates, independent of the server timezone. */
export function kstDaysAgo(days: number, now = new Date()): string {
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  kst.setUTCDate(kst.getUTCDate() - days);
  return kst.toISOString().slice(0, 10);
}
