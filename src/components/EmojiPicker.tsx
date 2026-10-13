import { useEffect, useRef, useState } from 'react'
import { SmileIcon } from './icons'

const EMOJIS: [emoji: string, name: string][] = [
  ['😀', 'Sonrisa'],
  ['😂', 'Risa con lágrimas'],
  ['🤣', 'Muerto de risa'],
  ['😊', 'Sonrojado'],
  ['😍', 'Enamorado'],
  ['😘', 'Beso'],
  ['😎', 'Gafas de sol'],
  ['🤔', 'Pensando'],
  ['😅', 'Sudor nervioso'],
  ['😉', 'Guiño'],
  ['🙃', 'Al revés'],
  ['😴', 'Durmiendo'],
  ['😢', 'Llorando'],
  ['😭', 'Llanto'],
  ['😡', 'Enojado'],
  ['😱', 'Asustado'],
  ['🤯', 'Mente explotando'],
  ['🥳', 'Fiesta'],
  ['🙄', 'Ojos en blanco'],
  ['🤐', 'Boca cerrada'],
  ['👍', 'Pulgar arriba'],
  ['👎', 'Pulgar abajo'],
  ['👏', 'Aplausos'],
  ['🙌', 'Manos arriba'],
  ['👋', 'Saludo'],
  ['🙏', 'Por favor'],
  ['💪', 'Fuerza'],
  ['👀', 'Ojos'],
  ['❤️', 'Corazón'],
  ['🔥', 'Fuego'],
  ['✨', 'Destellos'],
  ['🎉', 'Celebración'],
  ['✅', 'Hecho'],
  ['❌', 'No'],
  ['💯', 'Cien'],
  ['☕', 'Café'],
]

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
    const onKeyDown = (event: KeyboardEvent) => {
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
        aria-controls="emoji-grid"
        onClick={() => setOpen((value) => !value)}
      >
        <SmileIcon />
      </button>
      {open && (
        <div id="emoji-grid" className="emoji-grid" role="group" aria-label="Emojis">
          {EMOJIS.map(([emoji, name]) => (
            <button key={emoji} type="button" aria-label={name} title={name} onClick={() => onPick(emoji)}>
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
