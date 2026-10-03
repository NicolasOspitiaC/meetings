import { GtcrnWorkletNode, loadGtcrn } from '@sapphi-red/web-noise-suppressor'
import gtcrnWasmUrl from '@sapphi-red/web-noise-suppressor/gtcrn.wasm?url'
import gtcrnWorkletUrl from '@sapphi-red/web-noise-suppressor/gtcrnWorklet.js?url'

/** GTCRN only runs at 16 or 48 kHz; 48 kHz matches what microphones and WebRTC use. */
const SAMPLE_RATE = 48_000

interface Engine {
  ctx: AudioContext
  wasmBinary: ArrayBuffer
}

let engine: Promise<Engine | null> | null = null

/** Downloads the model and registers the worklet once. Resolves to null when the browser can't run it. */
function loadEngine(): Promise<Engine | null> {
  engine ??= (async () => {
    if (typeof AudioWorkletNode === 'undefined') return null
    const ctx = new AudioContext({ sampleRate: SAMPLE_RATE })
    try {
      const [wasmBinary] = await Promise.all([loadGtcrn({ url: gtcrnWasmUrl }), ctx.audioWorklet.addModule(gtcrnWorkletUrl)])
      return { ctx, wasmBinary }
    } catch {
      void ctx.close()
      return null
    }
  })()
  return engine
}

/** Starts loading the model ahead of time so turning the microphone on isn't delayed by the download. */
export function preloadNoiseFilter() {
  void loadEngine()
}

export async function noiseFilterAvailable(): Promise<boolean> {
  return (await loadEngine()) !== null
}

/**
 * Neural noise suppression (GTCRN): removes background noise and keeps the voice.
 * The microphone track goes in and `output` comes out. `output` never changes, so turning the filter
 * on or off doesn't touch the WebRTC calls. The input track is owned by the caller and isn't stopped here.
 */
export interface NoiseFilter {
  readonly input: MediaStreamTrack
  readonly output: MediaStreamTrack
  setEnabled(enabled: boolean): void
  stop(): void
}

/** Returns null when the filter can't run here (e.g. a microphone at a sample rate the browser won't convert). */
export async function createNoiseFilter(input: MediaStreamTrack, enabled: boolean): Promise<NoiseFilter | null> {
  const loaded = await loadEngine()
  if (!loaded) return null
  const { ctx, wasmBinary } = loaded

  let source: MediaStreamAudioSourceNode
  try {
    source = ctx.createMediaStreamSource(new MediaStream([input]))
  } catch {
    return null
  }
  const node = new GtcrnWorkletNode(ctx, { maxChannels: 1, wasmBinary })
  node.channelCount = 1
  node.channelCountMode = 'explicit'
  const destination = ctx.createMediaStreamDestination()
  destination.channelCount = 1
  // While bypassed the node gets no input and just adds silence.
  node.connect(destination)

  const route = (on: boolean) => {
    source.disconnect()
    source.connect(on ? node : destination)
  }
  route(enabled)
  void ctx.resume()

  const output = destination.stream.getAudioTracks()[0]
  return {
    input,
    output,
    setEnabled: route,
    stop() {
      output.stop()
      source.disconnect()
      node.disconnect()
      node.destroy()
      // Nothing else uses the context; suspending it releases the audio device until the next filter.
      void ctx.suspend()
    },
  }
}
