import { X } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { useEffect } from 'react'

export function IconButton({
  children,
  title,
  onClick,
  active = false,
  disabled = false,
  className = '',
  size = 28
}: {
  children: ReactNode
  title: string
  onClick?: () => void
  active?: boolean
  disabled?: boolean
  className?: string
  size?: number
}) {
  return (
    <button
      type="button"
      className={`icon-btn ${active ? 'is-active' : ''} ${className}`}
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      style={{ width: size, height: size }}
    >
      {children}
    </button>
  )
}

export function Field({
  label,
  children,
  hint,
  inline = false,
  className = ''
}: {
  label: string
  children: ReactNode
  hint?: string
  inline?: boolean
  className?: string
}) {
  return (
    <label className={`field ${inline ? 'field-inline' : ''} ${className}`} title={hint}>
      <span className="field-label">{label}</span>
      <span className="field-control">{children}</span>
    </label>
  )
}

export function TextInput({
  value,
  onChange,
  placeholder,
  mono = false,
  disabled = false,
  type = 'text'
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  mono?: boolean
  disabled?: boolean
  type?: string
}) {
  return (
    <input
      className={`text-input ${mono ? 'mono' : ''}`}
      type={type}
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      spellCheck={false}
    />
  )
}

export function NumberInput({
  value,
  onChange,
  step = 1,
  min,
  max,
  suffix
}: {
  value: number
  onChange: (value: number) => void
  step?: number
  min?: number
  max?: number
  suffix?: string
}) {
  return (
    <span className="number-wrap">
      <input
        className="text-input number-input"
        type="number"
        value={Number.isFinite(value) ? Math.round(value * 100) / 100 : 0}
        step={step}
        min={min}
        max={max}
        onChange={(event) => {
          const next = Number(event.target.value)
          if (Number.isFinite(next)) onChange(next)
        }}
      />
      {suffix ? <span className="number-suffix">{suffix}</span> : null}
    </span>
  )
}

export function ColorInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <span className="color-wrap">
      <input type="color" className="color-swatch" value={normalizeColor(value)} onChange={(event) => onChange(event.target.value)} />
      <input className="text-input color-text mono" value={value} onChange={(event) => onChange(event.target.value)} />
    </span>
  )
}

export function Select({
  value,
  onChange,
  options,
  disabled = false
}: {
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
  disabled?: boolean
}) {
  return (
    <select className="select-input" value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

export function Toggle({
  checked,
  onChange,
  label
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
}) {
  return (
    <button
      type="button"
      className={`toggle ${checked ? 'is-on' : ''}`}
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
      aria-label={label}
    >
      <span className="toggle-thumb" />
    </button>
  )
}

export function Section({
  title,
  children,
  actions,
  defaultOpen = true
}: {
  title: string
  children: ReactNode
  actions?: ReactNode
  defaultOpen?: boolean
}) {
  return (
    <details className="inspector-section" open={defaultOpen}>
      <summary>
        <span>{title}</span>
        <span className="section-actions">{actions}</span>
      </summary>
      <div className="section-body">{children}</div>
    </details>
  )
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>
}

export function Modal({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
  footer
}: {
  title: string
  subtitle?: string
  children: ReactNode
  onClose: () => void
  wide?: boolean
  footer?: ReactNode
}) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [onClose])

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <div>
            <h2>{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <IconButton title="Cerrar" onClick={onClose}>
            <X size={16} />
          </IconButton>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-footer">{footer}</div> : null}
      </div>
    </div>
  )
}

export function Spinner({ size = 14 }: { size?: number }) {
  return <span className="spinner" style={{ width: size, height: size }} />
}

export function TooltipText({ children }: { children: ReactNode }) {
  return <span className="tooltip-text">{children}</span>
}

export function normalizeColor(value: string): string {
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return value
  if (/^#[0-9a-fA-F]{3}$/.test(value)) {
    return `#${value
      .slice(1)
      .split('')
      .map((char) => char + char)
      .join('')}`
  }
  return '#38bdf8'
}

export function styleVars(style: CSSProperties): CSSProperties {
  return style
}
