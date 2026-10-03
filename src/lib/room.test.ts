import { describe, expect, it } from 'vitest'
import type { Participant } from './protocol'
import {
  addParticipant,
  appendMessage,
  createHostState,
  generateRoomCode,
  isValidCode,
  normalizeCode,
  removeParticipant,
  sanitizeName,
  sanitizeText,
  systemMessage,
  updateMedia,
} from './room'

const person = (id: string, isHost = false): Participant => ({
  id,
  name: `Persona ${id}`,
  isHost,
  audio: false,
  video: false,
})

describe('createHostState', () => {
  it('starts with the host as the only participant and a welcome message', () => {
    const state = createHostState(person('HOST01', true))
    expect(state.participants).toEqual([person('HOST01', true)])
    expect(state.messages).toHaveLength(1)
    expect(state.messages[0].system).toBe(true)
  })
})

describe('addParticipant', () => {
  it('adds guests until the room has 5 people', () => {
    let state = createHostState(person('H', true))
    for (const id of ['A', 'B', 'C', 'D']) {
      const result = addParticipant(state, person(id))
      expect(result.ok).toBe(true)
      if (result.ok) state = result.state
    }
    expect(state.participants.map((p) => p.id)).toEqual(['H', 'A', 'B', 'C', 'D'])

    const sixth = addParticipant(state, person('E'))
    expect(sixth).toEqual({ ok: false, reason: 'La sala está llena (máximo 5 personas).' })
  })

  it('replaces a participant that reconnects with the same id instead of duplicating it', () => {
    const state = createHostState(person('H', true))
    const first = addParticipant(state, person('A'))
    if (!first.ok) throw new Error('expected ok')
    const again = addParticipant(first.state, { ...person('A'), name: 'Nuevo nombre' })
    expect(again.ok).toBe(true)
    if (again.ok) {
      expect(again.state.participants).toHaveLength(2)
      expect(again.state.participants[1].name).toBe('Nuevo nombre')
    }
  })

  it('does not mutate the previous state', () => {
    const state = createHostState(person('H', true))
    addParticipant(state, person('A'))
    expect(state.participants).toHaveLength(1)
  })
})

describe('removeParticipant', () => {
  it('removes the participant by id', () => {
    const added = addParticipant(createHostState(person('H', true)), person('A'))
    if (!added.ok) throw new Error('expected ok')
    expect(removeParticipant(added.state, 'A').participants.map((p) => p.id)).toEqual(['H'])
  })
})

describe('updateMedia', () => {
  it('updates audio and video flags of one participant only', () => {
    const added = addParticipant(createHostState(person('H', true)), person('A'))
    if (!added.ok) throw new Error('expected ok')
    const state = updateMedia(added.state, 'A', true, false)
    expect(state.participants.find((p) => p.id === 'A')).toMatchObject({ audio: true, video: false })
    expect(state.participants.find((p) => p.id === 'H')).toMatchObject({ audio: false, video: false })
  })
})

describe('appendMessage', () => {
  it('keeps only the most recent messages up to the limit', () => {
    let state = createHostState(person('H', true))
    for (let i = 0; i < 10; i++) state = appendMessage(state, systemMessage(`m${i}`), 5)
    expect(state.messages.map((m) => m.text)).toEqual(['m5', 'm6', 'm7', 'm8', 'm9'])
  })
})

describe('room codes', () => {
  it('generates 6-character codes without ambiguous characters', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateRoomCode()
      expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/)
      expect(isValidCode(code)).toBe(true)
    }
  })

  it('normalizes user input', () => {
    expect(normalizeCode('  ab c-d2k ')).toBe('ABCD2K')
  })

  it('rejects invalid codes', () => {
    expect(isValidCode('ABC')).toBe(false)
    expect(isValidCode('ABCDE0')).toBe(false)
  })
})

describe('sanitizers', () => {
  it('trims and limits names', () => {
    expect(sanitizeName('   Ana   ')).toBe('Ana')
    expect(sanitizeName('x'.repeat(100))).toHaveLength(30)
    expect(sanitizeName('   ')).toBe('Invitado')
  })

  it('trims and limits chat text', () => {
    expect(sanitizeText('  hola  ')).toBe('hola')
    expect(sanitizeText('y'.repeat(5000))).toHaveLength(2000)
  })
})
