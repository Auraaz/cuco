interface IconProps {
  size?: number
}

const S = (size?: number) => ({
  width: size ?? 18,
  height: size ?? 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
})

export const ChevronLeft = ({ size }: IconProps) => (
  <svg {...S(size)}>
    <path d="M15 18l-6-6 6-6" />
  </svg>
)

export const Eye = ({ size }: IconProps) => (
  <svg {...S(size)}>
    <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z" />
    <circle cx="12" cy="12" r="2.8" />
  </svg>
)

export const EyeOff = ({ size }: IconProps) => (
  <svg {...S(size)}>
    <path d="M3 3l18 18" />
    <path d="M10.6 5.8A9.8 9.8 0 0 1 12 5.5c6.5 0 10 6.5 10 6.5a17.6 17.6 0 0 1-3 3.9M6.6 6.6A17 17 0 0 0 2 12s3.5 6.5 10 6.5a9.9 9.9 0 0 0 4.4-1" />
  </svg>
)

export const Rotate = ({ size }: IconProps) => (
  <svg {...S(size)}>
    <path d="M21 12a9 9 0 1 1-2.6-6.3" />
    <path d="M21 3v5h-5" />
  </svg>
)

export const Download = ({ size }: IconProps) => (
  <svg {...S(size)}>
    <path d="M12 3v12" />
    <path d="M7 10l5 5 5-5" />
    <path d="M4 21h16" />
  </svg>
)

export const Undo = ({ size }: IconProps) => (
  <svg {...S(size)}>
    <path d="M9 14L4 9l5-5" />
    <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
  </svg>
)

export const Doc = ({ size }: IconProps) => (
  <svg {...S(size)}>
    <path d="M7 3h7l5 5v13H7z" />
    <path d="M14 3v5h5" />
    <path d="M10 13h6M10 17h6" />
  </svg>
)

export const Redo = ({ size }: IconProps) => (
  <svg {...S(size)}>
    <path d="M15 14l5-5-5-5" />
    <path d="M20 9H10a6 6 0 0 0 0 12h3" />
  </svg>
)

export const ChevronRight = ({ size }: IconProps) => (
  <svg {...S(size)}>
    <path d="M9 6l6 6-6 6" />
  </svg>
)

export const Minimize = ({ size }: IconProps) => (
  <svg {...S(size)}>
    <path d="M5 12h14" />
  </svg>
)

export const Layers = ({ size }: IconProps) => (
  <svg {...S(size)}>
    <path d="M12 3l9 5-9 5-9-5 9-5z" />
    <path d="M3 13l9 5 9-5" />
  </svg>
)

export const Close = ({ size }: IconProps) => (
  <svg {...S(size)}>
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
)

export const Upload = ({ size }: IconProps) => (
  <svg {...S(size)}>
    <path d="M12 21V9" />
    <path d="M7 14l5-5 5 5" />
    <path d="M4 3h16" />
  </svg>
)

export const Cart = ({ size }: IconProps) => (
  <svg {...S(size)}>
    <circle cx="9" cy="20" r="1.4" />
    <circle cx="18" cy="20" r="1.4" />
    <path d="M2.5 3.5h2.2l2 11.2a1.6 1.6 0 0 0 1.6 1.3h8.3a1.6 1.6 0 0 0 1.6-1.3l1.3-7H6" />
  </svg>
)

export const Trash = ({ size }: IconProps) => (
  <svg {...S(size)}>
    <path d="M4 7h16" />
    <path d="M10 11v6M14 11v6" />
    <path d="M6 7l1 12a1.5 1.5 0 0 0 1.5 1.4h7A1.5 1.5 0 0 0 17 19L18 7" />
    <path d="M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7" />
  </svg>
)
