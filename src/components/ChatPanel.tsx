import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import type { ChatMessage } from '../lib/protocol'
import { colorFor } from './colors'
import { EmojiPicker } from './EmojiPicker'
import { CloseIcon, SendIcon } from './icons'

interface Props {
  messages: ChatMessage[]
  myId: string
  onSend: (text: string) => void
  open: boolean
  onClose: () => void
}

const MAX_LENGTH = 2000

const timeFormat = new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit' })

export function ChatPanel({ messages, myId, onSend, open, onClose }: Props) {
  const [draft, setDraft] = useState('')
  const listRef = useRef<HTMLOListElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const caretRef = useRef<number | null>(null)

  // While hidden the list has no height, so it also re-scrolls when the panel opens again.
  useEffect(() => {
    const list = listRef.current
    if (open && list) list.scrollTop = list.scrollHeight
  }, [messages, open])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  // Puts the caret back right after an inserted emoji once the new draft is rendered.
  useLayoutEffect(() => {
    const input = inputRef.current
    if (caretRef.current === null || !input) return
    input.focus()
    input.setSelectionRange(caretRef.current, caretRef.current)
    caretRef.current = null
  }, [draft])

  const insertEmoji = (emoji: string) => {
    const input = inputRef.current
    const start = input?.selectionStart ?? draft.length
    const end = input?.selectionEnd ?? draft.length
    const next = draft.slice(0, start) + emoji + draft.slice(end)
    if (next.length > MAX_LENGTH) return
    caretRef.current = start + emoji.length
    setDraft(next)
  }

  const submit = (event?: FormEvent) => {
    event?.preventDefault()
    if (!draft.trim()) return
    onSend(draft)
    setDraft('')
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      submit()
    }
  }

  return (
    <section id="chat-panel" className="chat" aria-label="Chat" hidden={!open}>
      <header className="chat-header">
        <h2>Chat</h2>
        <button type="button" className="icon-only ghost" aria-label="Ocultar chat" title="Ocultar chat" onClick={onClose}>
          <CloseIcon />
        </button>
      </header>
      <ol className="messages" ref={listRef}>
        {messages.map((message) =>
          message.system ? (
            <li key={message.id} className="message system">
              {message.text}
            </li>
          ) : (
            <li key={message.id} className={`message${message.fromId === myId ? ' mine' : ''}`}>
              <div className="message-meta">
                <span className="message-author" style={{ color: colorFor(message.fromId) }}>
                  {message.fromId === myId ? 'Tú' : message.fromName}
                </span>
                <time dateTime={new Date(message.ts).toISOString()}>{timeFormat.format(message.ts)}</time>
              </div>
              <p className="message-text">{message.text}</p>
            </li>
          ),
        )}
      </ol>
      <form className="composer" onSubmit={submit}>
        <EmojiPicker onPick={insertEmoji} />
        <textarea
          ref={inputRef}
          aria-label="Escribe un mensaje"
          placeholder="Escribe un mensaje…"
          title="Enter para enviar, Shift+Enter para salto de línea"
          rows={1}
          maxLength={MAX_LENGTH}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
        />
        <button type="submit" className="primary icon-only" aria-label="Enviar" disabled={!draft.trim()}>
          <SendIcon />
        </button>
      </form>
    </section>
  )
}
