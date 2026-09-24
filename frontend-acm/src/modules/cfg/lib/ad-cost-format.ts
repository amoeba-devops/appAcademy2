/** Preserve the original decimal amount in account previews; totals round on the server. */
export function formatAdMicros(value: string | null | undefined): string {
  const amount = BigInt(value ?? '0');
  const whole = (amount / 1000000n).toLocaleString();
  const fraction = (amount % 1000000n).toString().padStart(6, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole;
}
