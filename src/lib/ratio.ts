export type RatioLabel = 'flat' | 'soft' | 'rembrandt' | 'hard' | 'split'

export interface RatioResult {
  leftLum: number
  rightLum: number
  ratio: number
  label: RatioLabel
  hint: string
  color: string
}

// 조명비는 선형 광량 기준 — sRGB 감마를 풀지 않으면 실제 4:1이 ~1.9:1로 나옴
const linear = (v: number) => Math.pow(v / 255, 2.2)

function luminance(r: number, g: number, b: number): number {
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
}

function avgLuminance(data: Uint8ClampedArray, xStart: number, xEnd: number, yStart: number, yEnd: number, width: number): number {
  let sum = 0, count = 0
  for (let y = yStart; y < yEnd; y++) {
    for (let x = xStart; x < xEnd; x++) {
      const i = (y * width + x) * 4
      sum += luminance(data[i], data[i + 1], data[i + 2])
      count++
    }
  }
  return count > 0 ? sum / count : 0
}

export function measureRatio(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  cw: number,
  ch: number
): RatioResult {
  // 가이드 박스: 화면 중앙 60%×60%
  const bx = Math.floor(cw * 0.2)
  const by = Math.floor(ch * 0.2)
  const bw = Math.floor(cw * 0.6)
  const bh = Math.floor(ch * 0.6)


  let data: Uint8ClampedArray
  try {
    data = ctx.getImageData(bx, by, bw, bh).data
  } catch {
    return { leftLum: 0, rightLum: 0, ratio: 1, label: 'flat', hint: '캔버스 접근 오류', color: '#888' }
  }

  const halfW = Math.floor(bw / 2)
  const leftLum  = avgLuminance(data, 0,     halfW, 0, bh, bw)
  const rightLum = avgLuminance(data, halfW, bw,    0, bh, bw)

  const hi = Math.max(leftLum, rightLum)
  const lo = Math.min(leftLum, rightLum) || 0.001
  const ratio = hi / lo

  let label: RatioLabel, hint: string, color: string
  if (ratio < 2)         { label='flat';      hint='균일한 조명';                  color='#64b5f6' }
  else if (ratio < 4)    { label='soft';      hint='소프트 사이드 (2:1~4:1)';      color='#81c784' }
  else if (ratio < 6)    { label='rembrandt'; hint='렘브란트 (4:1~6:1)';           color='#ffd54f' }
  else if (ratio < 8)    { label='hard';      hint='렘브란트↔스플릿 사이';         color='#ff8a65' }
  else                   { label='split';     hint='스플릿 하드 (8:1+)';           color='#e57373' }

  // 방향 힌트
  const dir = leftLum > rightLum ? '왼쪽' : '오른쪽'
  hint = `${hint} (주광: ${dir})`

  return { leftLum, rightLum, ratio, label, hint, color }
}
