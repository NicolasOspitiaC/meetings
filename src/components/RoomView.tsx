import { useState } from 'react'
import { MAX_PARTICIPANTS } from '../lib/protocol'
import { roomClient, type RoomSnapshot } from '../lib/roomClient'
import { ChatPanel } from './ChatPanel'
import { CopyButton, roomLink } from './CopyButton'
import { CamIcon, ChatIcon, MicIcon } from './icons'
import { ParticipantTile } from './ParticipantTile'

interface Props {
  room: RoomSnapshot
}

export function RoomView({ room }: Props) {
  const myId = room.myCode ?? ''
  const roomCode = room.roomCode ?? ''
  // On narrow screens the chat covers the cameras, so it starts hidden there.
  const [chatOpen, setChatOpen] = useState(() => !window.matchMedia('(max-width: 960px)').matches)
  const [seenCount, setSeenCount] = useState(room.messages.length)

  // Everything is "seen" while the chat is visible; unread only counts other people's messages.
  if (chatOpen && seenCount !== room.messages.length) setSeenCount(room.messages.length)
  const unread = room.messages.slice(seenCount).filter((message) => !message.system && message.fromId !== myId).length

  return (
    <div className="room">
      <header className="room-header">
        <div className="room-title">
          <h1>
            Sala <span className="mono">{roomCode}</span>
          </h1>
          <span className="badge">{room.role === 'host' ? 'Eres el anfitrión' : 'Invitado'}</span>
          <span className="muted">
            {room.participants.length}/{MAX_PARTICIPANTS} personas
          </span>
        </div>
        <div className="row">
          <CopyButton text={roomCode} label="Copiar código" />
          <CopyButton text={roomLink(roomCode)} label="Copiar enlace" />
          <button type="button" className="danger small" onClick={() => roomClient.leave()}>
            {room.role === 'host' ? 'Cerrar sala' : 'Salir'}
          </button>
        </div>
      </header>

      <div className={`room-body${chatOpen ? ' chat-open' : ''}`}>
        <main className="stage" aria-label="Participantes">
          <div className="tiles" data-count={room.participants.length}>
            {room.participants.map((participant) => {
              const isSelf = participant.id === myId
              return (
                <ParticipantTile
                  key={participant.id}
                  participant={isSelf ? { ...participant, audio: room.audio, video: room.video } : participant}
                  stream={isSelf ? room.localStream : (room.remoteStreams[participant.id] ?? null)}
                  isSelf={isSelf}
                />
              )
            })}
          </div>
          <div className="media-controls">
            <button
              type="button"
              className={room.audio ? 'control on' : 'control off'}
              disabled={room.mediaBusy}
              aria-pressed={room.audio}
              aria-label={room.audio ? 'Silenciar' : 'Activar micrófono'}
              title={room.audio ? 'Silenciar' : 'Activar micrófono'}
              onClick={() => roomClient.toggleAudio()}
            >
              <MicIcon off={!room.audio} />
            </button>
            <button
              type="button"
              className={room.video ? 'control on' : 'control off'}
              disabled={room.mediaBusy}
              aria-pressed={room.video}
              aria-label={room.video ? 'Apagar cámara' : 'Activar cámara'}
              title={room.video ? 'Apagar cámara' : 'Activar cámara'}
              onClick={() => roomClient.toggleVideo()}
            >
              <CamIcon off={!room.video} />
            </button>
            <button
              type="button"
              className={chatOpen ? 'control active' : 'control'}
              aria-pressed={chatOpen}
              aria-controls="chat-panel"
              aria-label={chatOpen ? 'Ocultar chat' : unread ? `Mostrar chat (${unread} sin leer)` : 'Mostrar chat'}
              title={chatOpen ? 'Ocultar chat' : 'Mostrar chat'}
              onClick={() => setChatOpen((open) => !open)}
            >
              <ChatIcon />
              {unread > 0 && <span className="unread">{unread > 99 ? '99+' : unread}</span>}
            </button>
          </div>
        </main>

        <ChatPanel
          messages={room.messages}
          myId={myId}
          onSend={(text) => roomClient.sendChat(text)}
          open={chatOpen}
          onClose={() => setChatOpen(false)}
        />
      </div>
    </div>
  )
}
