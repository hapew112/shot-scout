/** iOS에서 권한 요청. 반드시 사용자 제스처 핸들러 안에서 호출할 것. */
export async function requestOrientationPermission(): Promise<boolean> {
  const DOE = DeviceOrientationEvent as unknown as {
    requestPermission?: () => Promise<string>
  }
  if (typeof DOE.requestPermission === 'function') {
    const result = await DOE.requestPermission()
    return result === 'granted'
  }
  return true // Android: 권한 불필요
}

/** DeviceOrientationEvent에서 나침반 방위각 추출 (도, N=0 CW) */
export function getCompassHeading(e: DeviceOrientationEvent): number {
  const ios = (e as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading
  if (ios != null) return ios
  if (e.alpha != null) return (360 - e.alpha) % 360
  return 0
}
