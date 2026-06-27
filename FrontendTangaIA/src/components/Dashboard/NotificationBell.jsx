import React, { useState, useEffect, useRef, useCallback } from 'react'
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '../../api/client.js'
import { Bell, Check, AlertTriangle, X } from '../icons.jsx'

const TYPE_META = {
  success: { color: '#16a34a', Icon: Check },
  warning: { color: '#d97706', Icon: AlertTriangle },
  error:   { color: '#dc2626', Icon: AlertTriangle },
  info:    { color: '#1E40AF', Icon: Bell },
}

function tempsRelatif(iso) {
  if (!iso) return ''
  const d = new Date(String(iso).replace(' ', 'T'))
  if (isNaN(d)) return ''
  const s = Math.floor((Date.now() - d.getTime()) / 1000)
  if (s < 60) return "à l'instant"
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`
  return `il y a ${Math.floor(s / 86400)} j`
}

export default function NotificationBell({ sessionId }) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [nonLues, setNonLues] = useState(0)
  const ref = useRef(null)

  const charger = useCallback(async () => {
    try {
      const res = await getNotifications(sessionId || undefined)
      setItems(res.notifications || [])
      setNonLues(res.non_lues || 0)
    } catch {
      /* silencieux : la cloche ne doit pas casser le dashboard */
    }
  }, [sessionId])

  // Chargement initial + rafraîchissement périodique (toutes les 30 s)
  useEffect(() => {
    charger()
    const t = setInterval(charger, 30000)
    return () => clearInterval(t)
  }, [charger])

  // Fermer au clic extérieur
  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const ouvrir = () => { setOpen((v) => !v); if (!open) charger() }

  const lire = async (id) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, lue: true } : n)))
    setNonLues((n) => Math.max(0, n - 1))
    try { await markNotificationRead(id) } catch { /* ignore */ }
  }

  const toutLire = async () => {
    setItems((prev) => prev.map((n) => ({ ...n, lue: true })))
    setNonLues(0)
    try { await markAllNotificationsRead(sessionId || undefined) } catch { /* ignore */ }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={ouvrir}
        className="relative p-2 rounded-xl hover:bg-tanga-sand/40 text-tanga-charcoal-light hover:text-tanga-charcoal transition-colors"
        title="Notifications"
      >
        <Bell className="w-5 h-5" />
        {nonLues > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-tanga-ochre text-white text-[10px] font-bold flex items-center justify-center">
            {nonLues > 9 ? '9+' : nonLues}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-white rounded-2xl shadow-2xl border border-tanga-sand/50 z-50 overflow-hidden animate-slide-up">
          <div className="flex items-center justify-between px-4 py-3 border-b border-tanga-sand/40">
            <span className="font-bold text-tanga-charcoal text-sm">Notifications</span>
            <div className="flex items-center gap-2">
              {nonLues > 0 && (
                <button onClick={toutLire} className="text-xs font-semibold text-tanga-ochre hover:underline">
                  Tout marquer lu
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-tanga-charcoal-light hover:text-tanga-charcoal">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto custom-scroll">
            {items.length === 0 ? (
              <div className="px-4 py-10 text-center text-tanga-charcoal-light">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Aucune notification</p>
              </div>
            ) : (
              items.map((n) => {
                const meta = TYPE_META[n.type] || TYPE_META.info
                const Icon = meta.Icon
                return (
                  <button
                    key={n.id}
                    onClick={() => !n.lue && lire(n.id)}
                    className={`w-full text-left flex items-start gap-3 px-4 py-3 border-b border-tanga-sand/30 transition-colors hover:bg-tanga-cream/50 ${n.lue ? 'opacity-60' : ''}`}
                  >
                    <span
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ backgroundColor: `${meta.color}18`, color: meta.color }}
                    >
                      <Icon className="w-4 h-4" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-tanga-charcoal truncate">{n.titre}</p>
                        {!n.lue && <span className="w-2 h-2 rounded-full bg-tanga-ochre flex-shrink-0" />}
                      </div>
                      {n.message && <p className="text-xs text-tanga-charcoal-light mt-0.5 line-clamp-2">{n.message}</p>}
                      <p className="text-[11px] text-tanga-charcoal-light/70 mt-1">{tempsRelatif(n.date || n.created_at)}</p>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
