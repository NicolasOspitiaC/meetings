export const MAX_PARTICIPANTS = 5

export interface Participant {
  id: string
  name: string
  isHost: boolean
  audio: boolean
  video: boolean
}

export interface ChatMessage {
  id: string
  fromId: string
  fromName: string
  text: string
  ts: number
  system?: boolean
}

export type GuestToHost =
  | { type: 'hello'; name: string }
  | { type: 'chat'; text: string }
  | { type: 'media'; audio: boolean; video: boolean }

export type HostToGuest =
  | { type: 'welcome'; participants: Participant[]; messages: ChatMessage[] }
  | { type: 'rejected'; reason: string }
  | { type: 'participants'; participants: Participant[] }
  | { type: 'chat'; message: ChatMessage }
  | { type: 'room-closed' }

type Obj = Record<string, unknown>

const isObj = (value: unknown): value is Obj => typeof value === 'object' && value !== null

const isParticipant = (value: unknown): value is Participant =>
  isObj(value) &&
  typeof value.id === 'string' &&
  typeof value.name === 'string' &&
  typeof value.isHost === 'boolean' &&
  typeof value.audio === 'boolean' &&
  typeof value.video === 'boolean'

const isChatMessage = (value: unknown): value is ChatMessage =>
  isObj(value) &&
  typeof value.id === 'string' &&
  typeof value.fromId === 'string' &&
  typeof value.fromName === 'string' &&
  typeof value.text === 'string' &&
  typeof value.ts === 'number' &&
  (value.system === undefined || typeof value.system === 'boolean')

const isParticipantList = (value: unknown): value is Participant[] =>
  Array.isArray(value) && value.length <= MAX_PARTICIPANTS && value.every(isParticipant)

/** Validates data received by the host from a guest. Returns null for anything unexpected. */
export function parseGuestMessage(raw: unknown): GuestToHost | null {
  if (!isObj(raw)) return null
  switch (raw.type) {
    case 'hello':
      return typeof raw.name === 'string' ? { type: 'hello', name: raw.name } : null
    case 'chat':
      return typeof raw.text === 'string' ? { type: 'chat', text: raw.text } : null
    case 'media':
      return typeof raw.audio === 'boolean' && typeof raw.video === 'boolean'
        ? { type: 'media', audio: raw.audio, video: raw.video }
        : null
    default:
      return null
  }
}

/** Validates data received by a guest from the host. Returns null for anything unexpected. */
export function parseHostMessage(raw: unknown): HostToGuest | null {
  if (!isObj(raw)) return null
  switch (raw.type) {
    case 'welcome':
      return isParticipantList(raw.participants) && Array.isArray(raw.messages) && raw.messages.every(isChatMessage)
        ? { type: 'welcome', participants: raw.participants, messages: raw.messages }
        : null
    case 'rejected':
      return typeof raw.reason === 'string' ? { type: 'rejected', reason: raw.reason } : null
    case 'participants':
      return isParticipantList(raw.participants) ? { type: 'participants', participants: raw.participants } : null
    case 'chat':
      return isChatMessage(raw.message) ? { type: 'chat', message: raw.message } : null
    case 'room-closed':
      return { type: 'room-closed' }
    default:
      return null
  }
}
