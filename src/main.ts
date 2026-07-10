import './style.css'
import { startCamera, stopCamera } from './lib/camera'
import { dofText, overlayScale } from './lib/optics'
import { getSolarPosition, azimuthLabel } from './lib/solar'
import { getCurrentPosition } from './lib/geo'
import { requestOrientationPermission, getCompassHeading } from './lib/orientation'
import { measureRatio } from './lib/ratio'
import type { LensProfile } from './store/profiles'
import {
  ensureDefaults, listProfiles, saveProfile, deleteProfile,
  getActiveProfile, setActiveProfileId, createProfile, profileHfov, SENSOR_PRESETS,
} from './store/profiles'

// ── State ─────────────────────────────────────────
let mode: 'lens' | 'solar' | 'ratio' = 'lens'
let activeProfile: LensProfile | null = null
let phoneFovH = 70
let geoCoords: { lat: number; lon: number } | null = null
let compassHeading = 0
let cameraStarted = false
let ratioThrottle = 0
let orientationBound = false

// ── DOM refs (assigned after innerHTML) ─────────────
let video2: HTMLVideoElement
let canvas2: HTMLCanvasElement
let ctx2: CanvasRenderingContext2D
const offCanvas = new OffscreenCanvas(1, 1)
const offCtx   = offCanvas.getContext('2d')!

// ── App HTML ──────────────────────────────────────
document.getElementById('app')!.innerHTML = `
<div id="camera-wrap">
  <video id="video" autoplay playsinline muted></video>
  <canvas id="overlay-canvas"></canvas>
  <div id="cam-placeholder">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
    </svg>
    <span>카메라 시작을 눌러주세요</span>
  </div>
  <div id="top-bar">
    <span id="app-title">Shot Scout</span>
    <div id="profile-pill">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="3"/><path d="M3 12h1m16 0h1M12 3v1m0 16v1"/>
      </svg>
      <span id="profile-pill-label">프로필 없음</span>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    </div>
  </div>
  <div id="solar-hud" style="display:none">
    <div id="compass-ring">
      <svg viewBox="0 0 80 80">
        <circle cx="40" cy="40" r="36" stroke="rgba(255,255,255,.15)" stroke-width="1.5" fill="none"/>
        <text x="40" y="10" text-anchor="middle" fill="rgba(255,255,255,.4)" font-size="9" font-family="Inter,sans-serif">N</text>
        <text x="40" y="74" text-anchor="middle" fill="rgba(255,255,255,.4)" font-size="9" font-family="Inter,sans-serif">S</text>
        <text x="6" y="44" text-anchor="middle" fill="rgba(255,255,255,.4)" font-size="9" font-family="Inter,sans-serif">W</text>
        <text x="74" y="44" text-anchor="middle" fill="rgba(255,255,255,.4)" font-size="9" font-family="Inter,sans-serif">E</text>
        <line id="sun-arrow" x1="40" y1="40" x2="40" y2="12" stroke="#e8c77d" stroke-width="2.5" stroke-linecap="round"/>
        <circle cx="40" cy="40" r="3" fill="#e8c77d"/>
      </svg>
    </div>
    <div class="hud-value" id="solar-elev-val">--°</div>
    <div class="hud-sub" id="solar-sub">위치 정보 필요</div>
  </div>
  <div id="ratio-hud" style="display:none">
    <div class="hud-value" id="ratio-val" style="color:#81c784">-- : 1</div>
    <span class="ratio-badge" id="ratio-badge" style="color:#81c784">--</span>
    <div class="hud-sub" id="ratio-hint">카메라 시작 후 측정</div>
  </div>
</div>

<div id="bottom-nav">
  <div class="nav-tabs">
    <button class="nav-tab active" data-tab="lens" id="tab-lens">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
        <circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/>
      </svg>
      렌즈
    </button>
    <button class="nav-tab" data-tab="solar" id="tab-solar">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
        <circle cx="12" cy="12" r="4"/>
        <path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
      </svg>
      태양
    </button>
    <button class="nav-tab" data-tab="ratio" id="tab-ratio">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <line x1="12" y1="3" x2="12" y2="21"/>
      </svg>
      레이시오
    </button>
  </div>
  <div id="panel">
    <!-- Lens panel -->
    <div class="panel-section active" id="section-lens">
      <div class="info-row">
        <div class="info-chip"><span class="label">수평 FOV</span><span class="value" id="fov-val">--°</span></div>
        <div class="info-chip"><span class="label">피사계 심도</span><span class="value" id="dof-val">--</span></div>
        <div class="info-chip"><span class="label">초점거리</span><span class="value" id="focal-val">--mm</span></div>
      </div>
      <div class="slider-row">
        <span class="slider-label">피사거리</span>
        <input type="range" id="dist-slider" min="1" max="20" step="0.5" value="5">
        <span class="slider-val" id="dist-val">5m</span>
      </div>
      <div class="slider-row">
        <span class="slider-label">폰 FOV</span>
        <input type="range" id="phone-fov-slider" min="50" max="100" step="1" value="70">
        <span class="slider-val" id="phone-fov-val">70°</span>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn primary" id="btn-cam" style="flex:1">📷 카메라 시작</button>
        <button class="btn" id="btn-add-profile">+ 프로필</button>
      </div>
    </div>
    <!-- Solar panel -->
    <div class="panel-section" id="section-solar">
      <div class="info-row">
        <div class="info-chip"><span class="label">방위각</span><span class="value" id="az-val">--°</span></div>
        <div class="info-chip"><span class="label">고도</span><span class="value" id="elev-val">--°</span></div>
        <div class="info-chip"><span class="label">방향</span><span class="value" id="dir-val">--</span></div>
      </div>
      <div class="info-row">
        <div class="info-chip"><span class="label">폰 방향</span><span class="value" id="compass-val">--°</span></div>
        <div class="info-chip"><span class="label">태양 상대각</span><span class="value" id="rel-val">--°</span></div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn" id="btn-geo" style="flex:1">📍 위치 가져오기</button>
        <button class="btn" id="btn-orient">🧭 나침반 허용</button>
      </div>
    </div>
    <!-- Ratio panel -->
    <div class="panel-section" id="section-ratio">
      <div class="info-row">
        <div class="info-chip"><span class="label">레이시오</span><span class="value" id="ratio-chip-val">-- : 1</span></div>
        <div class="info-chip"><span class="label">좌 휘도</span><span class="value" id="lum-l-val">--</span></div>
        <div class="info-chip"><span class="label">우 휘도</span><span class="value" id="lum-r-val">--</span></div>
      </div>
      <div class="info-chip" style="padding:12px">
        <span class="label">프리셋</span>
        <span style="font-size:.85rem;margin-top:4px" id="ratio-preset-hint">카메라를 시작하면 측정됩니다</span>
      </div>
    </div>
  </div>
</div>

<!-- Profile modal -->
<div id="modal-backdrop" class="hidden">
  <div class="modal-sheet">
    <div class="modal-title">렌즈 프로필 관리</div>
    <div class="modal-row">
      <label>활성 프로필</label>
      <select id="modal-profile-select"></select>
    </div>
    <div style="display:flex;gap:8px">
      <button class="btn danger" id="btn-delete-profile" style="flex:1">삭제</button>
      <button class="btn" id="btn-close-modal" style="flex:1">닫기</button>
    </div>
    <hr style="border:none;border-top:1px solid var(--border)">
    <div class="modal-title" style="font-size:.9rem">새 프로필 추가</div>
    <div class="modal-row"><label>이름</label><input id="inp-name" placeholder="Sony A7IV + 85mm f/1.4"></div>
    <div class="modal-row"><label>초점거리 (mm)</label><input id="inp-focal" type="number" value="85" min="8" max="1200"></div>
    <div class="modal-row"><label>센서 크기</label>
      <select id="inp-sensor">${Object.entries(SENSOR_PRESETS).map(([k,v])=>`<option value="${v}">${k}</option>`).join('')}</select>
    </div>
    <div class="modal-row"><label>조리개</label><input id="inp-aperture" type="number" value="1.8" step="0.1" min="0.7" max="22"></div>
    <div class="modal-actions">
      <button class="btn primary" id="btn-save-profile">저장</button>
    </div>
  </div>
</div>

<div id="toast"></div>
`

// ── Wire up DOM refs after innerHTML ────────────────
video2  = document.getElementById('video') as HTMLVideoElement
canvas2 = document.getElementById('overlay-canvas') as HTMLCanvasElement
ctx2    = canvas2.getContext('2d')!

// ── Init ──────────────────────────────────────────
ensureDefaults()
activeProfile = getActiveProfile()
refreshUI()
bindEvents()
requestAnimationFrame(loop)

// ── Events ────────────────────────────────────────
function bindEvents() {
  // Tab switching
  document.querySelectorAll<HTMLButtonElement>('.nav-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      mode = btn.dataset.tab as typeof mode
      document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      document.querySelectorAll('.panel-section').forEach(s => s.classList.remove('active'))
      document.getElementById(`section-${mode}`)!.classList.add('active')
      const sh = document.getElementById('solar-hud')!
      const rh = document.getElementById('ratio-hud')!
      sh.style.display = mode === 'solar' ? 'flex' : 'none'
      rh.style.display = mode === 'ratio' ? 'flex' : 'none'
    })
  })

  // Profile pill → open modal
  document.getElementById('profile-pill')!.addEventListener('click', openProfileModal)
  document.getElementById('btn-add-profile')!.addEventListener('click', openProfileModal)
  document.getElementById('btn-close-modal')!.addEventListener('click', closeProfileModal)
  document.getElementById('modal-backdrop')!.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeProfileModal()
  })

  document.getElementById('btn-save-profile')!.addEventListener('click', () => {
    const name     = (document.getElementById('inp-name') as HTMLInputElement).value.trim()
    const focalMm  = Number((document.getElementById('inp-focal') as HTMLInputElement).value)
    const sensorW  = Number((document.getElementById('inp-sensor') as HTMLSelectElement).value)
    const aperture = Number((document.getElementById('inp-aperture') as HTMLInputElement).value)
    if (!name || !focalMm || !sensorW) { showToast('입력을 확인해주세요'); return }
    const p = createProfile(name, focalMm, sensorW, aperture)
    saveProfile(p); setActiveProfileId(p.id)
    activeProfile = p; refreshUI(); closeProfileModal()
  })

  document.getElementById('btn-delete-profile')!.addEventListener('click', () => {
    const sel = document.getElementById('modal-profile-select') as HTMLSelectElement
    if (!sel.value) return
    deleteProfile(sel.value)
    activeProfile = getActiveProfile(); refreshUI(); openProfileModal()
  })

  document.getElementById('modal-profile-select')!.addEventListener('change', e => {
    const id = (e.target as HTMLSelectElement).value
    setActiveProfileId(id)
    activeProfile = getActiveProfile(); refreshUI()
  })

  // Camera button
  document.getElementById('btn-cam')!.addEventListener('click', async () => {
    if (cameraStarted) {
      stopCamera(video2); cameraStarted = false
      document.getElementById('cam-placeholder')!.classList.remove('hidden')
      ;(document.getElementById('btn-cam') as HTMLButtonElement).textContent = '📷 카메라 시작'
    } else {
      try {
        await startCamera(video2); cameraStarted = true
        document.getElementById('cam-placeholder')!.classList.add('hidden')
        ;(document.getElementById('btn-cam') as HTMLButtonElement).textContent = '⏹ 카메라 종료'
      } catch { showToast('카메라 권한이 필요합니다') }
    }
  })

  // Dist slider
  const distSlider = document.getElementById('dist-slider') as HTMLInputElement
  distSlider.addEventListener('input', () => {
    document.getElementById('dist-val')!.textContent = `${distSlider.value}m`
    updateLensInfo()
  })

  // Phone FOV slider
  const phoneFovSlider = document.getElementById('phone-fov-slider') as HTMLInputElement
  phoneFovSlider.addEventListener('input', () => {
    phoneFovH = Number(phoneFovSlider.value)
    document.getElementById('phone-fov-val')!.textContent = `${phoneFovH}°`
  })

  // Geo button
  document.getElementById('btn-geo')!.addEventListener('click', async () => {
    try {
      const c = await getCurrentPosition()
      geoCoords = { lat: c.latitude, lon: c.longitude }
      showToast(`위치 확인됨 (약 1km 정밀도)`)
    } catch { showToast('위치 권한이 필요합니다') }
  })

  // Orientation button
  document.getElementById('btn-orient')!.addEventListener('click', async () => {
    const ok = await requestOrientationPermission()
    if (!ok) { showToast('방향 센서 권한 거부됨'); return }
    if (!orientationBound) {
      window.addEventListener('deviceorientation', e => {
        compassHeading = getCompassHeading(e)
      }, true)
      orientationBound = true
    }
    showToast('나침반 활성화됨')
  })
}

// ── Overlay canvas draw ───────────────────────────
function drawOverlay() {
  const el = document.getElementById('camera-wrap')!
  const W = el.offsetWidth; const H = el.offsetHeight
  canvas2.width = W; canvas2.height = H

  ctx2.clearRect(0, 0, W, H)

  if (!activeProfile) return

  const lensHfov = profileHfov(activeProfile)
  const scale = Math.min(overlayScale(lensHfov, phoneFovH), 1)
  const rw = W * scale; const rh = H * scale
  const rx = (W - rw) / 2; const ry = (H - rh) / 2

  // Dark vignette outside frame
  ctx2.fillStyle = 'rgba(0,0,0,0.35)'
  ctx2.fillRect(0, 0, W, H)
  ctx2.clearRect(rx, ry, rw, rh)

  // Frame border
  ctx2.strokeStyle = 'rgba(232,199,125,0.9)'
  ctx2.lineWidth = 2
  ctx2.strokeRect(rx, ry, rw, rh)

  // Corner marks
  const cs = Math.min(rw, rh) * 0.08
  ctx2.lineWidth = 3
  ctx2.strokeStyle = '#e8c77d'
  const corners: [number, number, number, number][] = [
    [rx, ry, 1, 1], [rx+rw, ry, -1, 1], [rx, ry+rh, 1, -1], [rx+rw, ry+rh, -1, -1]
  ]
  corners.forEach(([x, y, dx, dy]) => {
    ctx2.beginPath(); ctx2.moveTo(x + dx * cs, y); ctx2.lineTo(x, y); ctx2.lineTo(x, y + dy * cs); ctx2.stroke()
  })

  // FOV label
  ctx2.fillStyle = 'rgba(232,199,125,0.85)'
  ctx2.font = '700 11px Inter,sans-serif'
  ctx2.textAlign = 'left'
  ctx2.fillText(`${lensHfov.toFixed(1)}° FOV`, rx + 8, ry + 16)

  // Ratio guide box when in ratio mode
  if (mode === 'ratio') {
    ctx2.strokeStyle = 'rgba(255,255,255,0.4)'
    ctx2.lineWidth = 1
    ctx2.setLineDash([6, 4])
    const bx = W * 0.2; const by = H * 0.2; const bw = W * 0.6; const bh = H * 0.6
    ctx2.strokeRect(bx, by, bw, bh)
    const mx = bx + bw / 2
    ctx2.beginPath(); ctx2.moveTo(mx, by); ctx2.lineTo(mx, by + bh); ctx2.stroke()
    ctx2.setLineDash([])
    ctx2.fillStyle = 'rgba(255,255,255,0.3)'
    ctx2.font = '600 10px Inter,sans-serif'
    ctx2.textAlign = 'center'
    ctx2.fillText('L', bx + bw * 0.25, by + 18)
    ctx2.fillText('R', bx + bw * 0.75, by + 18)
  }
}

// ── Ratio measurement ─────────────────────────────
function measureRatioFromVideo() {
  if (!cameraStarted || !video2.videoWidth) return
  offCanvas.width = video2.videoWidth; offCanvas.height = video2.videoHeight
  offCtx.drawImage(video2, 0, 0)
  const result = measureRatio(offCtx, offCanvas.width, offCanvas.height)

  const ratioStr = `${result.ratio.toFixed(1)} : 1`
  ;(document.getElementById('ratio-val') as HTMLElement).textContent = ratioStr
  ;(document.getElementById('ratio-val') as HTMLElement).style.color = result.color
  ;(document.getElementById('ratio-badge') as HTMLElement).textContent = result.label
  ;(document.getElementById('ratio-badge') as HTMLElement).style.color = result.color
  ;(document.getElementById('ratio-hint') as HTMLElement).textContent = result.hint
  ;(document.getElementById('ratio-chip-val') as HTMLElement).textContent = ratioStr
  ;(document.getElementById('lum-l-val') as HTMLElement).textContent = `${(result.leftLum * 100).toFixed(0)}%`
  ;(document.getElementById('lum-r-val') as HTMLElement).textContent = `${(result.rightLum * 100).toFixed(0)}%`
  ;(document.getElementById('ratio-preset-hint') as HTMLElement).textContent = result.hint
}

// ── Solar update ──────────────────────────────────
function updateSolar() {
  if (!geoCoords) return
  const pos = getSolarPosition(new Date(), geoCoords.lat, geoCoords.lon)
  const relAngle = ((pos.azimuth - compassHeading + 360) % 360)
  const relStr = relAngle > 180 ? `왼쪽 ${(360 - relAngle).toFixed(0)}°` : `오른쪽 ${relAngle.toFixed(0)}°`

  ;(document.getElementById('solar-elev-val') as HTMLElement).textContent = `${pos.elevation.toFixed(1)}°`
  ;(document.getElementById('solar-sub') as HTMLElement).textContent =
    `방위각 ${pos.azimuth.toFixed(1)}° (${azimuthLabel(pos.azimuth)}) · ${relStr}`
  ;(document.getElementById('az-val') as HTMLElement).textContent = `${pos.azimuth.toFixed(1)}°`
  ;(document.getElementById('elev-val') as HTMLElement).textContent = `${pos.elevation.toFixed(1)}°`
  ;(document.getElementById('dir-val') as HTMLElement).textContent = azimuthLabel(pos.azimuth)
  ;(document.getElementById('compass-val') as HTMLElement).textContent = `${compassHeading.toFixed(0)}°`
  ;(document.getElementById('rel-val') as HTMLElement).textContent = relStr

  // Rotate sun arrow
  const arrow = document.getElementById('sun-arrow')
  if (arrow) {
    const r = (pos.azimuth - compassHeading) * Math.PI / 180
    const cx = 40; const cy = 40; const len = 26
    const x2 = cx + len * Math.sin(r); const y2 = cy - len * Math.cos(r)
    arrow.setAttribute('x2', x2.toFixed(1))
    arrow.setAttribute('y2', y2.toFixed(1))
  }
}

// ── Lens info ─────────────────────────────────────
function updateLensInfo() {
  if (!activeProfile) return
  const dist = Number((document.getElementById('dist-slider') as HTMLInputElement)?.value ?? 5)
  const fov = profileHfov(activeProfile)
  const dof = dofText(activeProfile.aperture, activeProfile.focalMm, dist, activeProfile.coc)
  ;(document.getElementById('fov-val') as HTMLElement).textContent = `${fov.toFixed(1)}°`
  ;(document.getElementById('dof-val') as HTMLElement).textContent = dof
  ;(document.getElementById('focal-val') as HTMLElement).textContent = `${activeProfile.focalMm}mm`
}

// ── Refresh UI ────────────────────────────────────
function refreshUI() {
  const label = document.getElementById('profile-pill-label')
  if (label) label.textContent = activeProfile?.name ?? '프로필 없음'
  updateLensInfo()
}

// ── Modal ─────────────────────────────────────────
function openProfileModal() {
  const modal = document.getElementById('modal-backdrop')!
  const sel   = document.getElementById('modal-profile-select') as HTMLSelectElement
  const profiles = listProfiles()
  sel.innerHTML = profiles.map(p =>
    `<option value="${p.id}" ${p.id === activeProfile?.id ? 'selected' : ''}>${p.name}</option>`
  ).join('')
  modal.classList.remove('hidden')
}
function closeProfileModal() {
  document.getElementById('modal-backdrop')!.classList.add('hidden')
}

// ── Toast ─────────────────────────────────────────
let toastTimer: ReturnType<typeof setTimeout>
function showToast(msg: string) {
  const t = document.getElementById('toast')!
  t.textContent = msg; t.classList.add('show')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => t.classList.remove('show'), 2500)
}

// ── RAF loop ──────────────────────────────────────
function loop(ts: number) {
  drawOverlay()
  if (mode === 'solar') updateSolar()
  if (mode === 'ratio' && ts - ratioThrottle > 500) {
    measureRatioFromVideo()
    ratioThrottle = ts
  }
  requestAnimationFrame(loop)
}

// ── Service Worker ────────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/shot-scout/sw.js').catch(() => {})
}
