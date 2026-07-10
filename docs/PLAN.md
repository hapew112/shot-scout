# Shot Scout — 구현 로드맵 (PLAN.md)

> Antigravity 에이전트 실행용. 각 단계는 검증 통과 후 다음 단계로 진행.

---

## 진행 방식

1. 이 문서의 단계 순서대로 구현
2. 각 단계 완료 기준: `npm run build` 성공 + 해당 단계 검증 기준 통과
3. 검증 없이 단계 완료 처리 금지
4. 기능 스펙 상세는 `docs/SPEC.md` 참조

---

## Phase 1: 렌즈 프로필 + 화각 계산 + 정적 오버레이

### 목표
카메라 없이도 렌즈 FOV를 계산하고, 화면에 정적(static) 오버레이를 표시.

### 구현 순서

#### 1-A. 광학 순수 함수 (`src/lib/optics.ts`)

```typescript
// 수평 화각 (도 단위)
export function horizontalFov(focalMm: number, sensorWidthMm: number): number

// 피사계 심도 텍스트
export function dofText(
  aperture: number,
  focalMm: number,
  distanceM: number,
  coc: number
): string

// 기본 CoC 계산
export function defaultCoc(sensorWidthMm: number): number
// → sensorWidthMm / 1500
```

**모든 함수는 순수 함수 (사이드이펙트 없음)**

#### 1-B. 렌즈 프로필 스토어 (`src/store/profiles.ts`)

```typescript
export interface LensProfile {
  id: string           // crypto.randomUUID()
  name: string
  focalMm: number
  sensorWidthMm: number
  aperture?: number
  coc?: number         // 미설정 시 defaultCoc() 사용
}

// localStorage CRUD
export function listProfiles(): LensProfile[]
export function saveProfile(p: LensProfile): void
export function deleteProfile(id: string): void
export function getActiveProfile(): LensProfile | null
export function setActiveProfile(id: string): void
```

#### 1-C. 프로필 UI (`src/components/profile-ui.ts`)
- 드롭다운 (활성 프로필 선택)
- "추가" 버튼 → 폼(모달 또는 인라인)
- "삭제" 버튼

#### 1-D. 정적 오버레이 (`src/components/overlay.ts`)
- `<canvas>` 위에 렌즈 FOV 사각형 그리기
- 폰 FOV는 Phase 2까지 임시값(70° 기본) 사용
- 비율: `overlayRatio = tan(lensHfov/2) / tan(phoneFov/2)`

### 검증 기준
```
horizontalFov(50, 36) ≈ 39.6° (±0.1°)
horizontalFov(85, 36) ≈ 23.9° (±0.1°)
horizontalFov(35, 23.5) ≈ 35.4° (±0.1°)
localStorage에 프로필 저장 후 새로고침 → 유지 확인
```

---

## Phase 2: 카메라 프리뷰 + 화각 오버레이 (라이브)

### 목표
폰 후면 카메라 영상 위에 렌즈 화각 오버레이를 실시간 표시.

### 구현 순서

#### 2-A. 카메라 래퍼 (`src/lib/camera.ts`)

```typescript
export async function startCamera(videoEl: HTMLVideoElement): Promise<void>
// getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 } } })

export function stopCamera(videoEl: HTMLVideoElement): void

export function getVideoAspect(videoEl: HTMLVideoElement): number
// → videoWidth / videoHeight
```

#### 2-B. 폰 FOV 보정 (`src/components/phone-fov-calibration.ts`)

**Phase 2 초기: 수동 설정 방식**
```typescript
// 폰 모델 프리셋 (수평 FOV)
const PHONE_PRESETS: Record<string, number> = {
  'Galaxy S23': 69,
  'Galaxy S24': 71,
  'Pixel 8': 68,
  // ... 확장 가능
  'Custom': 0,  // 사용자 직접 입력
}
```

**Phase 2 후반 (선택): A4 자동 캘리브레이션**
```
절차: A4 용지(297mm 폭)를 카메라에서 D미터 거리에 배치
계산: phoneFov = 2 × atan((297 / 2) / (D × 1000)) × (180/π)
UI: 거리 입력 → "캘리브레이션 시작" → 결과 저장
```

#### 2-C. 오버레이 레이어 (Phase 1 overlay.ts 업데이트)
- `<video>` 위에 `<canvas>` 절대 위치로 overlay
- 비디오 크기 변경 시 canvas resize 처리 (`ResizeObserver`)

### 검증 기준
```
- 카메라 스트림 표시 확인 (폰에서 실제 테스트)
- 렌즈 변경 시 오버레이 즉시 업데이트
- 폰 FOV 70° 기준, 50mm 풀프레임 오버레이 ≈ 화면의 60% 너비
```

---

## Phase 3: 태양 위치 + 나침반

### 목표
현재 위치/시각에서 태양 방위각·고도를 계산하고, 폰 방향과 결합해 상대 각도 표시.

### 구현 순서

#### 3-A. NOAA SPA 구현 (`src/lib/solar.ts`)

**Julian Day 계산 포함 완전 구현** (외부 라이브러리 금지)

```typescript
export interface SolarPosition {
  azimuth: number   // 0~360° (북=0, 동=90)
  elevation: number // -90~90°
}

export function getSolarPosition(
  date: Date,
  latDeg: number,
  lonDeg: number
): SolarPosition
```

핵심 수식:
1. Julian Day Number 계산
2. Equation of Time (시차 방정식)
3. Solar declination (태양 적위)
4. Hour angle → azimuth, elevation 변환

참고: NOAA SPA 문서 https://gml.noaa.gov/grad/solcalc/solareqns.PDF

#### 3-B. 위치 권한 (`src/lib/geo.ts`)

```typescript
export async function getCurrentPosition(): Promise<GeolocationCoordinates>
// navigator.geolocation.getCurrentPosition 래퍼
// 에러: PermissionDeniedError, PositionUnavailableError, TimeoutError
```

#### 3-C. 방향 센서 (`src/lib/orientation.ts`)

```typescript
export async function requestOrientationPermission(): Promise<boolean>
// iOS: DeviceOrientationEvent.requestPermission()
// Android: 즉시 true 반환

export function getCompassHeading(event: DeviceOrientationEvent): number
// webkitCompassHeading (iOS) 또는 (360 - alpha) (Android)
```

#### 3-D. 태양 HUD (`src/components/solar-hud.ts`)
- 방위각/고도 텍스트 표시
- 태양 방향 화살표 (폰 방향 대비 상대 각도)
- GPS + 방향 권한 없을 시 안내 메시지

### 검증 기준
```
검증 도구: https://gml.noaa.gov/grad/solcalc/

예시 (서울, 2025-06-21 정오 KST):
  위도 37.5665, 경도 126.9780
  기대값: 방위각 ≈ 178°, 고도 ≈ 76°
  허용 오차: ±1°
```

---

## Phase 4: 라이팅 레이시오 측정

### 목표
카메라 프리뷰에서 좌/우 조명 비율을 실시간 측정하고 시각적 피드백 제공.

### 구현 순서

#### 4-A. 레이시오 계산 (`src/lib/ratio.ts`)

```typescript
export interface RatioResult {
  leftLuminance: number   // 0~255
  rightLuminance: number  // 0~255
  ratio: number           // ≥ 1.0
  label: 'soft' | 'rembrandt' | 'split' | 'extreme'
  hint: string            // "주광 정면/측면 45°"
}

export function measureRatio(
  ctx: CanvasRenderingContext2D,
  boxRect: DOMRect
): RatioResult

// 휘도: Y = 0.2126R + 0.7152G + 0.0722B
```

#### 4-B. 레이시오 HUD (`src/components/ratio-hud.ts`)
- 화면 중앙 가이드 박스 (오버레이 사각형과 별개)
- "X.X : 1" 텍스트 + 배경 색상 피드백
- 스로틀: `performance.now()` 기반 500ms 간격
- 프리셋 힌트 텍스트 (soft/rembrandt/split)

#### 4-C. canvas 통합
- 카메라 `<video>` → 오프스크린 `<canvas>` drawImage → getImageData
- **주의**: CORS cross-origin 영상에 getImageData 사용 불가 (getUserMedia는 OK)

### 검증 기준
```
- 균일한 단색 화면 → 레이시오 ≈ 1.0
- 좌측: RGB(200,200,200) / 우측: RGB(100,100,100)
  → 좌측 Y ≈ 200, 우측 Y ≈ 100, 레이시오 ≈ 2.0
- 업데이트 주기 500ms 스로틀 확인 (requestAnimationFrame 남용 금지)
```

---

## Phase 5: PWA 마무리

### 목표
Service Worker로 오프라인 동작 보장, 설치 프롬프트 구현.

### 구현 순서

#### 5-A. Service Worker (`public/sw.js`)

```javascript
// Cache-First 전략
const CACHE_NAME = 'shot-scout-v1'
const SHELL_ASSETS = [
  '/shot-scout/',
  '/shot-scout/index.html',
  '/shot-scout/assets/...', // 빌드 후 실제 파일명
  '/shot-scout/manifest.webmanifest',
  '/shot-scout/icons/icon-192.png',
  '/shot-scout/icons/icon-512.png',
]

self.addEventListener('install', ...)
self.addEventListener('activate', ...)  // 구 캐시 정리
self.addEventListener('fetch', ...)     // Cache-First
```

> **Note**: Vite 빌드 시 asset 파일명이 해시화됨. SW 설치 단계에서 `/shot-scout/assets/` 전체를 cache.addAll 하거나, 빌드 후 asset 목록을 sw.js에 주입하는 방식 사용.

#### 5-B. SW 등록 (`src/main.ts`에 추가)

```typescript
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/shot-scout/sw.js')
}
```

#### 5-C. 설치 프롬프트

```typescript
let deferredPrompt: BeforeInstallPromptEvent | null = null
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  deferredPrompt = e as BeforeInstallPromptEvent
  // 설치 버튼 표시
})
```

### 검증 기준
```
- Chrome DevTools → Application → Service Workers: 상태 "activated"
- 오프라인 모드(Network 탭 → Offline): 앱 로드 정상
- Lighthouse PWA 카테고리 90+ 점수
- 안드로이드 Chrome 설치 프롬프트 동작 확인
```

---

## Phase 6 (MVP 이후): 촬영 기록 스냅샷

> 기능 정의 미확정. 사용자 확인 후 구현.

### 예상 기능
- 현재 화면(오버레이+HUD) 캡처 → PNG
- 메타데이터: 위치, 시각, 렌즈 프로필, 태양 위치, 레이시오
- 저장 방식: 기기 갤러리 (`<a download>`) 또는 IndexedDB

---

## 모듈 의존성 그래프

```
main.ts
├── components/profile-ui.ts → store/profiles.ts → lib/optics.ts
├── components/overlay.ts   → store/profiles.ts, lib/optics.ts
├── components/solar-hud.ts → lib/solar.ts, lib/geo.ts, lib/orientation.ts
├── components/ratio-hud.ts → lib/ratio.ts
└── lib/camera.ts (독립)
```

---

## 공통 패턴

### 센서 구독 해제
모든 `addEventListener` 기반 센서는 컴포넌트 언마운트 시 `removeEventListener` 처리.

### 에러 처리
- 권한 거부: 안내 메시지 표시, 기능 비활성화 (크래시 금지)
- 위치 없음: 수동 위도/경도 입력 폼 폴백

### 성능
- 레이시오 측정: 500ms 스로틀 (RAF 매 프레임 금지)
- 오버레이: 렌즈 변경 시에만 재계산 (라이브 비디오 위 canvas 고정)
