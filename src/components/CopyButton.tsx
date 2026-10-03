import { useState } from 'react'

interface Props {
  text: string
  label: string
}

export function CopyButton({ text, label }: Props) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      window.prompt('Copia este texto:', text)
    }
  }

  return (
    <button type="button" className="secondary small" onClick={copy}>
      {copied ? '¡Copiado!' : label}
    </button>
  )
}

export function roomLink(code: string): string {
  const url = new URL(window.location.href)
  url.search = ''
  url.hash = ''
  url.searchParams.set('sala', code)
  return url.toString()
}
