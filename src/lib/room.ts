import { MAX_PARTICIPANTS, type ChatMessage, type Participant } from './protocol'

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 6
const MAX_NAME_LENGTH = 30
const MAX_TEXT_LENGTH = 2000
export const MAX_MESSAGES = 200

/** Source of truth kept by the host: who is in the room and the chat history. */
export interface HostState {
  participants: Participant[]
  messages: ChatMessage[]
}

export type JoinResult = { ok: true; state: HostState } | { ok: false; reason: string }

export function createHostState(host: Participant): HostState {
  return {
    participants: [host],
    messages: [systemMessage('Sala abierta. Comparte tu código para que otros se unan.')],
  }
}

export function addParticipant(state: HostState, participant: Participant): JoinResult {
  const exists = state.participants.some((p) => p.id === participant.id)
  if (exists) {
    return {
      ok: true,
      state: { ...state, participants: state.participants.map((p) => (p.id === participant.id ? participant : p)) },
    }
  }
  if (state.participants.length >= MAX_PARTICIPANTS) {
    return { ok: false, reason: `La sala está llena (máximo ${MAX_PARTICIPANTS} personas).` }
  }
  return { ok: true, state: { ...state, participants: [...state.participants, participant] } }
}

export function removeParticipant(state: HostState, id: string): HostState {
  return { ...state, participants: state.participants.filter((p) => p.id !== id) }
}

export function updateMedia(state: HostState, id: string, audio: boolean, video: boolean): HostState {
  return {
    ...state,
    participants: state.participants.map((p) => (p.id === id ? { ...p, audio, video } : p)),
  }
}

export function appendMessage(state: HostState, message: ChatMessage, limit = MAX_MESSAGES): HostState {
  return { ...state, messages: [...state.messages, message].slice(-limit) }
}

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`

export function chatMessage(from: Participant, text: string): ChatMessage {
  return { id: newId(), fromId: from.id, fromName: from.name, text, ts: Date.now() }
}

export function systemMessage(text: string): ChatMessage {
  return { id: newId(), fromId: '', fromName: '', text, ts: Date.now(), system: true }
}

export function generateRoomCode(): string {
  const bytes = new Uint32Array(CODE_LENGTH)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('')
}

export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function isValidCode(code: string): boolean {
  return code.length === CODE_LENGTH && [...code].every((c) => CODE_ALPHABET.includes(c))
}

export function sanitizeName(name: string): string {
  return name.trim().slice(0, MAX_NAME_LENGTH) || 'Invitado'
}

export function sanitizeText(text: string): string {
  return text.trim().slice(0, MAX_TEXT_LENGTH)
}
