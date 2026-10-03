/**
 * Returns a stream with exactly the requested kinds of tracks, reusing tracks from `prev`
 * when possible so the browser only asks for the devices that are newly needed.
 * Tracks that are no longer wanted are stopped only after the new ones were acquired,
 * so a denied permission leaves the previous stream intact.
 */
export async function buildStream(
  prev: MediaStream | null,
  audio: boolean,
  video: boolean,
): Promise<MediaStream | null> {
  const prevAudio = prev?.getAudioTracks()[0]
  const prevVideo = prev?.getVideoTracks()[0]
  const needAudio = audio && !prevAudio
  const needVideo = video && !prevVideo

  let acquired: MediaStreamTrack[] = []
  if (needAudio || needVideo) {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('insecure-context')
    }
    const fresh = await navigator.mediaDevices.getUserMedia({
      audio: needAudio ? { echoCancellation: true, noiseSuppression: true } : false,
      video: needVideo ? { width: { ideal: 640 }, height: { ideal: 360 }, aspectRatio: { ideal: 16 / 9 } } : false,
    })
    acquired = fresh.getTracks()
  }

  const kept: MediaStreamTrack[] = []
  if (prevAudio) {
    if (audio) kept.push(prevAudio)
    else prevAudio.stop()
  }
  if (prevVideo) {
    if (video) kept.push(prevVideo)
    else prevVideo.stop()
  }

  const tracks = [...kept, ...acquired]
  return tracks.length > 0 ? new MediaStream(tracks) : null
}

export function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop())
}

export function mediaErrorMessage(error: unknown): string {
  const name = error instanceof Error ? error.name : ''
  const message = error instanceof Error ? error.message : ''
  if (message === 'insecure-context') {
    return 'La cámara y el micrófono solo funcionan en https o en localhost.'
  }
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Permiso denegado. Habilita la cámara/micrófono en la configuración del navegador.'
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return 'No se encontró el dispositivo solicitado (cámara o micrófono).'
  }
  if (name === 'NotReadableError') {
    return 'El dispositivo está siendo usado por otra aplicación.'
  }
  return 'No se pudo acceder a la cámara o al micrófono.'
}
