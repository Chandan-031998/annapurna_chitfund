export function sumAmounts<T>(items: T[], selector: (item: T) => number | string | undefined) {
  return items.reduce((total, item) => total + Number(selector(item) || 0), 0)
}

export function pendingAmount(amount: number | string, paidAmount: number | string) {
  return Math.max(Number(amount || 0) - Number(paidAmount || 0), 0)
}
