# Videollamada + chat 100 % frontend — diseño

## Objetivo
App React para chatear y hacer videollamada entre **máximo 5 personas**, sin backend propio.

## Requisitos
- Al abrir la página se pide el nombre del usuario.
- Cada persona tiene su propio **código de sala** (estable entre recargas mientras esté libre).
- Para reunirse, todos se conectan al código de **una** persona, que actúa como **anfitrión**.
- En la sala el chat es lo principal; cámara y micrófono se activan/desactivan a gusto (apagados por defecto).

## Arquitectura
- **Vite + React + TypeScript**, **PeerJS** (WebRTC). La señalización usa el servidor público gratuito de PeerJS
  (`0.peerjs.com`); no hay servidor propio.
- Código de sala = ID de PeerJS (`meetings-lite-v1-<CÓDIGO>`), 6 caracteres sin ambiguos (sin 0/O/1/I).
- **Topología del chat: estrella.** Cada invitado abre un `DataConnection` con el anfitrión. El anfitrión es la
  fuente de verdad (participantes + historial) y retransmite los mensajes.
- **Topología de medios: malla.** Cada participante con cámara/micrófono activo llama directamente a todos los demás
  (llamadas unidireccionales; el receptor responde sin stream). Cambiar audio/video reconstruye el stream y rehace las
  llamadas salientes.

### Protocolo (data channel)
| Dirección | Mensaje |
|---|---|
| invitado → anfitrión | `hello {name}`, `chat {text}`, `media {audio, video}` |
| anfitrión → invitado | `welcome {participants, messages}`, `rejected {reason}`, `participants {participants}`, `chat {message}`, `room-closed` |

Todo mensaje entrante se valida (forma y longitud) antes de usarse.

### Unidades
- `src/lib/protocol.ts` — tipos y validadores de mensajes.
- `src/lib/room.ts` — lógica pura del anfitrión (alta/baja, límite de 5, medios, historial) y utilidades de código.
- `src/lib/media.ts` — construcción del `MediaStream` local según audio/video deseado.
- `src/lib/roomClient.ts` — orquestación PeerJS; expone un snapshot inmutable (`subscribe`/`getSnapshot`).
- `src/hooks/useRoom.ts` — `useSyncExternalStore` sobre el cliente.
- `src/components/*` — NameScreen, Lobby, RoomView, ChatPanel, ParticipantTile, MediaControls.

## Reglas y errores
- Sala llena (5) → `rejected "La sala está llena"`.
- Conectarse a alguien que no ha abierto su sala, o que está como invitado en otra → rechazo con motivo.
- Código inexistente / sin respuesta en 12 s → error en el lobby.
- Si el anfitrión sale, la sala se cierra para todos; si sale un invitado, se notifica en el chat.
- Sin `mediaDevices` (contexto no seguro) o permiso denegado → mensaje claro, el estado de medios no cambia.

## Pruebas
Vitest para `room.ts` y `protocol.ts`. La parte WebRTC se verifica con `build` y prueba manual en dos pestañas.
