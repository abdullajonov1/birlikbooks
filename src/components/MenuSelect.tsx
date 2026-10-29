import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type Option = { value: string; label: string }

export function MenuSelect({
  value,
  options,
  onChange,
  label,
  className = '',
  menuWidth,
}: {
  value: string
  options: Option[]
  onChange: (value: string) => void
  label: string
  className?: string
  menuWidth?: number
}) {
  const [open, setOpen] = useState(false)
  const [box, setBox] = useState({ top: 0, left: 0, width: 0, flip: false })
  const root = useRef<HTMLDivElement>(null)
  const menu = useRef<HTMLUListElement>(null)
  const listId = useId()
  const current = options.find((option) => option.value === value) ?? options[0]

  useEffect(() => {
    if (!open) return
    function place() {
      const rect = root.current?.getBoundingClientRect()
      if (!rect) return
      const width = menuWidth ?? Math.max(rect.width, 148)
      let left = rect.left
      if (left + width > window.innerWidth - 12) left = Math.max(12, rect.right - width)
      const flip = rect.bottom + 220 > window.innerHeight
      setBox({ top: flip ? rect.top - 6 : rect.bottom + 6, left, width, flip })
    }
    function onPointer(event: MouseEvent) {
      const target = event.target as Node
      if (root.current?.contains(target) || menu.current?.contains(target)) return
      setOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, menuWidth])

  return (
    <div className={`menu-select ${className}`} ref={root}>
      <button type="button" className="menu-select-btn" aria-label={label} aria-expanded={open} aria-controls={open ? listId : undefined} onClick={() => setOpen((currentOpen) => !currentOpen)}>
        <span>{current?.label}</span>
        <i aria-hidden="true" />
      </button>
      {open
        ? createPortal(
            <ul
              id={listId}
              className="menu-select-list"
              role="listbox"
              ref={menu}
              style={{ top: box.top, left: box.left, width: box.width, transform: box.flip ? 'translateY(-100%)' : undefined }}
            >
              {options.map((option) => (
                <li key={option.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={option.value === value}
                    className={option.value === value ? 'on' : ''}
                    onClick={() => {
                      onChange(option.value)
                      setOpen(false)
                    }}
                  >
                    {option.label}
                  </button>
                </li>
              ))}
            </ul>,
            document.body,
          )
        : null}
    </div>
  )
}
