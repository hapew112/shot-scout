import './style.css'

// Shot Scout — scaffold entry point
// 실제 기능 구현은 docs/PLAN.md의 단계별 로드맵을 따른다.

const app = document.querySelector<HTMLDivElement>('#app')!

app.innerHTML = `
  <div style="text-align:center;gap:1rem;display:flex;flex-direction:column;align-items:center">
    <img src="/shot-scout/icons/icon-192.png" width="80" height="80" alt="Shot Scout icon"
         style="border-radius:20px;margin-bottom:.5rem" />
    <h1 style="font-size:1.8rem;font-weight:700;letter-spacing:-.02em">Shot Scout</h1>
    <p style="color:var(--color-muted);font-size:.95rem">
      야외촬영 사전답사 도구 — 구현 진행 중
    </p>
  </div>
`
