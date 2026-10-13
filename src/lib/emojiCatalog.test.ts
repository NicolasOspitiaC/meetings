import { describe, expect, it } from 'vitest'
import data from 'emojibase-data/es/data.json'
import { buildCatalog, MAX_EMOJI_VERSION, normalize, pushRecent, searchEmojis, withTone, type RawEmoji } from './emojiCatalog'

const catalog = buildCatalog(data as unknown as RawEmoji[])
const all = catalog.flatMap((category) => category.emojis)
// The data spells some emojis with the emoji-presentation selector (U+FE0F), e.g. 👍️.
const bare = (emoji: string) => emoji.replace(/\uFE0F/g, '')
const find = (emoji: string) => all.find((item) => bare(item.emoji) === bare(emoji))

describe('buildCatalog', () => {
  it('groups the whole catalog into the WhatsApp sections', () => {
    expect(catalog.map((category) => category.name)).toEqual([
      'Emoticonos y personas',
      'Animales y naturaleza',
      'Comida y bebida',
      'Actividades',
      'Viajes y lugares',
      'Objetos',
      'Símbolos',
      'Banderas',
    ])
    expect(all.length).toBeGreaterThan(1800)
    expect(catalog.every((category) => category.emojis.length > 0)).toBe(true)
  })

  it('starts with the classic smileys and includes country flags', () => {
    expect(catalog[0].emojis[0].emoji).toBe('😀')
    expect(find('🇨🇴')).toBeDefined()
  })

  it('leaves out emojis newer than the supported version', () => {
    const newest = (data as unknown as RawEmoji[]).find((raw) => raw.version > MAX_EMOJI_VERSION)
    expect(newest).toBeDefined()
    expect(find(newest!.emoji)).toBeUndefined()
  })

  it('keeps the five single skin tones, in order', () => {
    expect(find('👋')?.tones).toEqual(['👋🏻', '👋🏼', '👋🏽', '👋🏾', '👋🏿'])
    expect(find('🤝')?.tones).toEqual(['🤝🏻', '🤝🏼', '🤝🏽', '🤝🏾', '🤝🏿'])
    expect(find('😀')?.tones).toBeUndefined()
  })
})

describe('withTone', () => {
  it('applies the tone only where the emoji has variants', () => {
    expect(withTone(find('👍')!, 3)).toBe('👍🏽')
    expect(withTone(find('👍')!, 0)).toBe(find('👍')!.emoji)
    expect(withTone(find('🔥')!, 3)).toBe(find('🔥')!.emoji)
  })
})

describe('searchEmojis', () => {
  it('finds by Spanish name or tag, ignoring accents and case', () => {
    expect(searchEmojis(catalog, 'CORAZON').map((emoji) => bare(emoji.emoji))).toContain(bare('❤️'))
    expect(searchEmojis(catalog, 'colombia').map((emoji) => emoji.emoji)).toContain('🇨🇴')
  })

  it('requires every word and puts names starting with the query first', () => {
    const results = searchEmojis(catalog, 'cara llorando')
    expect(results.length).toBeGreaterThan(0)
    expect(results.every((emoji) => emoji.keywords.includes('cara') && emoji.keywords.includes('llorando'))).toBe(true)
    expect(normalize(results[0].label).startsWith('cara llorando')).toBe(true)
  })

  it('ranks exact and shorter names first', () => {
    expect(bare(searchEmojis(catalog, 'corazón rojo')[0].emoji)).toBe(bare('❤️'))
    expect(searchEmojis(catalog, 'fuego')[0].emoji).toBe('🔥')
  })

  it('returns nothing for a blank query', () => {
    expect(searchEmojis(catalog, '   ')).toEqual([])
  })
})

describe('pushRecent', () => {
  it('moves the emoji to the front without duplicates and caps the list', () => {
    expect(pushRecent(['😀', '🔥', '👍'], '🔥')).toEqual(['🔥', '😀', '👍'])
    expect(pushRecent(['a', 'b', 'c'], 'd', 3)).toEqual(['d', 'a', 'b'])
  })
})
