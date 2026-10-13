let ctx: AudioContext | null = null

/** Short two-note chime synthesized on the fly, so there is no audio file to load. */
export function playMessageSound() {
  try {
    const audio = (ctx ??= new AudioContext())
    if (audio.state === 'suspended') void audio.resume()
    const now = audio.currentTime
    ;[880, 1320].forEach((frequency, i) => {
      const start = now + i * 0.12
      const osc = audio.createOscillator()
      const gain = audio.createGain()
      osc.type = 'sine'
      osc.frequency.value = frequency
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.15, start + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.3)
      osc.connect(gain).connect(audio.destination)
      osc.start(start)
      osc.stop(start + 0.32)
    })
  } catch {
    // No Web Audio (or blocked by the browser): messages simply arrive silently.
  }
}
