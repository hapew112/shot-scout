# Shot Scout

> 야외촬영 사전답사 PWA — 화각 오버레이 / 태양 위치 / 라이팅 레이시오

**배포 URL**: https://hapew112.github.io/shot-scout/

---

## 개요

Shot Scout는 야외 인물 촬영(코스프레, 포트레이트 등)의 사전답사를 돕는 모바일 우선 PWA입니다.  
현장에서 스마트폰 하나로 다음을 즉시 확인할 수 있습니다:

- **화각 오버레이** — 실제 카메라+렌즈의 프레임을 폰 프리뷰에 겹쳐 표시
- **태양 위치** — 현재 위치/시각 기준 태양 방위각·고도 (오프라인)
- **라이팅 레이시오** — 라이브 카메라 영상에서 좌/우 조명 비율 측정

모든 계산은 순수 TypeScript 함수로 구현되며 외부 API 의존성 없음.

---

## 로컬 개발

```bash
# 의존성 설치
npm install

# 브라우저 개발 서버
npm run dev

# 빌드
npm run build
```

### 폰에서 로컬 테스트 (HTTPS 필수 — 카메라/위치/방향 권한)

```bash
# 방법 1: vite --host + mkcert (권장)
brew install mkcert          # macOS
sudo apt install mkcert      # Linux (또는 직접 설치)
mkcert -install
mkcert localhost 192.168.x.x # 로컬 IP 포함
# vite.config.ts에 server.https 설정 후:
npm run dev -- --host

# 방법 2: @vitejs/plugin-basic-ssl (인증서 경고 있음, 테스트용)
npm install -D @vitejs/plugin-basic-ssl
# vite.config.ts plugins 배열에 basicSsl() 추가
npm run dev -- --host
```

같은 Wi-Fi 네트워크의 폰 브라우저에서 `https://<로컬IP>:5173/shot-scout/` 접속.

---

## 배포

`main` 브랜치에 push하면 GitHub Actions가 자동으로 빌드 & GitHub Pages 배포.  
배포 완료까지 약 1~2분 소요.

---

## 프로젝트 구조

```
shot-scout/
├── docs/
│   ├── SPEC.md          # 기능 스펙 전문
│   └── PLAN.md          # 단계별 구현 로드맵
├── AGENTS.md            # AI 에이전트 가이드라인
├── public/
│   ├── manifest.webmanifest
│   └── icons/
├── src/
│   ├── main.ts
│   ├── style.css
│   └── lib/             # (구현 단계에서 추가)
│       ├── optics.ts    # 광학 계산 순수 함수
│       ├── solar.ts     # NOAA SPA 태양 위치
│       └── ...
├── vite.config.ts
└── .github/workflows/deploy.yml
```

## 라이선스

MIT
