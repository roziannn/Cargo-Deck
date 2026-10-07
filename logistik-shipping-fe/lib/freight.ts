/** Freight cost estimate for domestic road transport. Pure functions, no I/O. */

export const ROAD_FACTOR = 1.3; // road distance is roughly 30% longer than the straight line

/** Estimated road distance in km (one decimal) between two coordinates. */
export function roadDistanceKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  const straight = 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
  return Math.round(straight * ROAD_FACTOR * 10) / 10;
}

/** Trip price: base fee + rate per km x distance, rounded up to the next 1,000 IDR. */
export function freightCost(distanceKm: number, baseFee: number, ratePerKm: number) {
  return Math.ceil((baseFee + ratePerKm * distanceKm) / 1000) * 1000;
}
