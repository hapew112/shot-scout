# Shot Scout — 기능 스펙 (SPEC.md)

> 이 문서는 확정된 사용자 스펙의 전문입니다. 구현 전 반드시 숙독하세요.

---

## 프로젝트 정의

**Shot Scout**: 야외 인물 촬영(코스프레, 포트레이트 등) 사전답사용 모바일 PWA.  
현장에서 스마트폰 하나로 카메라 화각 시뮬레이션, 태양 위치 파악, 조명 비율 측정을 수행한다.

---

## 기능 0 — 렌즈 프로필 관리

### 요구사항
- 사용자가 사용하는 카메라 바디 + 렌즈 조합을 저장/조회/삭제
- 프로필 항목:
  - 이름 (문자열, 예: "Sony A7IV + 85mm f/1.4")
  - 초점 거리 (mm, 정수)
  - 센서 폭 (mm, 실수) — 풀프레임=36, APS-C Sony=23.5, APS-C Canon=22.3, MFT=17.3
  - 조리개 (f-stop, 실수, 선택)
  - CoC (Circle of Confusion, mm, 기본값: 센서폭/1500)
- localStorage 저장, 앱 재실행 후에도 유지
- 드롭다운 UI로 활성 프로필 전환

### 수치 계산 (`src/lib/optics.ts`)

```
horizontalFov(focalMm, sensorWidthMm):
  = 2 × atan(sensorWidthMm / (2 × focalMm)) × (180 / π)  [도 단위]

dofText(aperture, focalMm, distanceM, coc):
  hyperfocal = focalMm² / (aperture × coc × 1000)  [m]
  near = (hyperfocal × distanceM) / (hyperfocal + distanceM)
  far  = (hyperfocal × distanceM) / (hyperfocal - distanceM)  [∞ 처리]
  → "near ~ far m" 또는 "∞" 반환
```

### 검증 기준
| 입력 | 기대 출력 |
|------|-----------|
| 50mm, 풀프레임(36mm) | 수평 FOV ≈ 39.6° |
| 85mm, 풀프레임(36mm) | 수평 FOV ≈ 23.9° |
| 35mm, APS-C Sony(23.5mm) | 수평 FOV ≈ 35.4° |

---

## 기능 1 — 카메라 프리뷰 + 화각 오버레이

### 요구사항
- 폰 후면 카메라 스트림 표시: `getUserMedia({ video: { facingMode: 'environment' } })`
- 선택된 렌즈 프로필의 FOV를 폰 카메라 FOV로 나눠 오버레이 사각형 비율 결정
- 오버레이: 반투명 테두리 사각형 + 코너 마커
- 폰 카메라 FOV 보정:
  - **방법 A (자동 캘리브레이션)**: A4 용지(297×210mm) 기준 거리에서 측정
  - **방법 B (수동 설정)**: 폰 모델 프리셋 목록 + 사용자 직접 입력 (초기 구현)

### UI 레이아웃
```
┌─────────────────────────┐
│  [렌즈 프로필 드롭다운]  │
│                         │
│   ┌───────────────┐     │  ← 오버레이 사각형
│   │               │     │
│   │  카메라 프리뷰 │     │
│   │               │     │
│   └───────────────┘     │
│  FOV: 39.6° | DOF: 2~8m │
└─────────────────────────┘
```

### 검증 기준
- 오버레이 크기 변경이 렌즈 변경 시 즉시 반영
- 폰을 좌우로 기울여도 오버레이 고정 (카메라 스트림에 고정)

---

## 기능 2 — 태양 위치 + 나침반

### 요구사항
- 현재 GPS 위치 + 시각 → 태양 방위각(0~360°), 고도(-90~90°) 계산
- 알고리즘: NOAA Solar Position Algorithm (SPA) 순수 JS 구현 (오프라인)
- 나침반: `DeviceOrientationEvent`의 `webkitCompassHeading` 또는 `alpha` 활용
- 표시: 화면에 태양 방향 화살표 + "방위각 Xnn° / 고도 Xnn°" 텍스트
- 폰 방향 대비 태양 상대 각도 표시 (예: "오른쪽 45°")

### 권한 처리
```
위치: navigator.geolocation.getCurrentPosition()
방향 (iOS): DeviceOrientationEvent.requestPermission() — 반드시 사용자 버튼 클릭 핸들러 내부에서 호출
방향 (Android): 별도 권한 요청 불필요
```

### 검증 기준
- 알려진 날짜/위치/시각에서 NOAA 웹 계산기(https://gml.noaa.gov/grad/solcalc/) 결과와 방위각 ±1°, 고도 ±1° 이내 일치

---

## 기능 3 — 라이팅 레이시오 측정

### 요구사항
- 가이드 박스(화면 중앙 사각형) 좌/우 절반 평균 휘도를 canvas `getImageData`로 계산
- 휘도 공식: `Y = 0.2126R + 0.7152G + 0.0722B` (ITU-R BT.709)
- 레이시오 = max(leftY, rightY) / min(leftY, rightY)
- 업데이트 주기: 0.5~1 FPS (requestAnimationFrame 사용 + 타임스탬프 스로틀)
- 표시: "X.X : 1" + 색상 피드백
  - 1.0~2.0: 초록 (소프트)
  - 2.0~4.0: 노랑 (렘브란트)
  - 4.0~8.0: 주황 (스플릿)
  - 8.0+: 빨강 (과도)

### 프리셋 힌트
| 레이시오 | 명칭 | 방향 힌트 |
|---------|------|----------|
| 2:1 (±0.5) | Soft | 주광 정면/측면 45° |
| 4:1 (±1) | Rembrandt | 주광 측면 45°, 반사광 최소 |
| 8:1+ | Split | 주광 정측면 90° |

### 검증 기준
- 균일 회색 화면(Y≈Y): 레이시오 ≈ 1.0 표시
- 좌측 밝고 우측 어두운 화면: 정확한 비율 표시 (직접 픽셀 계산과 대조)

---

## 기능 4 — PWA 마무리

### 요구사항
- Service Worker: 오프라인 셸 캐시 (앱 셸 + 모든 static asset)
- 전략: Cache-First for assets, Network-First for API (없음 → 전부 Cache-First)
- 설치 프롬프트: `beforeinstallprompt` 이벤트 캡처 → 화면 내 "설치" 버튼
- Lighthouse PWA 점수 90+ 목표

---

## 기능 5 (MVP 이후) — 촬영 기록 스냅샷

> 이 기능은 MVP 완료 후 구현. 스펙 미확정.

- 현재 화면(오버레이+정보) 캡처 → PNG 저장
- 메타데이터(위치, 시각, 렌즈 프로필, 태양 위치, 레이시오) 첨부

---

## 비목표 (이 버전에서 구현하지 않음)

- 서버/백엔드 없음 (완전 클라이언트사이드)
- 사용자 계정/클라우드 동기화 없음
- AR 기능 (Three.js 등 3D 렌더링) 없음
- 날씨 API 연동 없음
- iOS Safari 완벽 지원 (안드로이드 Chrome 우선, iOS는 best-effort)

---

## 제약 사항

- **런타임 의존성 0**: 모든 계산은 Vanilla TS 순수 함수
- **오프라인 동작**: GPS + 태양 계산은 네트워크 불필요
- **HTTPS 필수**: 카메라/위치/방향 권한은 HTTPS에서만 동작 → GitHub Pages로 해결
- **모바일 우선**: 세로 화면 기준 설계, 가로 화면 대응은 선택

---

## 확정된 기술 스택

- **프레임워크**: Vite + Vanilla TypeScript (strict)
- **빌드**: `npm run build` → `dist/` → GitHub Actions → GitHub Pages
- **배포**: `https://hapew112.github.io/shot-scout/`
- **상태 저장**: localStorage만 사용
- **테스트**: Vitest (구현 단계에서 설정)
