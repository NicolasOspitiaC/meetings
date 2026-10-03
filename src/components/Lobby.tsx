import { useState, type FormEvent } from 'react'
import { MAX_PARTICIPANTS } from '../lib/protocol'
import { roomClient, type RoomSnapshot } from '../lib/roomClient'
import { CopyButton, roomLink } from './CopyButton'

function codeFromUrl(): string {
  return new URLSearchParams(window.location.search).get('sala') ?? ''
}

interface Props {
  room: RoomSnapshot
}

export function Lobby({ room }: Props) {
  const [code, setCode] = useState(codeFromUrl)
  const connecting = room.status === 'connecting'
  const joining = room.status === 'joining'

  const join = (event: FormEvent) => {
    event.preventDefault()
    roomClient.joinRoom(code)
  }

  return (
    <main className="center-screen">
      <div className="lobby">
        <header className="lobby-header">
          <h1>Hola, {room.name}</h1>
          <p className="muted">
            Para reunirse, todos se conectan al código de una persona, que será el anfitrión. Máximo {MAX_PARTICIPANTS}{' '}
            personas por sala.
          </p>
        </header>

        <section className="card">
          <h2>Tu código de sala</h2>
          {connecting ? (
            <p className="muted">Conectando con el servidor…</p>
          ) : (
            <>
              <div className="room-code" aria-label="Tu código de sala">
                {room.myCode}
              </div>
              <div className="row">
                <CopyButton text={room.myCode ?? ''} label="Copiar código" />
                <CopyButton text={roomLink(room.myCode ?? '')} label="Copiar enlace" />
              </div>
            </>
          )}
          {connecting && room.error && (
            <button type="button" className="secondary" onClick={() => roomClient.retry()}>
              Reintentar
            </button>
          )}
          <button
            type="button"
            className="primary"
            disabled={room.status !== 'lobby'}
            onClick={() => roomClient.openRoom()}
          >
            Abrir mi sala (ser anfitrión)
          </button>
        </section>

        <section className="card">
          <h2>Unirse a una sala</h2>
          <form className="join-form" onSubmit={join}>
            <input
              aria-label="Código de la sala"
              placeholder="Ej: K7Q2XM"
              maxLength={10}
              value={code}
              disabled={joining}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
            />
            <button type="submit" className="primary" disabled={room.status !== 'lobby' || !code.trim()}>
              {joining ? 'Conectando…' : 'Unirse'}
            </button>
          </form>
          {joining && (
            <button type="button" className="link" onClick={() => roomClient.leave()}>
              Cancelar
            </button>
          )}
        </section>
      </div>
    </main>
  )
}
