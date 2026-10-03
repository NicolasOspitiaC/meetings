import { useSyncExternalStore } from 'react'
import { roomClient, type RoomSnapshot } from '../lib/roomClient'

export function useRoom(): RoomSnapshot {
  return useSyncExternalStore(roomClient.subscribe, roomClient.getSnapshot)
}
