import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { MenuSelect } from '../components/MenuSelect'
import { useI18n } from '../context/LanguageContext'
import { formatPrice } from '../format'
import { REGIONS, regionLabel } from '../regions'
import { pick } from '../types'
import type { Localized, OrderStatus } from '../types'

type Profile = {
  firstName: string
  lastName: string
  username?: string
  photo?: string
  phone: string
  extraPhone: string
  email: string
  region: string
  district: string
  street: string
  house: string
  apartment: string
  entrance: string
  landmark: string
}

type Tracked = {
  id: string
  createdAt: number
  status: OrderStatus
  total: number
  items: { qty: number; title: Localized }[]
}

type Cabinet = { user: Profile | null; orders: Tracked[]; pending?: boolean }

type TelegramUser = {
  id: number
  first_name?: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: number
  hash: string
}

declare global {
  interface Window {
    Telegram?: {
      Login: {
        auth: (options: { bot_id: string; request_access?: boolean }, callback: (data: TelegramUser | false) => void) => void
      }
    }
  }
}

function loadTelegramWidget() {
  if (window.Telegram?.Login) return Promise.resolve()
  return new Promise<void>((resolve, reject) => {
    const found = document.querySelector('script[data-telegram-widget]')
    if (found) {
      found.addEventListener('load', () => resolve(), { once: true })
      found.addEventListener('error', () => reject(new Error('telegram')), { once: true })
      return
    }
    const script = document.createElement('script')
    script.src = 'https://telegram.org/js/telegram-widget.js?22'
    script.async = true
    script.dataset.telegramWidget = '1'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('telegram'))
    document.head.appendChild(script)
  })
}

const emptyProfile: Profile = {
  firstName: '',
  lastName: '',
  phone: '',
  extraPhone: '',
  email: '',
  region: '',
  district: '',
  street: '',
  house: '',
  apartment: '',
  entrance: '',
  landmark: '',
}

function StatusRail({ status, labels }: { status: OrderStatus; labels: [string, string, string] }) {
  if (status === 'cancelled') return null
  const step = status === 'new' ? 1 : status === 'confirmed' ? 2 : 3
  return (
    <div className="status-rail" aria-hidden="true">
      {labels.map((label, index) => (
        <span key={label} className={index < step ? 'on' : ''}>
          {label}
        </span>
      ))}
    </div>
  )
}

export function Orders() {
  const { t, lang } = useI18n()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [form, setForm] = useState<Profile>(emptyProfile)
  const [orders, setOrders] = useState<Tracked[]>([])
  const [waiting, setWaiting] = useState(false)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [ready, setReady] = useState(false)

  const statusLabel: Record<OrderStatus, string> = {
    new: t.statusNew,
    confirmed: t.statusOk,
    delivered: t.statusDone,
    cancelled: t.statusCancel,
  }

  function apply(data: Cabinet) {
    setProfile(data.user)
    setOrders(data.orders || [])
    if (data.user) setForm(data.user)
  }

  useEffect(() => {
    api<Cabinet>('/api/cabinet/me')
      .then((data) => {
        apply(data)
        setReady(true)
      })
      .catch(() => setReady(true))
  }, [])

  useEffect(() => {
    function refresh() {
      if (document.visibilityState === 'hidden') return
      api<Cabinet>('/api/cabinet/me')
        .then((data) => {
          if (data.user) apply(data)
        })
        .catch(() => {})
    }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])

  function patch<K extends keyof Profile>(key: K, value: Profile[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function startLogin() {
    setError('')
    setNote('')
    setWaiting(true)
    try {
      const { botId } = await api<{ botId: string }>('/api/cabinet/widget')
      await loadTelegramWidget()
      const auth = await new Promise<TelegramUser | false>((resolve) => {
        window.Telegram?.Login.auth({ bot_id: botId, request_access: true }, (data) => resolve(data))
      })
      if (!auth) return
      const result = await api<Cabinet>('/api/cabinet/telegram', { method: 'POST', body: JSON.stringify(auth) })
      apply(result)
    } catch {
      setError(t.error)
    } finally {
      setWaiting(false)
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    setError('')
    setNote('')
    try {
      const data = await api<Cabinet>('/api/cabinet/profile', { method: 'PUT', body: JSON.stringify(form) })
      apply(data)
      setNote(t.saved)
    } catch {
      setError(t.required)
    }
  }

  async function logout() {
    await api('/api/cabinet/logout', { method: 'POST' })
    setProfile(null)
    setOrders([])
    setForm(emptyProfile)
    setNote('')
  }

  if (!ready) {
    return (
      <main className="wrap page">
        <p className="muted">{t.loading}</p>
      </main>
    )
  }

  if (!profile) {
    return (
      <main className="wrap page">
        <section className="cabinet-gate">
          <h1>{t.cabinetTitle}</h1>
          <p>{t.cabinetLead}</p>
          <button type="button" className="tg-login" onClick={() => void startLogin()} disabled={waiting}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M21 4 3 11.2l6.2 2.1L17.5 7.5l-6.4 7.2.2 4.3 3-3.2L18.8 20 21 4z" />
            </svg>
            {t.cabinetTelegram}
          </button>
          {error ? <p className="form-error">{error}</p> : null}
        </section>
      </main>
    )
  }

  const displayName = [form.firstName, form.lastName].filter(Boolean).join(' ') || form.firstName

  return (
    <main className="wrap page cabinet-page">
      <header className="cabinet-user">
        {form.photo ? <img src={form.photo} alt="" /> : <span>{(form.firstName || 'B').slice(0, 1).toLocaleUpperCase('uz-Latn')}</span>}
        <div>
          <strong>{displayName}</strong>
          {form.username ? <p>@{form.username}</p> : null}
        </div>
        <button type="button" onClick={() => void logout()}>
          {t.logout}
        </button>
      </header>
      {!form.phone ? (
        <aside className="phone-warn">
          <strong>{t.phoneMissing}</strong>
          <p>{t.phoneMissingLead}</p>
          <a href="https://t.me/birlikbook_bot" target="_blank" rel="noreferrer">
            @birlikbook_bot
          </a>
        </aside>
      ) : null}
      <form className="profile-form" onSubmit={(event) => void save(event)}>
        <h2>{t.profileTitle}</h2>
        <div className="field-row">
          <label>
            {t.name}
            <input type="text" name="given-name" autoComplete="given-name" value={form.firstName} onChange={(event) => patch('firstName', event.target.value)} required />
          </label>
          <label>
            {t.lastName}
            <input type="text" name="family-name" autoComplete="family-name" value={form.lastName} onChange={(event) => patch('lastName', event.target.value)} />
          </label>
        </div>
        <div className="field-row">
          <label>
            {t.phone}
            <input type="tel" value={form.phone || t.phoneBot} disabled />
          </label>
          <label>
            {t.phoneExtra}
            <input type="tel" name="tel" autoComplete="tel" inputMode="tel" placeholder={t.phonePh} value={form.extraPhone} onChange={(event) => patch('extraPhone', event.target.value)} />
          </label>
        </div>
        <label>
          {t.emailOptional}
          <input type="email" name="email" autoComplete="email" placeholder={t.emailPh} value={form.email} onChange={(event) => patch('email', event.target.value)} />
        </label>
        <h2>{t.addressTitle}</h2>
        <div className="field-row">
          <label>
            {t.region}
            <MenuSelect
              label={t.region}
              value={form.region}
              options={[{ value: '', label: t.regionPick }, ...REGIONS.map((item) => ({ value: item.id, label: regionLabel(item.id, lang) }))]}
              onChange={(value) => patch('region', value)}
            />
          </label>
          <label>
            {t.district}
            <input type="text" placeholder={t.districtPh} value={form.district} onChange={(event) => patch('district', event.target.value)} />
          </label>
        </div>
        <label>
          {t.street}
          <input type="text" autoComplete="address-line1" placeholder={t.streetPh} value={form.street} onChange={(event) => patch('street', event.target.value)} />
        </label>
        <div className="field-row cols-3">
          <label>
            {t.house}
            <input type="text" inputMode="numeric" autoComplete="off" value={form.house} onChange={(event) => patch('house', event.target.value)} />
          </label>
          <label>
            {t.apartment}
            <input type="text" inputMode="numeric" autoComplete="off" value={form.apartment} onChange={(event) => patch('apartment', event.target.value)} />
          </label>
          <label>
            {t.entrance}
            <input type="text" inputMode="numeric" autoComplete="off" value={form.entrance} onChange={(event) => patch('entrance', event.target.value)} />
          </label>
        </div>
        <p className="hint">{t.floorHint}</p>
        <label>
          {t.landmark}
          <input type="text" placeholder={t.landmarkPh} value={form.landmark} onChange={(event) => patch('landmark', event.target.value)} />
        </label>
        {error ? <p className="form-error">{error}</p> : null}
        {note ? <p className="ok">{note}</p> : null}
        <button className="btn btn-primary" type="submit">
          {t.save}
        </button>
      </form>
      <section className="mine-list">
        <h2>{t.cabinetOrders}</h2>
        {orders.length === 0 ? (
          <article className="orders-empty">
            <p>{t.cabinetEmpty}</p>
            <Link className="btn btn-quiet" to="/katalog">
              {t.openCatalog}
            </Link>
          </article>
        ) : null}
        {orders.map((order) => (
          <article key={order.id} className="mine-card">
            {order.status === 'cancelled' ? <p className="kicker danger">{statusLabel[order.status]}</p> : null}
            <h3>{order.items.map((item) => pick(item.title, lang)).join(', ')}</h3>
            <StatusRail status={order.status} labels={[t.statusNew, t.statusOk, t.statusDone]} />
            <p className="muted">
              {t.trackWhen}: {new Date(order.createdAt).toLocaleString(lang === 'en' ? 'en' : 'uz')}
            </p>
            <strong>{formatPrice(order.total, lang, t.currency)}</strong>
          </article>
        ))}
        <p className="hint">{t.ordersHint}</p>
      </section>
    </main>
  )
}
