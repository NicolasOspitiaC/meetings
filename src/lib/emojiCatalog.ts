/** Skin tone applied to emojis that support it: 0 is the default yellow, 1–5 light to dark. */
export type SkinTone = 0 | 1 | 2 | 3 | 4 | 5

/** Shape of an entry in emojibase-data's full dataset (only the fields used here). */
export interface RawEmoji {
  emoji: string
  label: string
  group?: number
  order?: number
  version: number
  tags?: string[]
  skins?: { emoji: string; tone?: number | number[]; version?: number }[]
}

export interface Emoji {
  emoji: string
  label: string
  /** Lowercase, accent-free label and tags, for search. */
  keywords: string
  /** Variants for skin tones 1–5, when the emoji has them. */
  tones?: string[]
}

export interface EmojiCategory {
  id: string
  name: string
  icon: string
  emojis: Emoji[]
}

// Same sections as WhatsApp: smileys and people share one; emojibase's "component" group stays out.
const CATEGORIES = [
  { id: 'people', name: 'Emoticonos y personas', icon: '😀', groups: [0, 1] },
  { id: 'nature', name: 'Animales y naturaleza', icon: '🐻', groups: [3] },
  { id: 'food', name: 'Comida y bebida', icon: '🍔', groups: [4] },
  { id: 'activities', name: 'Actividades', icon: '⚽', groups: [6] },
  { id: 'travel', name: 'Viajes y lugares', icon: '🚗', groups: [5] },
  { id: 'objects', name: 'Objetos', icon: '💡', groups: [7] },
  { id: 'symbols', name: 'Símbolos', icon: '🔣', groups: [8] },
  { id: 'flags', name: 'Banderas', icon: '🏳️', groups: [9] },
]

/** Newer emojis still show up as empty boxes on many systems, so they stay out until fonts catch up. */
export const MAX_EMOJI_VERSION = 15.1

export const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()

const supported = (version = 0) => version <= MAX_EMOJI_VERSION

function toEmoji(raw: RawEmoji): Emoji {
  // Only the single-tone variants; multi-person emojis also list every mixed combination.
  const tones = (raw.skins ?? [])
    .filter((skin) => typeof skin.tone === 'number' && supported(skin.version))
    .sort((a, b) => (a.tone as number) - (b.tone as number))
    .map((skin) => skin.emoji)
  return {
    emoji: raw.emoji,
    label: raw.label,
    keywords: normalize([raw.label, ...(raw.tags ?? [])].join(' ')),
    tones: tones.length === 5 ? tones : undefined,
  }
}

export function buildCatalog(data: RawEmoji[]): EmojiCategory[] {
  const usable = data
    .filter((raw) => raw.group !== undefined && supported(raw.version))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  return CATEGORIES.map(({ groups, ...category }) => ({
    ...category,
    emojis: usable.filter((raw) => groups.includes(raw.group as number)).map(toEmoji),
  }))
}

let catalogPromise: Promise<EmojiCategory[]> | null = null

/** Loads the full catalog on first use (a separate chunk), then reuses it. */
export function loadEmojiCatalog(): Promise<EmojiCategory[]> {
  catalogPromise ??= import('emojibase-data/es/data.json')
    .then((module) => buildCatalog(module.default as unknown as RawEmoji[]))
    .catch((error: unknown) => {
      catalogPromise = null
      throw error
    })
  return catalogPromise
}

/**
 * Every word of the query must appear. Exact names come first, then names that start with the
 * query (shortest first, so "corazón rojo" beats "corazón con flecha"), then the rest.
 */
export function searchEmojis(catalog: EmojiCategory[], query: string): Emoji[] {
  const needle = normalize(query.trim())
  const words = needle.split(/\s+/).filter(Boolean)
  if (words.length === 0) return []
  const matches = catalog.flatMap((category) => category.emojis).filter((emoji) => words.every((word) => emoji.keywords.includes(word)))
  const rank = (emoji: Emoji) => {
    const label = normalize(emoji.label)
    if (label === needle) return 0
    return label.startsWith(needle) ? 1 + label.length / 1000 : 2
  }
  return matches.sort((a, b) => rank(a) - rank(b))
}

export const withTone = (emoji: Emoji, tone: SkinTone) => (tone > 0 && emoji.tones?.[tone - 1]) || emoji.emoji

/** Most recent first, without duplicates. */
export function pushRecent(recent: string[], emoji: string, max = 32): string[] {
  return [emoji, ...recent.filter((item) => item !== emoji)].slice(0, max)
}
