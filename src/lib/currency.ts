// ISO 4217: TND has three fractional digits. All other supported currencies have two.
export function minorUnits(currency: string) {
  return currency === "TND" ? 1000 : 100;
}
export function toMinor(amount: number, currency: string) {
  return Math.round(amount * minorUnits(currency));
}
export function toEurMinor(amount: number, currency: string, rate: number) {
  return Math.round((amount / minorUnits(currency)) * rate * 100);
}
