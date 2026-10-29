import { motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, api } from '../api'
import { BookCover } from '../components/BookCover'
import { useBooks } from '../context/BooksContext'
import { useCart } from '../context/CartContext'
import { useI18n } from '../context/LanguageContext'
import { formatPrice } from '../format'
import { regionLabel } from '../regions'
import { offerPrice, pick } from '../types'

export function Checkout() {
  const { t, lang } = useI18n()
  const { items, clear } = useCart()
  const { books, reload } = useBooks()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [orderId, setOrderId] = useState('')

  const lines = useMemo(
    () => items.map((item) => ({ item, book: books.find((book) => book.id === item.bookId) })).filter((line) => line.book),
    [items, books],
  )
  const total = lines.reduce((sum, line) => sum + line.book!.price * line.item.qty, 0)

  useEffect(() => {
    api<{ user: { firstName: string; lastName: string; phone: string; region: string; district: string; street: string; house: string; apartment: string; entrance: string; landmark: string } | null }>('/api/cabinet/me')
      .then((data) => {
        const user = data.user
        if (!user) return
        const full = [user.firstName, user.lastName].filter(Boolean).join(' ')
        const place = [regionLabel(user.region, lang), user.district, user.street, user.house, user.apartment, user.entrance, user.landmark].filter(Boolean).join(', ')
        if (full) setName((current) => current || full)
        if (user.phone) setPhone((current) => current || user.phone)
        if (place) setAddress((current) => current || place)
      })
      .catch(() => {})
  }, [lang])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    if (name.trim().length < 2 || address.trim().length < 4) {
      setError(t.required)
      return
    }
    if (phone.replace(/\D/g, '').length < 7) {
      setError(t.badPhone)
      return
    }
    setPending(true)
    try {
      const result = await api<{ id: string }>('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          name,
          phone,
          address,
          note,
          lang,
          items: lines.map((line) => ({ bookId: line.item.bookId, qty: line.item.qty })),
        }),
      })
      setOrderId(result.id)
      clear()
      reload()
    } catch (reason) {
      setError(reason instanceof ApiError && reason.code === 'out_of_stock' ? t.outOfStock : t.error)
    } finally {
      setPending(false)
    }
  }

  if (orderId) {
    return (
      <main className="wrap page success">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 18 }}>
          <span className="check">✓</span>
          <h1>{t.orderSuccess}</h1>
          <p>{t.orderSuccessLead}</p>
          <p className="order-id">
            {t.orderId}
            <strong>{orderId}</strong>
          </p>
          <div className="actions">
            <Link className="btn" to="/buyurtmalarim">
              {t.cabinetTitle}
            </Link>
            <Link className="back" to="/katalog">
              {t.continueShop}
            </Link>
          </div>
        </motion.div>
      </main>
    )
  }

  if (lines.length === 0) {
    return (
      <main className="wrap page">
        <h1>{t.orderTitle}</h1>
        <p>{t.cartEmpty}</p>
        <Link className="btn btn-primary" to="/katalog">
          {t.cartGo}
        </Link>
      </main>
    )
  }

  return (
    <main className="wrap page">
      <div className="section-head">
        <h1>{t.orderTitle}</h1>
        <p>{t.orderLead}</p>
      </div>
      <div className="checkout">
        <form onSubmit={submit}>
          <div className="field-row">
            <label>
              {t.name}
              <input type="text" name="name" autoComplete="name" placeholder={t.namePh} value={name} onChange={(event) => setName(event.target.value)} required />
            </label>
            <label>
              {t.phone}
              <input type="tel" name="tel" autoComplete="tel" inputMode="tel" placeholder={t.phonePh} value={phone} onChange={(event) => setPhone(event.target.value)} required />
            </label>
          </div>
          <label>
            {t.address}
            <input type="text" name="street-address" autoComplete="street-address" placeholder={t.addressPh} value={address} onChange={(event) => setAddress(event.target.value)} required />
          </label>
          <label>
            {t.note}
            <textarea name="note" autoComplete="off" value={note} onChange={(event) => setNote(event.target.value)} placeholder={t.notePh} rows={4} />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <button className="btn btn-primary" type="submit" disabled={pending}>
            {pending ? t.loading : t.placeOrder}
          </button>
        </form>
        <aside>
          <ul>
            {lines.map(({ item, book }) => (
              <li key={item.bookId}>
                <BookCover book={book!} lang={lang} />
                <div>
                  <strong>{pick(book!.title, lang)}</strong>
                  <p>
                    {item.qty} {t.pcs} · {formatPrice(offerPrice(book!) * item.qty, lang, t.currency)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <p className="sum">
            <span>{t.total}</span>
            <strong>{formatPrice(total, lang, t.currency)}</strong>
          </p>
        </aside>
      </div>
    </main>
  )
}
