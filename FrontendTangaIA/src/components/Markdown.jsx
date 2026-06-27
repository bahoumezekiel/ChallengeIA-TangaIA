import React from 'react'

/**
 * Markdown — rendu léger du markdown produit par les agents (titres #, gras **,
 * listes -, listes numérotées) SANS dépendance externe. Évite d'afficher les
 * symboles bruts (#, *) dans l'interface.
 */

// Rendu inline : **gras**, *italique*, `code`
function renderInline(text, keyPrefix) {
  const nodes = []
  // découpe sur **gras**, *italique*, `code`
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g
  const parts = text.split(regex)
  parts.forEach((part, i) => {
    if (!part) return
    if (part.startsWith('**') && part.endsWith('**')) {
      nodes.push(<strong key={`${keyPrefix}-b${i}`} className="font-semibold text-tanga-charcoal">{part.slice(2, -2)}</strong>)
    } else if (part.startsWith('`') && part.endsWith('`')) {
      nodes.push(<code key={`${keyPrefix}-c${i}`} className="px-1 py-0.5 rounded bg-tanga-cream text-tanga-charcoal text-[0.85em] font-mono">{part.slice(1, -1)}</code>)
    } else if (part.startsWith('*') && part.endsWith('*')) {
      nodes.push(<em key={`${keyPrefix}-i${i}`}>{part.slice(1, -1)}</em>)
    } else {
      nodes.push(<React.Fragment key={`${keyPrefix}-t${i}`}>{part}</React.Fragment>)
    }
  })
  return nodes
}

export default function Markdown({ text, className = '' }) {
  if (!text) return null

  const lines = String(text).replace(/\r/g, '').split('\n')
  const blocks = []
  let para = []
  let list = null   // { type: 'ul' | 'ol', items: [] }

  const flushPara = () => {
    if (para.length) { blocks.push({ type: 'p', text: para.join(' ') }); para = [] }
  }
  const flushList = () => {
    if (list) { blocks.push(list); list = null }
  }

  for (const raw of lines) {
    const line = raw.trim()

    if (line === '') { flushPara(); flushList(); continue }

    // Séparateur ---
    if (/^---+$/.test(line)) { flushPara(); flushList(); blocks.push({ type: 'hr' }); continue }

    // Titres ###, ##, #
    const h = line.match(/^(#{1,6})\s+(.*)$/)
    if (h) {
      flushPara(); flushList()
      blocks.push({ type: 'h', level: h[1].length, text: h[2].replace(/[*#]+$/, '').trim() })
      continue
    }

    // Liste à puces : -, *, •
    const ul = line.match(/^[-*•]\s+(.*)$/)
    if (ul) {
      flushPara()
      if (!list || list.type !== 'ul') { flushList(); list = { type: 'ul', items: [] } }
      list.items.push(ul[1])
      continue
    }

    // Liste numérotée : 1. 2. ...
    const ol = line.match(/^\d+[.)]\s+(.*)$/)
    if (ol) {
      flushPara()
      if (!list || list.type !== 'ol') { flushList(); list = { type: 'ol', items: [] } }
      list.items.push(ol[1])
      continue
    }

    // Sinon : paragraphe
    flushList()
    para.push(line)
  }
  flushPara(); flushList()

  return (
    <div className={`tanga-markdown text-sm text-tanga-charcoal leading-relaxed space-y-2 ${className}`}>
      {blocks.map((b, i) => {
        if (b.type === 'h') {
          const size = b.level <= 1 ? 'text-base font-bold' : b.level === 2 ? 'text-sm font-bold' : 'text-sm font-semibold'
          return <p key={i} className={`${size} text-tanga-charcoal mt-1`}>{renderInline(b.text, `h${i}`)}</p>
        }
        if (b.type === 'hr') return <div key={i} className="h-px bg-tanga-sand/50 my-1" />
        if (b.type === 'ul') {
          return (
            <ul key={i} className="space-y-1 pl-1">
              {b.items.map((it, j) => (
                <li key={j} className="flex gap-2">
                  <span className="text-tanga-ochre mt-1.5 w-1 h-1 rounded-full bg-tanga-ochre flex-shrink-0" />
                  <span>{renderInline(it, `ul${i}-${j}`)}</span>
                </li>
              ))}
            </ul>
          )
        }
        if (b.type === 'ol') {
          return (
            <ol key={i} className="space-y-1 pl-1">
              {b.items.map((it, j) => (
                <li key={j} className="flex gap-2">
                  <span className="text-tanga-ochre font-semibold flex-shrink-0">{j + 1}.</span>
                  <span>{renderInline(it, `ol${i}-${j}`)}</span>
                </li>
              ))}
            </ol>
          )
        }
        return <p key={i}>{renderInline(b.text, `p${i}`)}</p>
      })}
    </div>
  )
}
