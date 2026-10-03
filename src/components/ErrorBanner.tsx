interface Props {
  message: string
  onClose: () => void
}

export function ErrorBanner({ message, onClose }: Props) {
  return (
    <div className="error-banner" role="alert">
      <span>{message}</span>
      <button type="button" className="icon-button" onClick={onClose} aria-label="Cerrar aviso">
        ×
      </button>
    </div>
  )
}
