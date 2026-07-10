# AGENTS.md — Shot Scout AI Agent Guide

이 문서는 Antigravity(및 모든 AI 코딩 에이전트)가 이 레포를 작업할 때 반드시 따라야 할 가이드입니다.

---

## 핵심 참고 문서

| 문서 | 역할 |
|------|------|
| `docs/SPEC.md` | 기능 스펙 전문 (기능 0~4, 제약, 비목표) |
| `docs/PLAN.md` | 단계별 구현 로드맵 + 각 단계 검증 기준 |

**작업 전 반드시 두 문서를 숙독할 것.**

---

## 기술 제약 (엄수)

### ✅ 허용
- Vanilla TypeScript (strict 모드)
- Vite 빌드 도구 (이미 설정됨)
- 개발 전용 devDependency (타입, 린터, 테스트 러너 등)

### ❌ 금지
- 런타임 의존성 추가 (React, Vue, lodash 등 `dependencies` 항목 추가 금지)
- 태양/광학 계산에 외부 API 사용 (오프라인 순수 함수로 직접 구현)
- `any` 타입 남용 (TypeScript strict 유지)
- 검증 없이 단계 완료 처리

---

## 모듈 구조 (구현 시 따를 것)

```
src/
├── main.ts                 # 진입점 — UI 조립
├── style.css               # 디자인 토큰 + 기본 스타일
├── lib/
│   ├── optics.ts           # 광학 순수 함수 (FOV, DOF)
│   ├── solar.ts            # NOAA SPA 태양 위치 (오프라인)
│   ├── camera.ts           # getUserMedia 래퍼
│   ├── orientation.ts      # DeviceOrientation/Motion 래퍼
│   └── ratio.ts            # 라이팅 레이시오 측정 (canvas)
├── components/
│   ├── overlay.ts          # 화각 오버레이 캔버스
│   ├── solar-hud.ts        # 태양 위치 HUD
│   ├── ratio-hud.ts        # 레이시오 HUD
│   └── profile-ui.ts       # 렌즈 프로필 CRUD UI
└── store/
    └── profiles.ts         # localStorage 렌즈 프로필 CRUD
```

---

## 코딩 스타일

- 주석 최소화 — 코드가 자기 설명적으로 작성되어야 함
- 순수 함수는 `src/lib/`에, 사이드이펙트(DOM, 카메라, 센서)는 `src/components/`에
- 각 `lib/*.ts` 파일은 독립적으로 단위 테스트 가능해야 함
- 파일 당 역할 1개, 200줄 초과 시 분리 검토

---

## 배포 & 검증 워크플로

1. **배포 URL**: `https://hapew112.github.io/shot-scout/`
2. `main` push → GitHub Actions 자동 빌드/배포 (약 1~2분)
3. **로컬 빌드 확인**: `npm run build` — 오류 없이 `dist/` 생성
4. **폰 테스트**: 안드로이드 Chrome에서 HTTPS URL 접속 → 카메라/위치/방향 권한 동작 확인
5. **단계별 검증**: `docs/PLAN.md`의 각 단계 "검증 기준" 통과 후 다음 단계 진행

### 각 단계 완료 기준
- `npm run build` 성공
- 해당 단계의 수치 검증(예: 50mm → 39.6° FOV) 통과
- 폰 Chrome에서 실제 동작 확인

---

## iOS 주의사항

- `DeviceOrientationEvent.requestPermission()` — 사용자 제스처(버튼 클릭) 내부에서만 호출 가능
- 구현 시 iOS 분기 처리 필수 (`typeof DeviceOrientationEvent.requestPermission === 'function'`)
- 1차 구현 타겟은 **안드로이드 Chrome**; iOS는 동작하되 완벽하지 않아도 됨

---

## 세션 간 인수인계

이 레포 자체가 핸드오프 패키지입니다.  
새 세션 시작 시: `AGENTS.md` → `docs/SPEC.md` → `docs/PLAN.md` 순으로 읽고 현재 구현 상태를 `src/`에서 파악한 뒤 작업 시작.
