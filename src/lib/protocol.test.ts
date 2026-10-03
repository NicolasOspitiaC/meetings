import { describe, expect, it } from 'vitest'
import { parseGuestMessage, parseHostMessage } from './protocol'

const participant = { id: 'ABC234', name: 'Ana', isHost: true, audio: false, video: true }
const message = { id: 'm1', fromId: 'ABC234', fromName: 'Ana', text: 'hola', ts: 1 }

describe('parseGuestMessage', () => {
  it('accepts valid messages', () => {
    expect(parseGuestMessage({ type: 'hello', name: 'Ana' })).toEqual({ type: 'hello', name: 'Ana' })
    expect(parseGuestMessage({ type: 'chat', text: 'hola' })).toEqual({ type: 'chat', text: 'hola' })
    expect(parseGuestMessage({ type: 'media', audio: true, video: false })).toEqual({
      type: 'media',
      audio: true,
      video: false,
    })
  })

  it('rejects malformed or unknown messages', () => {
    expect(parseGuestMessage(null)).toBeNull()
    expect(parseGuestMessage('hola')).toBeNull()
    expect(parseGuestMessage({ type: 'hello', name: 3 })).toBeNull()
    expect(parseGuestMessage({ type: 'media', audio: 'yes', video: false })).toBeNull()
    expect(parseGuestMessage({ type: 'room-closed' })).toBeNull()
  })
})

describe('parseHostMessage', () => {
  it('accepts valid messages', () => {
    expect(parseHostMessage({ type: 'welcome', participants: [participant], messages: [message] })).toEqual({
      type: 'welcome',
      participants: [participant],
      messages: [message],
    })
    expect(parseHostMessage({ type: 'chat', message })).toEqual({ type: 'chat', message })
    expect(parseHostMessage({ type: 'rejected', reason: 'llena' })).toEqual({ type: 'rejected', reason: 'llena' })
    expect(parseHostMessage({ type: 'room-closed' })).toEqual({ type: 'room-closed' })
  })

  it('rejects messages with invalid participants or chat messages', () => {
    expect(parseHostMessage({ type: 'participants', participants: [{ id: 1 }] })).toBeNull()
    expect(parseHostMessage({ type: 'chat', message: { text: 'sin id' } })).toBeNull()
    expect(parseHostMessage({ type: 'participants', participants: Array(6).fill(participant) })).toBeNull()
  })
})
