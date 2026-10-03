import Peer, { type DataConnection, type MediaConnection } from 'peerjs'
import { buildStream, mediaErrorMessage, setNoiseSuppression, stopStream } from './media'
import { createNoiseFilter, noiseFilterAvailable, preloadNoiseFilter, type NoiseFilter } from './noiseFilter'
import {
  parseGuestMessage,
  parseHostMessage,
  type ChatMessage,
  type GuestToHost,
  type HostToGuest,
  type Participant,
} from './protocol'
import {
  MAX_MESSAGES,
  addParticipant,
  appendMessage,
  chatMessage,
  createHostState,
  generateRoomCode,
  isValidCode,
  normalizeCode,
  removeParticipant,
  sanitizeName,
  sanitizeText,
  systemMessage,
  updateMedia,
  type HostState,
} from './room'

const PEER_PREFIX = 'meetings-lite-v1-'
const CODE_STORAGE_KEY = 'meetings.roomCode'
const JOIN_TIMEOUT_MS = 12_000
const PENDING_CALL_TIMEOUT_MS = 10_000
const CLOSE_DELAY_MS = 400

export type Status = 'idle' | 'connecting' | 'lobby' | 'joining' | 'in-room'
export type Role = 'host' | 'guest'

export interface RoomSnapshot {
  status: Status
  name: string
  myCode: string | null
  role: Role | null
  roomCode: string | null
  participants: Participant[]
  messages: ChatMessage[]
  localStream: MediaStream | null
  remoteStreams: Record<string, MediaStream>
  audio: boolean
  video: boolean
  noiseSuppression: boolean
  mediaBusy: boolean
  error: string | null
}

interface MediaPrefs {
  audio: boolean
  video: boolean
  noiseSuppression: boolean
}

const INITIAL: RoomSnapshot = {
  status: 'idle',
  name: '',
  myCode: null,
  role: null,
  roomCode: null,
  participants: [],
  messages: [],
  localStream: null,
  remoteStreams: {},
  audio: false,
  video: false,
  noiseSuppression: true,
  mediaBusy: false,
  error: null,
}

const toPeerId = (code: string) => PEER_PREFIX + code
const fromPeerId = (peerId: string) => (peerId.startsWith(PEER_PREFIX) ? peerId.slice(PEER_PREFIX.length) : peerId)

function loadStoredCode(): string | null {
  try {
    const code = localStorage.getItem(CODE_STORAGE_KEY)
    return code && isValidCode(code) ? code : null
  } catch {
    return null
  }
}

function storeCode(code: string) {
  try {
    localStorage.setItem(CODE_STORAGE_KEY, code)
  } catch {
    // Storage unavailable: the code simply won't survive a reload.
  }
}

/**
 * Orchestrates PeerJS: one data connection per guest to the host (star) for chat and room state,
 * plus one-way media calls between every pair of participants (mesh).
 * React reads it through subscribe/getSnapshot.
 */
export class RoomClient {
  private snapshot: RoomSnapshot = INITIAL
  private listeners = new Set<() => void>()
  private peer: Peer | null = null

  // Guest side
  private hostConn: DataConnection | null = null
  private joinTimer: ReturnType<typeof setTimeout> | null = null

  // Host side
  private guestConns = new Map<string, DataConnection>()
  private hostState: HostState | null = null

  // Media
  private outCalls = new Map<string, MediaConnection>()
  private inCalls = new Map<string, MediaConnection>()
  private pendingCalls = new Map<string, MediaConnection>()
  private desiredMedia: MediaPrefs = { audio: false, video: false, noiseSuppression: true }
  /** Tracks as getUserMedia returned them; `snapshot.localStream` has the filtered microphone instead. */
  private rawStream: MediaStream | null = null
  private noiseFilter: NoiseFilter | null = null
  private mediaQueue: Promise<void> = Promise.resolve()

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot = () => this.snapshot

  private update(patch: Partial<RoomSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch }
    this.listeners.forEach((listener) => listener())
  }

  private get me(): Participant {
    const { myCode, name, role, audio, video } = this.snapshot
    return { id: myCode ?? '', name, isHost: role === 'host', audio, video }
  }

  // ---------------------------------------------------------------- lifecycle

  start(name: string) {
    if (this.peer) return
    this.update({ name: sanitizeName(name), status: 'connecting', error: null })
    preloadNoiseFilter()
    this.createPeer(loadStoredCode() ?? generateRoomCode())
  }

  retry() {
    this.peer?.destroy()
    this.peer = null
    this.update({ status: 'connecting', error: null })
    this.createPeer(this.snapshot.myCode ?? loadStoredCode() ?? generateRoomCode())
  }

  dismissError() {
    this.update({ error: null })
  }

  destroy() {
    this.leave()
    this.peer?.destroy()
    this.peer = null
  }

  private createPeer(code: string) {
    const peer = new Peer(toPeerId(code))
    this.peer = peer

    peer.on('open', () => {
      if (this.peer !== peer) return
      storeCode(code)
      this.update({ myCode: code, status: this.snapshot.status === 'connecting' ? 'lobby' : this.snapshot.status })
    })
    peer.on('connection', (conn) => this.onIncomingConnection(conn))
    peer.on('call', (call) => this.onIncomingCall(call))
    peer.on('disconnected', () => {
      // Lost the signaling server; existing WebRTC connections keep working.
      if (this.peer === peer && !peer.destroyed) peer.reconnect()
    })
    peer.on('error', (err) => {
      if (this.peer !== peer) return
      this.onPeerError(peer, err.type)
    })
  }

  private onPeerError(peer: Peer, type: string) {
    switch (type) {
      case 'unavailable-id':
        // Code taken (e.g. same browser in another tab): pick a new one.
        peer.destroy()
        this.createPeer(generateRoomCode())
        return
      case 'peer-unavailable':
        if (this.snapshot.status === 'joining') {
          this.failJoin('No existe ninguna sala abierta con ese código.')
        }
        // During a call this only means someone left before our call reached them.
        return
      case 'browser-incompatible':
        this.update({ error: 'Tu navegador no soporta WebRTC. Prueba con Chrome, Firefox o Edge recientes.' })
        return
      case 'network':
      case 'server-error':
      case 'socket-error':
      case 'socket-closed':
        if (this.snapshot.status === 'connecting') {
          this.update({ error: 'No se pudo conectar al servidor de señalización. Revisa tu conexión e intenta de nuevo.' })
        }
        return
      default:
        this.update({ error: `Error de conexión (${type}).` })
    }
  }

  // ---------------------------------------------------------------- host

  openRoom() {
    const { status, myCode } = this.snapshot
    if (status !== 'lobby' || !myCode) return
    this.update({ status: 'in-room', role: 'host', roomCode: myCode, error: null })
    this.hostState = createHostState(this.me)
    this.publishHostState()
  }

  private onIncomingConnection(conn: DataConnection) {
    const guestId = fromPeerId(conn.peer)

    conn.on('data', (raw) => {
      const msg = parseGuestMessage(raw)
      if (!msg) return
      if (msg.type === 'hello') {
        this.onHello(conn, guestId, msg.name)
        return
      }
      if (this.guestConns.get(guestId) !== conn || !this.hostState) return
      if (msg.type === 'chat') {
        this.hostAddChat(guestId, msg.text)
      } else {
        this.hostState = updateMedia(this.hostState, guestId, msg.audio, msg.video)
        this.broadcast({ type: 'participants', participants: this.hostState.participants })
        this.publishHostState()
      }
    })

    conn.on('close', () => {
      if (this.guestConns.get(guestId) === conn) this.hostRemoveGuest(guestId)
    })
  }

  private onHello(conn: DataConnection, guestId: string, rawName: string) {
    const { status, role } = this.snapshot
    if (status !== 'in-room' || role !== 'host' || !this.hostState) {
      this.reject(
        conn,
        role === 'guest'
          ? 'Esta persona está conectada a otra sala. Usa el código de su anfitrión.'
          : 'Esa persona todavía no ha abierto su sala.',
      )
      return
    }

    const name = sanitizeName(rawName)
    const result = addParticipant(this.hostState, { id: guestId, name, isHost: false, audio: false, video: false })
    if (!result.ok) {
      this.reject(conn, result.reason)
      return
    }

    const previous = this.guestConns.get(guestId)
    this.guestConns.set(guestId, conn)
    previous?.close()

    const joined = systemMessage(`${name} se unió a la sala.`)
    this.hostState = appendMessage(result.state, joined)
    this.send(conn, { type: 'welcome', participants: this.hostState.participants, messages: this.hostState.messages })
    this.broadcast({ type: 'participants', participants: this.hostState.participants }, guestId)
    this.broadcast({ type: 'chat', message: joined }, guestId)
    this.publishHostState()
  }

  private reject(conn: DataConnection, reason: string) {
    this.send(conn, { type: 'rejected', reason })
    setTimeout(() => conn.close(), CLOSE_DELAY_MS)
  }

  private hostRemoveGuest(guestId: string) {
    this.guestConns.delete(guestId)
    if (!this.hostState) return
    const leaving = this.hostState.participants.find((p) => p.id === guestId)
    this.hostState = removeParticipant(this.hostState, guestId)
    if (leaving) {
      const left = systemMessage(`${leaving.name} salió de la sala.`)
      this.hostState = appendMessage(this.hostState, left)
      this.broadcast({ type: 'chat', message: left })
    }
    this.broadcast({ type: 'participants', participants: this.hostState.participants })
    this.publishHostState()
  }

  private hostAddChat(fromId: string, rawText: string) {
    if (!this.hostState) return
    const text = sanitizeText(rawText)
    const from = this.hostState.participants.find((p) => p.id === fromId)
    if (!text || !from) return
    const message = chatMessage(from, text)
    this.hostState = appendMessage(this.hostState, message)
    this.broadcast({ type: 'chat', message })
    this.publishHostState()
  }

  private publishHostState() {
    if (!this.hostState) return
    this.update({ participants: this.hostState.participants, messages: this.hostState.messages })
    this.syncCalls()
  }

  private send(conn: DataConnection, msg: HostToGuest | GuestToHost) {
    if (!conn.open) return
    try {
      conn.send(msg)
    } catch {
      // The connection is going away; its close handler cleans up.
    }
  }

  private broadcast(msg: HostToGuest, exceptId?: string) {
    this.guestConns.forEach((conn, id) => {
      if (id !== exceptId) this.send(conn, msg)
    })
  }

  // ---------------------------------------------------------------- guest

  joinRoom(rawCode: string) {
    const code = normalizeCode(rawCode)
    const { status, myCode } = this.snapshot
    if (status !== 'lobby' || !this.peer) return
    if (!isValidCode(code)) {
      this.update({ error: 'El código debe tener 6 caracteres (letras y números).' })
      return
    }
    if (code === myCode) {
      this.update({ error: 'Ese es tu propio código. Usa "Abrir mi sala" para ser el anfitrión.' })
      return
    }

    this.update({ status: 'joining', roomCode: code, error: null })
    const conn = this.peer.connect(toPeerId(code), { reliable: true })
    this.hostConn = conn

    conn.on('open', () => this.send(conn, { type: 'hello', name: this.snapshot.name }))
    conn.on('data', (raw) => {
      if (this.hostConn !== conn) return
      const msg = parseHostMessage(raw)
      if (msg) this.onHostMessage(msg)
    })
    conn.on('close', () => {
      if (this.hostConn !== conn) return
      this.hostConn = null
      this.resetToLobby(
        this.snapshot.status === 'in-room'
          ? 'Se cerró la sala o se perdió la conexión con el anfitrión.'
          : 'No se pudo conectar a la sala.',
      )
    })

    this.joinTimer = setTimeout(() => {
      if (this.hostConn === conn && this.snapshot.status === 'joining') {
        this.failJoin('La sala no respondió. Verifica el código e intenta de nuevo.')
      }
    }, JOIN_TIMEOUT_MS)
  }

  private failJoin(reason: string) {
    const conn = this.hostConn
    this.hostConn = null
    conn?.close()
    this.resetToLobby(reason)
  }

  private onHostMessage(msg: HostToGuest) {
    switch (msg.type) {
      case 'welcome':
        this.clearJoinTimer()
        this.update({
          status: 'in-room',
          role: 'guest',
          participants: msg.participants,
          messages: msg.messages.slice(-MAX_MESSAGES),
        })
        this.syncCalls()
        return
      case 'rejected':
        this.failJoin(msg.reason)
        return
      case 'participants':
        this.update({ participants: msg.participants })
        this.syncCalls()
        return
      case 'chat':
        this.update({ messages: [...this.snapshot.messages, msg.message].slice(-MAX_MESSAGES) })
        return
      case 'room-closed':
        this.failJoin('El anfitrión cerró la sala.')
        return
    }
  }

  private clearJoinTimer() {
    if (this.joinTimer) clearTimeout(this.joinTimer)
    this.joinTimer = null
  }

  // ---------------------------------------------------------------- shared actions

  sendChat(rawText: string) {
    const text = sanitizeText(rawText)
    if (!text || this.snapshot.status !== 'in-room') return
    if (this.snapshot.role === 'host') {
      this.hostAddChat(this.snapshot.myCode ?? '', text)
    } else if (this.hostConn) {
      this.send(this.hostConn, { type: 'chat', text })
    }
  }

  leave() {
    if (this.snapshot.role === 'host') {
      this.broadcast({ type: 'room-closed' })
      const conns = [...this.guestConns.values()]
      this.guestConns.clear()
      setTimeout(() => conns.forEach((conn) => conn.close()), CLOSE_DELAY_MS)
    } else if (this.hostConn) {
      const conn = this.hostConn
      this.hostConn = null
      conn.close()
    }
    if (this.snapshot.status === 'in-room' || this.snapshot.status === 'joining') this.resetToLobby(null)
  }

  private resetToLobby(error: string | null) {
    this.clearJoinTimer()
    this.closeAllCalls()
    this.noiseFilter?.stop()
    this.noiseFilter = null
    stopStream(this.rawStream)
    this.rawStream = null
    this.hostState = null
    // The noise suppression preference carries over to the next room.
    this.desiredMedia = { ...this.desiredMedia, audio: false, video: false }
    this.update({
      status: this.peer ? 'lobby' : 'idle',
      role: null,
      roomCode: null,
      participants: [],
      messages: [],
      localStream: null,
      remoteStreams: {},
      audio: false,
      video: false,
      mediaBusy: false,
      error,
    })
  }

  // ---------------------------------------------------------------- media

  toggleAudio() {
    this.setMedia({ audio: !this.desiredMedia.audio })
  }

  toggleVideo() {
    this.setMedia({ video: !this.desiredMedia.video })
  }

  toggleNoiseSuppression() {
    this.setMedia({ noiseSuppression: !this.desiredMedia.noiseSuppression })
  }

  private setMedia(patch: Partial<MediaPrefs>) {
    if (this.snapshot.status !== 'in-room') return
    this.desiredMedia = { ...this.desiredMedia, ...patch }
    this.mediaQueue = this.mediaQueue
      .then(() => this.applyMedia())
      .catch(() => this.update({ mediaBusy: false, error: 'No se pudo actualizar la cámara o el micrófono.' }))
  }

  private async applyMedia() {
    if (this.snapshot.status !== 'in-room') return
    if (this.desiredMedia.noiseSuppression !== this.snapshot.noiseSuppression) await this.applyNoiseSuppression()

    const { audio, video, noiseSuppression } = this.desiredMedia
    if (this.snapshot.status !== 'in-room') return
    if (audio === this.snapshot.audio && video === this.snapshot.video) return

    this.update({ mediaBusy: true })
    // With the AI filter the browser's own suppression stays off: stacking both muffles the voice.
    const browserSuppression = audio && noiseSuppression && !(await noiseFilterAvailable())
    let raw: MediaStream | null
    try {
      raw = await buildStream(this.rawStream, audio, video, browserSuppression)
    } catch (error) {
      this.desiredMedia = { ...this.desiredMedia, audio: this.snapshot.audio, video: this.snapshot.video }
      this.update({ mediaBusy: false, error: mediaErrorMessage(error) })
      return
    }

    if (this.snapshot.status !== 'in-room') {
      // Left the room while the browser was asking for permission.
      stopStream(raw)
      return
    }

    await this.publishLocalStream(raw, audio, video)
  }

  private async applyNoiseSuppression() {
    const { audio, noiseSuppression } = this.desiredMedia
    const raw = this.rawStream
    const track = raw?.getAudioTracks()[0]
    if (this.noiseFilter || !raw || !track || !audio) {
      // The AI filter just reroutes the audio; with the microphone off the setting is used the next time it opens.
      this.noiseFilter?.setEnabled(noiseSuppression)
      this.update({ noiseSuppression })
      return
    }

    // No AI filter in this browser: fall back to its own noise suppression.
    this.update({ mediaBusy: true })
    if (await setNoiseSuppression(track, noiseSuppression)) {
      // Same track, so the open calls pick up the change without being restarted.
      this.update({ noiseSuppression, mediaBusy: false })
      return
    }

    // The browser can't change it on a live track: reopen the microphone with the new setting.
    // The old track goes first because some browsers share one audio pipeline per device.
    track.stop()
    const { video } = this.snapshot
    const videoTracks = raw.getVideoTracks()
    const withoutAudio = videoTracks.length > 0 ? new MediaStream(videoTracks) : null
    let stream: MediaStream | null
    try {
      stream = await buildStream(withoutAudio, true, video, noiseSuppression)
    } catch (error) {
      if (this.snapshot.status !== 'in-room') return
      this.desiredMedia = { ...this.desiredMedia, audio: false }
      this.update({ noiseSuppression, error: mediaErrorMessage(error) })
      await this.publishLocalStream(withoutAudio, false, video)
      return
    }

    if (this.snapshot.status !== 'in-room') {
      stopStream(stream)
      return
    }
    this.update({ noiseSuppression })
    await this.publishLocalStream(stream, true, video)
  }

  /**
   * Makes `raw` the local media, with the microphone going through the noise filter,
   * re-sends it to everyone and tells the room about the media state.
   */
  private async publishLocalStream(raw: MediaStream | null, audio: boolean, video: boolean) {
    this.rawStream = raw
    const mic = raw?.getAudioTracks()[0] ?? null
    if (this.noiseFilter && this.noiseFilter.input !== mic) {
      this.noiseFilter.stop()
      this.noiseFilter = null
    }
    if (mic && !this.noiseFilter) {
      const filter = await createNoiseFilter(mic, this.snapshot.noiseSuppression)
      if (this.snapshot.status !== 'in-room') {
        filter?.stop()
        return
      }
      this.noiseFilter = filter
      // The microphone was opened expecting the filter; without it, use the browser's suppression.
      if (!filter && this.snapshot.noiseSuppression) void setNoiseSuppression(mic, true)
    }

    const tracks = [this.noiseFilter?.output ?? mic, ...(raw?.getVideoTracks() ?? [])].filter(
      (track): track is MediaStreamTrack => track !== null,
    )
    const stream = tracks.length > 0 ? new MediaStream(tracks) : null
    this.update({ localStream: stream, audio, video, mediaBusy: false })
    this.outCalls.forEach((call) => call.close())
    this.outCalls.clear()

    if (this.snapshot.role === 'host' && this.hostState) {
      this.hostState = updateMedia(this.hostState, this.snapshot.myCode ?? '', audio, video)
      this.broadcast({ type: 'participants', participants: this.hostState.participants })
      this.publishHostState()
    } else {
      if (this.hostConn) this.send(this.hostConn, { type: 'media', audio, video })
      this.syncCalls()
    }
  }

  /** Makes the open media calls match the current participants and local stream. */
  private syncCalls() {
    const { status, localStream, participants, myCode } = this.snapshot
    if (status !== 'in-room' || !this.peer) return
    const others = new Set(participants.map((p) => p.id).filter((id) => id !== myCode))

    this.outCalls.forEach((call, id) => {
      if (!localStream || !others.has(id)) {
        this.outCalls.delete(id)
        call.close()
      }
    })
    if (localStream) {
      others.forEach((id) => {
        if (!this.outCalls.has(id)) this.callPeer(id, localStream)
      })
    }

    this.inCalls.forEach((call, id) => {
      if (!others.has(id)) {
        this.inCalls.delete(id)
        call.close()
        this.setRemoteStream(id, null)
      }
    })
    this.pendingCalls.forEach((call, id) => {
      if (others.has(id)) {
        this.pendingCalls.delete(id)
        this.acceptCall(id, call)
      }
    })
  }

  private callPeer(id: string, stream: MediaStream) {
    const call = this.peer?.call(toPeerId(id), stream)
    if (!call) return
    this.outCalls.set(id, call)
    call.on('close', () => {
      if (this.outCalls.get(id) === call) this.outCalls.delete(id)
    })
    call.on('error', () => {
      if (this.outCalls.get(id) === call) this.outCalls.delete(id)
    })
  }

  private onIncomingCall(call: MediaConnection) {
    const id = fromPeerId(call.peer)
    const { status, participants, myCode } = this.snapshot
    if (status !== 'in-room' || id === myCode) {
      call.close()
      return
    }
    if (participants.some((p) => p.id === id)) {
      this.acceptCall(id, call)
      return
    }
    // The call may arrive just before the participant list that includes the caller.
    this.pendingCalls.get(id)?.close()
    this.pendingCalls.set(id, call)
    setTimeout(() => {
      if (this.pendingCalls.get(id) === call) {
        this.pendingCalls.delete(id)
        call.close()
      }
    }, PENDING_CALL_TIMEOUT_MS)
  }

  private acceptCall(id: string, call: MediaConnection) {
    const previous = this.inCalls.get(id)
    this.inCalls.set(id, call)
    previous?.close()

    call.on('stream', (stream) => {
      if (this.inCalls.get(id) === call) this.setRemoteStream(id, stream)
    })
    call.on('close', () => {
      if (this.inCalls.get(id) !== call) return
      this.inCalls.delete(id)
      this.setRemoteStream(id, null)
    })
    call.answer()
  }

  private setRemoteStream(id: string, stream: MediaStream | null) {
    const remoteStreams = { ...this.snapshot.remoteStreams }
    if (stream) remoteStreams[id] = stream
    else delete remoteStreams[id]
    this.update({ remoteStreams })
  }

  private closeAllCalls() {
    for (const calls of [this.outCalls, this.inCalls, this.pendingCalls]) {
      const open = [...calls.values()]
      calls.clear()
      open.forEach((call) => call.close())
    }
  }
}

export const roomClient = new RoomClient()

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => roomClient.destroy())
}
