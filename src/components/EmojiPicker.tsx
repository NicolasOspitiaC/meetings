import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import {
  loadEmojiCatalog,
  pushRecent,
  searchEmojis,
  withTone,
  type Emoji,
  type EmojiCategory,
  type SkinTone,
} from '../lib/emojiCatalog'
import { SmileIcon } from './icons'

const RECENT_STORAGE_KEY = 'meetings.recentEmojis'
const TONE_STORAGE_KEY = 'meetings.emojiTone'
const TONE_SAMPLE: Emoji = { emoji: '✋', label: 'Tono de piel', keywords: '', tones: ['✋🏻', '✋🏼', '✋🏽', '✋🏾', '✋🏿'] }
const TONE_NAMES = ['Predeterminado', 'Claro', 'Claro medio', 'Medio', 'Oscuro medio', 'Oscuro']

// Storage can be unavailable (private mode, blocked site data); the picker then just forgets.
function readRecent(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(RECENT_STORAGE_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : []
  } catch {
    return []
  }
}

function readTone(): SkinTone {
  try {
    const tone = Number(localStorage.getItem(TONE_STORAGE_KEY))
    return tone >= 1 && tone <= 5 ? (tone as SkinTone) : 0
  } catch {
    return 0
  }
}

function store(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Not persisted; fine for a convenience.
  }
}

interface Props {
  onPick: (emoji: string) => void
}

export function EmojiPicker({ onPick }: Props) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  // Closes on a click outside the picker or on Escape.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div className="emoji-picker" ref={rootRef}>
      <button
        type="button"
        className="icon-only ghost"
        aria-label="Emojis"
        title="Emojis"
        aria-expanded={open}
        aria-controls="emoji-panel"
        onClick={() => setOpen((value) => !value)}
      >
        <SmileIcon />
      </button>
      {open && <EmojiPanel onPick={onPick} />}
    </div>
  )
}

interface Section {
  id: string
  name: string
  icon: string
  emojis: Emoji[]
}

function EmojiPanel({ onPick }: Props) {
  const [catalog, setCatalog] = useState<EmojiCategory[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [query, setQuery] = useState('')
  const [tone, setTone] = useState(readTone)
  const [toneMenuOpen, setToneMenuOpen] = useState(false)
  // Recents shown are a snapshot from opening, so emojis don't jump around while picking several.
  const [shownRecent] = useState(readRecent)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [jump, setJump] = useState<{ id: string } | null>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    loadEmojiCatalog().then(
      (loaded) => !cancelled && setCatalog(loaded),
      () => !cancelled && setFailed(true),
    )
    return () => {
      cancelled = true
    }
  }, [attempt])

  // Desktop goes straight to search, like WhatsApp; on touch screens that would pop the keyboard.
  useEffect(() => {
    if (window.matchMedia('(pointer: fine)').matches) searchRef.current?.focus()
  }, [])

  const sections = useMemo<Section[]>(() => {
    if (!catalog) return []
    const byEmoji = new Map(catalog.flatMap((category) => category.emojis.map((emoji) => [emoji.emoji, emoji] as const)))
    const recent = shownRecent.flatMap((emoji) => byEmoji.get(emoji) ?? [])
    return recent.length > 0 ? [{ id: 'recent', name: 'Recientes', icon: '🕘', emojis: recent }, ...catalog] : catalog
  }, [catalog, shownRecent])

  const results = useMemo(() => (catalog && query.trim() ? searchEmojis(catalog, query) : null), [catalog, query])
  const currentId = activeId ?? sections[0]?.id

  // Scrolls once the sections are back on screen (a tab click also clears the search).
  useLayoutEffect(() => {
    const body = bodyRef.current
    const section = jump && body?.querySelector<HTMLElement>(`[data-section="${jump.id}"]`)
    if (body && section) body.scrollTop = section.offsetTop
  }, [jump])

  // Highlights the tab of the section at the top of the list.
  const onScroll = () => {
    const body = bodyRef.current
    if (!body || results) return
    let current: string | undefined = sections[0]?.id
    for (const section of body.querySelectorAll<HTMLElement>('[data-section]')) {
      if (section.offsetTop <= body.scrollTop + 8) current = section.dataset.section
    }
    if (current && current !== activeId) setActiveId(current)
  }

  const pick = (emoji: Emoji) => {
    onPick(withTone(emoji, tone))
    store(RECENT_STORAGE_KEY, JSON.stringify(pushRecent(readRecent(), emoji.emoji)))
  }

  const chooseTone = (next: SkinTone) => {
    setTone(next)
    setToneMenuOpen(false)
    store(TONE_STORAGE_KEY, String(next))
  }

  const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // Enter would submit the chat form; here it picks the first result instead.
    if (event.key !== 'Enter') return
    event.preventDefault()
    if (results?.[0]) pick(results[0])
  }

  const renderGrid = (emojis: Emoji[]) => (
    <div className="emoji-grid">
      {emojis.map((emoji) => (
        <button key={emoji.emoji} type="button" aria-label={emoji.label} title={emoji.label} onClick={() => pick(emoji)}>
          {withTone(emoji, tone)}
        </button>
      ))}
    </div>
  )

  return (
    <div id="emoji-panel" className="emoji-panel" role="dialog" aria-label="Emojis">
      <nav className="emoji-tabs" aria-label="Categorías">
        {sections.map((section) => (
          <button
            key={section.id}
            type="button"
            aria-label={section.name}
            title={section.name}
            aria-current={!results && section.id === currentId ? 'true' : undefined}
            onClick={() => {
              setQuery('')
              setActiveId(section.id)
              setJump({ id: section.id })
            }}
          >
            {section.icon}
          </button>
        ))}
      </nav>

      <div className="emoji-search">
        <input
          ref={searchRef}
          type="search"
          placeholder="Buscar emoji"
          aria-label="Buscar emoji"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onSearchKeyDown}
        />
        <button
          type="button"
          className="emoji-tone"
          aria-label={`Tono de piel: ${TONE_NAMES[tone]}`}
          title="Tono de piel"
          aria-expanded={toneMenuOpen}
          onClick={() => setToneMenuOpen((value) => !value)}
        >
          {withTone(TONE_SAMPLE, tone)}
        </button>
        {toneMenuOpen && (
          <div className="emoji-tone-menu" role="group" aria-label="Tono de piel">
            {TONE_NAMES.map((name, index) => (
              <button
                key={name}
                type="button"
                aria-label={name}
                title={name}
                aria-pressed={index === tone}
                onClick={() => chooseTone(index as SkinTone)}
              >
                {withTone(TONE_SAMPLE, index as SkinTone)}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="emoji-body" ref={bodyRef} onScroll={onScroll}>
        {failed ? (
          <div className="emoji-status">
            <p>No se pudieron cargar los emojis.</p>
            <button
              type="button"
              className="small"
              onClick={() => {
                setFailed(false)
                setAttempt((value) => value + 1)
              }}
            >
              Reintentar
            </button>
          </div>
        ) : !catalog ? (
          <p className="emoji-status">Cargando emojis…</p>
        ) : results ? (
          results.length > 0 ? (
            <section aria-label="Resultados">{renderGrid(results)}</section>
          ) : (
            <p className="emoji-status">No se encontraron emojis</p>
          )
        ) : (
          sections.map((section) => (
            <section key={section.id} data-section={section.id} className="emoji-section" aria-label={section.name}>
              <h3>{section.name}</h3>
              {renderGrid(section.emojis)}
            </section>
          ))
        )}
      </div>
    </div>
  )
}
