export async function startCamera(videoEl: HTMLVideoElement): Promise<void> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
    audio: false,
  })
  videoEl.srcObject = stream
  await videoEl.play()
}

export function stopCamera(videoEl: HTMLVideoElement): void {
  const stream = videoEl.srcObject as MediaStream | null
  stream?.getTracks().forEach(t => t.stop())
  videoEl.srcObject = null
}

export function getVideoAspect(videoEl: HTMLVideoElement): number {
  return videoEl.videoWidth / (videoEl.videoHeight || 1)
}
