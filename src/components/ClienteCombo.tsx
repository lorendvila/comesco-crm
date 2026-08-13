import { useEffect, useMemo, useRef, useState } from 'react'
import type { ClienteResumen } from '../data/clientes'

interface Props {
  clientes: ClienteResumen[]
  value: string // cliente_id seleccionado ('' si ninguno)
  onChange: (id: string) => void
  disabled?: boolean // solo lectura: muestra el cliente sin permitir cambiarlo
}

const etiqueta = (c: ClienteResumen) => `${c.codigo_interno} · ${c.nombre}`

// Buscador de clientes con autocompletado: se teclea el nombre (o código/ciudad)
// y se filtra la lista; se elige con ratón o teclado. Sustituye al <select> largo.
export function ClienteCombo({ clientes, value, onChange, disabled }: Props) {
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [activo, setActivo] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)

  // El texto mostrado sigue a la selección (y se restaura al cerrar sin elegir).
  useEffect(() => {
    if (open) return
    const sel = clientes.find((c) => c.id === value)
    setText(sel ? etiqueta(sel) : '')
  }, [value, clientes, open])

  const filtrados = useMemo(() => {
    const t = text.trim().toLowerCase()
    const sel = clientes.find((c) => c.id === value)
    // Si el texto es justo el cliente ya elegido, muestra la lista completa.
    if (!t || (sel && text === etiqueta(sel))) return clientes
    return clientes.filter(
      (c) =>
        c.nombre.toLowerCase().includes(t) ||
        c.codigo_interno.toLowerCase().includes(t) ||
        (c.ciudad ?? '').toLowerCase().includes(t),
    )
  }, [clientes, text, value])

  // Cierra al hacer clic fuera.
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const elegir = (c: ClienteResumen) => {
    onChange(c.id)
    setOpen(false)
  }

  if (disabled) {
    const sel = clientes.find((c) => c.id === value)
    return <span className="t-body">{sel ? etiqueta(sel) : '—'}</span>
  }

  return (
    <div className="combo" ref={boxRef}>
      <input
        className="input"
        placeholder="Escribe para buscar un cliente…"
        value={text}
        onChange={(e) => { setText(e.target.value); setOpen(true); setActivo(0) }}
        onFocus={() => { setOpen(true); setActivo(0) }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActivo((a) => Math.min(a + 1, filtrados.length - 1)) }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActivo((a) => Math.max(a - 1, 0)) }
          else if (e.key === 'Enter') { if (open && filtrados[activo]) { e.preventDefault(); elegir(filtrados[activo]) } }
          else if (e.key === 'Escape') { setOpen(false) }
        }}
      />
      {open && (
        <ul className="combo__list">
          {filtrados.map((c, i) => (
            <li
              key={c.id}
              className={'combo__opt' + (i === activo ? ' is-active' : '') + (c.id === value ? ' is-sel' : '')}
              onMouseDown={(e) => { e.preventDefault(); elegir(c) }}
              onMouseEnter={() => setActivo(i)}
            >
              <span className="mono">{c.codigo_interno}</span> · {c.nombre}
              {c.ciudad ? <span className="t-caption"> · {c.ciudad}</span> : null}
            </li>
          ))}
          {filtrados.length === 0 && <li className="combo__empty t-body-sm">Sin resultados</li>}
        </ul>
      )}
    </div>
  )
}
