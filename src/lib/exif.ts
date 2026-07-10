/**
 * 미니 EXIF 파서 — 외부 의존성 없음, 로컬 파싱 전용
 * JPEG APP1(Exif) 세그먼트에서 TIFF IFD 직접 파싱
 * 추출 태그: FocalLength(0x920A) FNumber(0x829D) FocalLengthIn35mm(0xA405) Model(0x0110)
 */

export interface ExifData {
  focalLengthMm: number | null       // 실제 초점거리 mm
  fNumber: number | null             // 조리개
  focalLength35mm: number | null     // 35mm 환산 초점거리
  model: string | null               // 카메라 모델명
}

const TAG_MODEL         = 0x0110
const TAG_FNUMBER       = 0x829D
const TAG_FOCAL_LENGTH  = 0x920A
const TAG_FOCAL_35MM    = 0xA405

// TIFF 타입 → 바이트 크기
const TYPE_BYTE   = 1
const TYPE_ASCII  = 2
const TYPE_SHORT  = 3
const TYPE_LONG   = 4
const TYPE_RATIONAL = 5

function typeSize(t: number): number {
  switch (t) {
    case TYPE_BYTE:     return 1
    case TYPE_ASCII:    return 1
    case TYPE_SHORT:    return 2
    case TYPE_LONG:     return 4
    case TYPE_RATIONAL: return 8
    default:            return 1
  }
}

function readUint16(view: DataView, offset: number, le: boolean): number {
  return view.getUint16(offset, le)
}

function readUint32(view: DataView, offset: number, le: boolean): number {
  return view.getUint32(offset, le)
}

function readRational(view: DataView, offset: number, le: boolean): number {
  const num = readUint32(view, offset, le)
  const den = readUint32(view, offset + 4, le)
  return den === 0 ? 0 : num / den
}

function parseIFD(
  view: DataView,
  ifdOffset: number,
  tiffBase: number,
  le: boolean,
  out: Partial<ExifData>
): void {
  try {
    const count = readUint16(view, tiffBase + ifdOffset, le)
    for (let i = 0; i < count; i++) {
      const entryOffset = tiffBase + ifdOffset + 2 + i * 12
      if (entryOffset + 12 > view.byteLength) break
      const tag     = readUint16(view, entryOffset,     le)
      const type    = readUint16(view, entryOffset + 2, le)
      const numComp = readUint32(view, entryOffset + 4, le)
      const valOrOff = entryOffset + 8

      const totalBytes = typeSize(type) * numComp
      const dataOffset = totalBytes > 4
        ? tiffBase + readUint32(view, valOrOff, le)
        : valOrOff

      if (dataOffset + totalBytes > view.byteLength) continue

      if (tag === TAG_MODEL && type === TYPE_ASCII) {
        let str = ''
        for (let c = 0; c < numComp; c++) {
          const ch = view.getUint8(dataOffset + c)
          if (ch === 0) break
          str += String.fromCharCode(ch)
        }
        out.model = str.trim() || null
      } else if (tag === TAG_FNUMBER && type === TYPE_RATIONAL) {
        out.fNumber = readRational(view, dataOffset, le)
      } else if (tag === TAG_FOCAL_LENGTH && type === TYPE_RATIONAL) {
        out.focalLengthMm = readRational(view, dataOffset, le)
      } else if (tag === TAG_FOCAL_35MM && type === TYPE_SHORT) {
        out.focalLength35mm = readUint16(view, dataOffset, le)
      }
    }
  } catch {
    // 파싱 오류는 조용히 무시
  }
}

/** ArrayBuffer → ExifData. JPEG가 아니거나 APP1이 없으면 모든 필드 null */
export function parseExif(buf: ArrayBuffer): ExifData {
  const out: Partial<ExifData> = {
    focalLengthMm: null, fNumber: null, focalLength35mm: null, model: null,
  }
  const view = new DataView(buf)

  // JPEG 매직 체크
  if (view.byteLength < 4) return out as ExifData
  if (view.getUint8(0) !== 0xFF || view.getUint8(1) !== 0xD8) return out as ExifData

  // APP1 세그먼트(0xFFE1) 검색 — XMP 등 다른 APP1이 Exif보다 앞설 수 있어 Exif를 찾을 때까지 계속 스캔
  let offset = 2
  while (offset + 4 < view.byteLength) {
    const marker = view.getUint16(offset)
    const segLen = view.getUint16(offset + 2)
    if (marker === 0xFFDA) break  // SOS 이후는 압축 데이터
    if (marker === 0xFFE1) {
      // "Exif\0\0" 헤더 확인
      if (offset + 10 < view.byteLength) {
        const exifHeader = String.fromCharCode(
          view.getUint8(offset + 4), view.getUint8(offset + 5),
          view.getUint8(offset + 6), view.getUint8(offset + 7),
        )
        if (exifHeader === 'Exif') {
          const tiffBase = offset + 10  // Exif\0\0 다음 = TIFF 헤더 시작
          // 바이트 오더 판별
          const bo = view.getUint16(tiffBase)
          const le = bo === 0x4949  // 'II' = Little Endian, 'MM' = Big Endian

          // IFD0 오프셋
          const ifd0Offset = readUint32(view, tiffBase + 4, le)
          parseIFD(view, ifd0Offset, tiffBase, le, out)

          // Exif SubIFD 링크 (태그 0x8769)
          try {
            const cnt = readUint16(view, tiffBase + ifd0Offset, le)
            for (let i = 0; i < cnt; i++) {
              const ep = tiffBase + ifd0Offset + 2 + i * 12
              if (readUint16(view, ep, le) === 0x8769) {
                const subOff = readUint32(view, ep + 8, le)
                parseIFD(view, subOff, tiffBase, le, out)
                break
              }
            }
          } catch { /* ok */ }
          break
        }
      }
    }
    if (segLen < 2) break
    offset += 2 + segLen
  }
  return out as ExifData
}

/** FocalLengthIn35mm → 수평 FOV (도). null이면 null */
export function fovFromF35(f35mm: number): number {
  // 35mm 풀프레임 가로 폭 = 36mm
  return 2 * Math.atan(36 / (2 * f35mm)) * (180 / Math.PI)
}
