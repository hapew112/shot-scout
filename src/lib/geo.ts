export interface CoarseCoords {
  latitude: number
  longitude: number
}

// 태양 계산엔 ~1km 정밀도면 충분 — 소수 2자리로 절사해 정확한 위치를 다루지 않음
export async function getCurrentPosition(): Promise<CoarseCoords> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({
        latitude: Math.round(pos.coords.latitude * 100) / 100,
        longitude: Math.round(pos.coords.longitude * 100) / 100,
      }),
      err => reject(err),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
    )
  })
}
