import { ErrorBanner } from './components/ErrorBanner'
import { Lobby } from './components/Lobby'
import { NameScreen } from './components/NameScreen'
import { RoomView } from './components/RoomView'
import { useRoom } from './hooks/useRoom'
import { roomClient } from './lib/roomClient'

export default function App() {
  const room = useRoom()

  return (
    <>
      {room.error && <ErrorBanner message={room.error} onClose={() => roomClient.dismissError()} />}
      {room.status === 'idle' ? (
        <NameScreen onSubmit={(name) => roomClient.start(name)} />
      ) : room.status === 'in-room' ? (
        <RoomView room={room} />
      ) : (
        <Lobby room={room} />
      )}
    </>
  )
}
