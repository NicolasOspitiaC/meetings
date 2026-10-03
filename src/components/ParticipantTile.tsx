import { useEffect, useRef } from 'react'
import type { Participant } from '../lib/protocol'
import { colorFor } from './colors'
import { CamIcon, MicIcon } from './icons'

interface Props {
  participant: Participant
  stream: MediaStream | null
  isSelf: boolean
}

export function ParticipantTile({ participant, stream, isSelf }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const showVideo = participant.video && !!stream && stream.getVideoTracks().length > 0

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.srcObject = stream
    if (stream) video.play().catch(() => undefined)
  }, [stream])

  return (
    <div className="tile-slot">
      <div className={`tile${showVideo ? ' has-video' : ''}`}>
        {/* The element stays mounted while there is a stream so remote audio keeps playing with video off. */}
        {stream && (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={isSelf}
            className={`${isSelf ? 'mirrored' : ''}${showVideo ? '' : ' hidden'}`}
          />
        )}
        {!showVideo && (
          <div className="avatar" style={{ background: colorFor(participant.id) }}>
            {participant.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="tile-label">
          <span className="tile-name">
            {participant.name}
            {isSelf && ' (tú)'}
            {participant.isHost && <span className="badge">anfitrión</span>}
          </span>
          <span className="tile-status">
            <span className={participant.audio ? 'on' : 'off'} title={participant.audio ? 'Micrófono activo' : 'Micrófono apagado'}>
              <MicIcon off={!participant.audio} />
            </span>
            <span className={participant.video ? 'on' : 'off'} title={participant.video ? 'Cámara activa' : 'Cámara apagada'}>
              <CamIcon off={!participant.video} />
            </span>
          </span>
        </div>
      </div>
    </div>
  )
}
