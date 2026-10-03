const base = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

export const MicIcon = ({ off }: { off?: boolean }) => (
  <svg {...base}>
    <rect x="9" y="2" width="6" height="12" rx="3" />
    <path d="M5 10v1a7 7 0 0 0 14 0v-1M12 18v4" />
    {off && <path d="M3 3l18 18" />}
  </svg>
)

export const CamIcon = ({ off }: { off?: boolean }) => (
  <svg {...base}>
    <rect x="2" y="6" width="14" height="12" rx="2" />
    <path d="M16 10l6-3v10l-6-3" />
    {off && <path d="M3 3l18 18" />}
  </svg>
)

export const NoiseIcon = ({ off }: { off?: boolean }) => (
  <svg {...base}>
    <path d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4" />
    {off && <path d="M3 3l18 18" />}
  </svg>
)

export const SendIcon = () => (
  <svg {...base}>
    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
  </svg>
)

export const ChatIcon = () => (
  <svg {...base}>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
)

export const CloseIcon = () => (
  <svg {...base}>
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
)
