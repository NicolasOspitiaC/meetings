import { useState, type FormEvent } from 'react'

const NAME_STORAGE_KEY = 'meetings.name'

function storedName(): string {
  try {
    return localStorage.getItem(NAME_STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

interface Props {
  onSubmit: (name: string) => void
}

export function NameScreen({ onSubmit }: Props) {
  const [name, setName] = useState(storedName)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    try {
      localStorage.setItem(NAME_STORAGE_KEY, trimmed)
    } catch {
      // Not critical: the name is only remembered for convenience.
    }
    onSubmit(trimmed)
  }

  return (
    <main className="center-screen">
      <form className="card name-card" onSubmit={submit}>
        <h1>Meetings</h1>
        <p className="muted">Chat y videollamada de hasta 5 personas, directo entre navegadores.</p>
        <label htmlFor="name">¿Cómo te llamas?</label>
        <input
          id="name"
          autoFocus
          maxLength={30}
          placeholder="Tu nombre"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <button type="submit" className="primary" disabled={!name.trim()}>
          Continuar
        </button>
      </form>
    </main>
  )
}
