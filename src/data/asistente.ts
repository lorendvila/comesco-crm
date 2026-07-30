import { supabase } from '../lib/supabase'

export interface MensajeChat {
  role: 'user' | 'assistant'
  content: string
}

// Pregunta al asistente-guía del CRM (Edge Function asistente-crm). Le pasa
// el historial de la conversación; el JWT del usuario viaja automáticamente.
export async function preguntarAsistente(messages: MensajeChat[]): Promise<string> {
  const { data, error } = await supabase.functions.invoke('asistente-crm', { body: { messages } })
  if (error) throw new Error(error.message)
  if (!data?.ok) throw new Error(data?.error ?? 'El asistente no está disponible.')
  return data.reply as string
}
