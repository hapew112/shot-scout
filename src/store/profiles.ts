import { horizontalFov, defaultCoc } from '../lib/optics'

export interface LensProfile {
  id: string
  name: string
  focalMm: number
  sensorWidthMm: number
  aperture: number
  coc: number
}

export const SENSOR_PRESETS: Record<string, number> = {
  'Full Frame (36mm)': 36,
  'APS-C Sony (23.5mm)': 23.5,
  'APS-C Canon (22.3mm)': 22.3,
  'MFT (17.3mm)': 17.3,
  'APS-C Fuji (23.6mm)': 23.6,
}

const STORAGE_KEY = 'shot-scout:profiles'
const ACTIVE_KEY  = 'shot-scout:active-profile'

export function listProfiles(): LensProfile[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch { return [] }
}

export function saveProfile(p: LensProfile): void {
  const list = listProfiles().filter(x => x.id !== p.id)
  list.push(p)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}

export function deleteProfile(id: string): void {
  const list = listProfiles().filter(x => x.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  if (getActiveProfileId() === id) setActiveProfileId('')
}

export function getActiveProfileId(): string {
  return localStorage.getItem(ACTIVE_KEY) ?? ''
}

export function setActiveProfileId(id: string): void {
  localStorage.setItem(ACTIVE_KEY, id)
}

export function getActiveProfile(): LensProfile | null {
  const id = getActiveProfileId()
  return listProfiles().find(p => p.id === id) ?? listProfiles()[0] ?? null
}

export function createProfile(
  name: string,
  focalMm: number,
  sensorWidthMm: number,
  aperture: number
): LensProfile {
  return {
    id: crypto.randomUUID(),
    name,
    focalMm,
    sensorWidthMm,
    aperture,
    coc: defaultCoc(sensorWidthMm),
  }
}

export function profileHfov(p: LensProfile): number {
  return horizontalFov(p.focalMm, p.sensorWidthMm)
}

/** 기본 프리셋 (처음 실행 시 로드) */
export function ensureDefaults(): void {
  if (listProfiles().length > 0) return
  const defaults = [
    createProfile('Sony A7IV + 50mm f/1.8', 50, 36, 1.8),
    createProfile('Sony A7IV + 85mm f/1.4', 85, 36, 1.4),
    createProfile('Sony A6700 + 35mm f/1.8', 35, 23.5, 1.8),
  ]
  defaults.forEach(saveProfile)
  setActiveProfileId(defaults[0].id)
}
