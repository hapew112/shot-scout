export interface SolarPosition {
  azimuth: number   // 0~360° (N=0, E=90, S=180, W=270)
  elevation: number // -90~90°
}

const toRad = (d: number) => d * Math.PI / 180
const toDeg = (r: number) => r * 180 / Math.PI
const mod = (n: number, m: number) => ((n % m) + m) % m

function julianDay(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5
}

export function getSolarPosition(
  date: Date,
  latDeg: number,
  lonDeg: number
): SolarPosition {
  const JD = julianDay(date)
  const n  = JD - 2451545.0

  const L      = mod(280.460 + 0.9856474 * n, 360)
  const gRad   = toRad(mod(357.528 + 0.9856003 * n, 360))
  const lambda = toRad(L + 1.915 * Math.sin(gRad) + 0.020 * Math.sin(2 * gRad))
  const eps    = toRad(23.439 - 0.0000004 * n)

  // Right ascension (hours)
  const RA = mod(toDeg(Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda))), 360) / 15
  // Declination
  const declRad = Math.asin(Math.sin(eps) * Math.sin(lambda))

  // UT hours (0–24)
  const UTh = mod(date.getTime() / 3600000, 24)
  const GMST = mod(6.697375 + 0.0657098242 * n + UTh, 24)
  const LMST = mod(GMST + lonDeg / 15, 24)
  const HRad = toRad(mod((LMST - RA) * 15, 360))

  const latRad = toRad(latDeg)
  const sinElev =
    Math.sin(latRad) * Math.sin(declRad) +
    Math.cos(latRad) * Math.cos(declRad) * Math.cos(HRad)
  const elevation = toDeg(Math.asin(Math.max(-1, Math.min(1, sinElev))))

  // Azimuth from North, clockwise
  const azRad = Math.atan2(
    -Math.sin(HRad),
    Math.cos(latRad) * Math.tan(declRad) - Math.sin(latRad) * Math.cos(HRad)
  )
  const azimuth = mod(toDeg(azRad) + 180, 360)

  return { azimuth, elevation }
}

/** 방위각 → 텍스트 */
export function azimuthLabel(az: number): string {
  const dirs = ['N','NE','E','SE','S','SW','W','NW']
  return dirs[Math.round(az / 45) % 8]
}
