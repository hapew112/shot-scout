/** 수평 화각 (도) */
export function horizontalFov(focalMm: number, sensorWidthMm: number): number {
  return 2 * Math.atan(sensorWidthMm / (2 * focalMm)) * (180 / Math.PI)
}

/** 기본 CoC (mm) */
export function defaultCoc(sensorWidthMm: number): number {
  return sensorWidthMm / 1500
}

/** 피사계 심도 텍스트 */
export function dofText(
  aperture: number,
  focalMm: number,
  distanceM: number,
  coc: number
): string {
  const hyperfocalM = (focalMm * focalMm) / (aperture * coc * 1000)
  const nearM = (hyperfocalM * distanceM) / (hyperfocalM + distanceM)
  if (distanceM >= hyperfocalM) return `${nearM.toFixed(1)}m ~ ∞`
  const farM = (hyperfocalM * distanceM) / (hyperfocalM - distanceM)
  return `${nearM.toFixed(1)}m ~ ${farM.toFixed(1)}m`
}

/** 오버레이 스케일 비율 (렌즈 FOV / 폰 FOV) */
export function overlayScale(lensHfovDeg: number, phoneHfovDeg: number): number {
  const toRad = (d: number) => d * Math.PI / 180
  return Math.tan(toRad(lensHfovDeg) / 2) / Math.tan(toRad(phoneHfovDeg) / 2)
}
