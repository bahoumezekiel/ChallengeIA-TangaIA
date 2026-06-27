/**
 * icons.jsx — Bibliothèque d'icônes SVG de TangaAI.
 *
 * Remplace tous les emojis du frontend par de vraies icônes vectorielles cohérentes
 * (style trait, couleur héritée via currentColor). Chaque icône accepte `className`.
 *
 * Contient aussi :
 *   - DOMAIN_META : couleur + libellé + icône par domaine d'agent (source unique de vérité)
 *   - TOOL_META   : icône par outil
 *   - STATUS_META : icône + couleur par statut de résultat
 *   - <DomainGlyph domaine />, <ToolGlyph tool />, <StatusGlyph statut /> : helpers de rendu
 */

import React from 'react'

const base = (props) => ({
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: props.strokeWidth || 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  className: props.className || 'w-5 h-5',
})

/* ───────────────────────── Icônes UI ───────────────────────── */

export function ArrowRight(p) {
  return (<svg {...base(p)}><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>)
}
export function ArrowLeft(p) {
  return (<svg {...base(p)}><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>)
}
export function Check(p) {
  return (<svg {...base(p)}><polyline points="20 6 9 17 4 12" /></svg>)
}
export function X(p) {
  return (<svg {...base(p)}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>)
}
export function Minus(p) {
  return (<svg {...base(p)}><line x1="5" y1="12" x2="19" y2="12" /></svg>)
}
export function Plus(p) {
  return (<svg {...base(p)}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>)
}
export function ChevronDown(p) {
  return (<svg {...base(p)}><polyline points="6 9 12 15 18 9" /></svg>)
}
export function Menu(p) {
  return (<svg {...base(p)}><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>)
}
export function Clock(p) {
  return (<svg {...base(p)}><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" /></svg>)
}
export function ClipboardList(p) {
  return (<svg {...base(p)}><path d="M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1z" /><rect x="5" y="6" width="14" height="15" rx="2" /><line x1="9" y1="11" x2="15" y2="11" /><line x1="9" y1="15" x2="13" y2="15" /></svg>)
}
export function AlertTriangle(p) {
  return (<svg {...base(p)}><path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.4 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>)
}
export function Globe(p) {
  return (<svg {...base(p)}><circle cx="12" cy="12" r="9" /><line x1="3" y1="12" x2="21" y2="12" /><path d="M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18z" /></svg>)
}
export function Bot(p) {
  return (<svg {...base(p)}><rect x="4" y="8" width="16" height="11" rx="2" /><path d="M12 8V4" /><circle cx="9" cy="13" r="1" fill="currentColor" stroke="none" /><circle cx="15" cy="13" r="1" fill="currentColor" stroke="none" /><line x1="9" y1="17" x2="15" y2="17" /></svg>)
}
export function Eye(p) {
  return (<svg {...base(p)}><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" /><circle cx="12" cy="12" r="3" /></svg>)
}
export function EyeOff(p) {
  return (<svg {...base(p)}><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>)
}
export function Info(p) {
  return (<svg {...base(p)}><circle cx="12" cy="12" r="9" /><line x1="12" y1="11" x2="12" y2="16" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>)
}
export function Lock(p) {
  return (<svg {...base(p)}><rect x="4" y="11" width="16" height="9" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>)
}
export function Save(p) {
  return (<svg {...base(p)}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>)
}
export function Link(p) {
  return (<svg {...base(p)}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>)
}
export function Pencil(p) {
  return (<svg {...base(p)}><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>)
}
export function RefreshCw(p) {
  return (<svg {...base(p)}><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>)
}
export function Home(p) {
  return (<svg {...base(p)}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>)
}
export function Search(p) {
  return (<svg {...base(p)}><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>)
}
export function Zap(p) {
  return (<svg {...base(p)}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>)
}
export function Sparkles(p) {
  return (<svg {...base(p)}><path d="M12 3l1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3z" /><path d="M19 14l.7 1.7L21.5 16.5l-1.8.8L19 19l-.7-1.7L16.5 16.5l1.8-.8L19 14z" /></svg>)
}
export function Users(p) {
  return (<svg {...base(p)}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>)
}
export function Rocket(p) {
  return (<svg {...base(p)}><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" /><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" /><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" /><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" /></svg>)
}
export function Trash(p) {
  return (<svg {...base(p)}><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" /></svg>)
}
export function Shield(p) {
  return (<svg {...base(p)}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>)
}
export function Mail(p) {
  return (<svg {...base(p)}><rect x="3" y="5" width="18" height="14" rx="2" /><polyline points="3 7 12 13 21 7" /></svg>)
}
export function FileText(p) {
  return (<svg {...base(p)}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="13" y2="17" /></svg>)
}
export function Receipt(p) {
  return (<svg {...base(p)}><path d="M5 3v18l2-1 2 1 2-1 2 1 2-1 2 1V3l-2 1-2-1-2 1-2-1-2 1-2-1z" /><line x1="8" y1="8" x2="16" y2="8" /><line x1="8" y1="12" x2="16" y2="12" /></svg>)
}
export function CreditCard(p) {
  return (<svg {...base(p)}><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>)
}
export function Calendar(p) {
  return (<svg {...base(p)}><rect x="3" y="5" width="18" height="16" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="8" y1="3" x2="8" y2="6" /><line x1="16" y1="3" x2="16" y2="6" /></svg>)
}
export function MessageCircle(p) {
  return (<svg {...base(p)}><path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.5L3 21l2-5.4A8.5 8.5 0 1 1 21 11.5z" /></svg>)
}
export function BarChart(p) {
  return (<svg {...base(p)}><line x1="6" y1="20" x2="6" y2="12" /><line x1="12" y1="20" x2="12" y2="6" /><line x1="18" y1="20" x2="18" y2="14" /></svg>)
}
export function Megaphone(p) {
  return (<svg {...base(p)}><path d="M3 11v2a1 1 0 0 0 1 1h2l3.5 4V6L6 10H4a1 1 0 0 0-1 1z" /><path d="M9.5 6 18 3v18l-8.5-3" /><path d="M18 8a3 3 0 0 1 0 8" /></svg>)
}
export function Briefcase(p) {
  return (<svg {...base(p)}><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" /><line x1="3" y1="12" x2="21" y2="12" /></svg>)
}
export function Headset(p) {
  return (<svg {...base(p)}><path d="M4 13a8 8 0 0 1 16 0" /><rect x="2" y="13" width="4" height="7" rx="1.5" /><rect x="18" y="13" width="4" height="7" rx="1.5" /><path d="M20 18v1a3 3 0 0 1-3 3h-3" /></svg>)
}
export function Settings(p) {
  return (<svg {...base(p)}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>)
}
export function Leaf(p) {
  return (<svg {...base(p)}><path d="M11 20A7 7 0 0 1 4 13c0-6 7-9 16-9 0 9-3 16-9 16z" /><path d="M4 20c4-4 7-6 11-7" /></svg>)
}
export function Sprout(p) {
  return (<svg {...base(p)}><path d="M12 20v-8" /><path d="M12 12C12 8 9 6 5 6c0 4 3 6 7 6z" /><path d="M12 14c0-3 3-5 7-5 0 3-3 5-7 5z" /></svg>)
}
export function Gem(p) {
  return (<svg {...base(p)}><path d="M6 3h12l4 6-10 12L2 9z" /><path d="M2 9h20" /><path d="M12 21 8 9l2-6M12 21l4-12-2-6" /></svg>)
}
export function TrendingUp(p) {
  return (<svg {...base(p)}><polyline points="3 17 9 11 13 15 21 7" /><polyline points="15 7 21 7 21 13" /></svg>)
}
export function History(p) {
  return (<svg {...base(p)}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><polyline points="3 3 3 8 8 8" /><polyline points="12 8 12 12 15 14" /></svg>)
}
export function LogOut(p) {
  return (<svg {...base(p)}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>)
}
export function User(p) {
  return (<svg {...base(p)}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>)
}
export function Send(p) {
  return (<svg {...base(p)}><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>)
}
export function Bell(p) {
  return (<svg {...base(p)}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>)
}

/* ───────────────────────── Métadonnées domaines ───────────────────────── */

export const DOMAIN_META = {
  marketing:     { label: 'Marketing', color: '#C17A3B', Icon: Megaphone },
  vente:         { label: 'Ventes',    color: '#2D5A27', Icon: Briefcase },
  admin_finance: { label: 'Finance',   color: '#1E40AF', Icon: BarChart },
  support:       { label: 'Support',   color: '#7C3AED', Icon: Headset },
  autre:         { label: 'Autre',     color: '#6B7280', Icon: Settings },
}

export function DomainGlyph({ domaine, className = 'w-5 h-5' }) {
  const meta = DOMAIN_META[domaine] || DOMAIN_META.autre
  const Icon = meta.Icon
  return <Icon className={className} />
}

/* ───────────────────────── Métadonnées outils ───────────────────────── */

export const TOOL_META = {
  publication_reseaux_sociaux: Megaphone,
  analyse_sentiment_facebook:  MessageCircle,
  envoi_email:                 Mail,
  recherche_crm:               Users,
  recherche_web:               Search,
  generation_devis:            FileText,
  generation_facture:          Receipt,
  suivi_paiement:              CreditCard,
  planification_calendrier:    Calendar,
  analyse_donnees_ventes:      BarChart,
  redaction_contenu:           Pencil,
}

export function ToolGlyph({ tool, className = 'w-5 h-5' }) {
  const Icon = TOOL_META[tool] || Settings
  return <Icon className={className} />
}

/* ───────────────────────── Métadonnées statuts ───────────────────────── */

export const STATUS_META = {
  succes:  { label: 'Succès',  color: '#16a34a', Icon: Check },
  echec:   { label: 'Échec',   color: '#dc2626', Icon: X },
  partiel: { label: 'Partiel', color: '#d97706', Icon: Minus },
}

export function StatusGlyph({ statut, className = 'w-4 h-4' }) {
  const meta = STATUS_META[statut] || STATUS_META.partiel
  const Icon = meta.Icon
  return <Icon className={className} />
}
