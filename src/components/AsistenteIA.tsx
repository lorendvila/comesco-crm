import { useEffect, useRef, useState } from 'react'
import { preguntarAsistente } from '../data/asistente'
import type { MensajeChat } from '../data/asistente'

const BIENVENIDA: MensajeChat = {
  role: 'assistant',
  content: '¡Hola! Soy el asistente del CRM. Pregúntame cómo hacer cualquier cosa: crear un pedido, dar de alta un cliente, entender el inventario por ciudad, las notas de crédito… ¿en qué te ayudo?',
}

// Chat flotante de ayuda (asistente-guía). Aparece en todas las pantallas.
export function AsistenteIA() {
  const [abierto, setAbierto] = useState(false)
  const [mensajes, setMensajes] = useState<MensajeChat[]>([BIENVENIDA])
  const [texto, setTexto] = useState('')
  const [cargando, setCargando] = useState(false)
  const finRef = useRef<HTMLDivElement>(null)

  // Auto-scroll al último mensaje.
  useEffect(() => {
    if (abierto) finRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes, abierto, cargando])

  const enviar = async () => {
    const pregunta = texto.trim()
    if (!pregunta || cargando) return
    const historial = [...mensajes, { role: 'user' as const, content: pregunta }]
    setMensajes(historial)
    setTexto('')
    setCargando(true)
    try {
      // No mandamos el saludo inicial (no aporta contexto).
      const paraEnviar = historial.filter((m) => m !== BIENVENIDA)
      const reply = await preguntarAsistente(paraEnviar)
      setMensajes((m) => [...m, { role: 'assistant', content: reply }])
    } catch (e) {
      setMensajes((m) => [...m, { role: 'assistant', content: `⚠️ ${(e as Error).message}` }])
    } finally {
      setCargando(false)
    }
  }

  return (
    <>
      <button
        className="ia-fab"
        onClick={() => setAbierto((v) => !v)}
        title="Asistente del CRM"
        aria-label="Abrir asistente del CRM"
      >
        {abierto ? '✕' : '💬'}
      </button>

      {abierto && (
        <div className="ia-panel" role="dialog" aria-label="Asistente del CRM">
          <div className="ia-header">
            <span className="ia-header__title">Asistente del CRM</span>
            <button className="ia-header__close" onClick={() => setAbierto(false)} aria-label="Cerrar">✕</button>
          </div>

          <div className="ia-body">
            {mensajes.map((m, i) => (
              <div key={i} className={`ia-msg ia-msg--${m.role}`}>
                {m.content.split('\n').map((linea, j) => <p key={j}>{linea || ' '}</p>)}
              </div>
            ))}
            {cargando && <div className="ia-msg ia-msg--assistant ia-msg--cargando">Escribiendo…</div>}
            <div ref={finRef} />
          </div>

          <form
            className="ia-input"
            onSubmit={(e) => { e.preventDefault(); enviar() }}
          >
            <input
              className="input"
              placeholder="Escribe tu duda…"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              disabled={cargando}
            />
            <button className="btn btn-primary btn-sm" type="submit" disabled={cargando || !texto.trim()}>
              Enviar
            </button>
          </form>
          <p className="ia-nota">Solo resuelve dudas de uso del CRM; no accede a tus datos.</p>
        </div>
      )}
    </>
  )
}
