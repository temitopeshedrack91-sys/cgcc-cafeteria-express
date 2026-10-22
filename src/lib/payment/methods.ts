export type PaymentMethod = 'online' | 'transfer';
export function choosePaymentMethod(onlineEnabled: boolean, transferEnabled: boolean, preferred: PaymentMethod = 'online'): PaymentMethod | null {
  if (preferred === 'transfer' && transferEnabled) return 'transfer';
  if (onlineEnabled) return 'online';
  return transferEnabled ? 'transfer' : null;
}