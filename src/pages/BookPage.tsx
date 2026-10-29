import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import { BookCard } from '../components/BookCard'
import { BookCover } from '../components/BookCover'
import { useBooks } from '../context/BooksContext'
import { useCart } from '../context/CartContext'
import { useI18n } from '../context/LanguageContext'
import { formatPrice } from '../format'
import { categoryName } from '../labels'
import { offerPrice, pick } from '../types'

type Review = { id: string; name: string; text: string; stars: number; createdAt: number }

function Stars({ value, onPick, label }: { value: number; onPick?: (value: number) => void; label: string }) {
  return (
    <span className="stars" role={onPick ? 'radiogroup' : 'img'} aria-label={label}>
      {[1, 2, 3, 4, 5].map((star) =>
        onPick ? (
          <button key={star} type="button" className={star <= value ? 'on' : ''} aria-label={`${star}`} onClick={() => onPick(star)}>
            ★
          </button>
        ) : (
          <i key={star} className={star <= value ? 'on' : ''}>
            ★
          </i>
        ),
      )}
    </span>
  )
}

export function BookPage() {
  const { id } = useParams()
  const { t, lang } = useI18n()
  const { books, loading, reload } = useBooks()
  const { add, setOpen } = useCart()
  const [qty, setQty] = useState(1)
  const [reviews, setReviews] = useState<Review[]>([])
  const [name, setName] = useState('')
  const [text, setText] = useState('')
  const [stars, setStars] = useState(0)
  const [reviewNote, setReviewNote] = useState('')
  const book = books.find((item) => item.id === id)
  const average = reviews.length ? reviews.reduce((sum, review) => sum + review.stars, 0) / reviews.length : 0

  useEffect(() => {
    if (!id) return
    api<Review[]>(`/api/books/${id}/reviews`)
      .then(setReviews)
      .catch(() => setReviews([]))
  }, [id])

  async function sendReview(event: FormEvent) {
    event.preventDefault()
    if (!id || name.trim().length < 2 || text.trim().length < 4 || stars < 1) {
      setReviewNote(t.reviewNeed)
      return
    }
    try {
      const saved = await api<Review>(`/api/books/${id}/reviews`, {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), text: text.trim(), stars }),
      })
      setReviews((current) => [saved, ...current])
      setName('')
      setText('')
      setStars(0)
      setReviewNote(t.reviewThanks)
      reload()
    } catch {
      setReviewNote(t.error)
    }
  }
  const related = books.filter((item) => book && item.category === book.category && item.id !== book.id).slice(0, 3)

  if (loading) return <main className="wrap page"><p className="muted">{t.loading}</p></main>
  if (!book) {
    return (
      <main className="wrap page">
        <p>{t.empty}</p>
        <Link to="/katalog">{t.back}</Link>
      </main>
    )
  }

  return (
    <main className="wrap page">
      <Link className="back" to="/katalog">
        {t.back}
      </Link>
      <section className="detail">
        <BookCover book={book} lang={lang} className="detail-cover" />
        <div>
          <p className="kicker">{categoryName(t, book.category)}</p>
          <h1>{pick(book.title, lang)}</h1>
          <p className="author">{pick(book.author, lang)}</p>
          {reviews.length > 0 ? <Stars value={Math.round(average)} label={`${average.toFixed(1)}`} /> : null}
          <p className="price">
            {offerPrice(book) < book.price ? (
              <span className="price-pair">
                <s>{formatPrice(book.price, lang, t.currency)}</s>
                <strong>{formatPrice(offerPrice(book), lang, t.currency)}</strong>
              </span>
            ) : (
              formatPrice(book.price, lang, t.currency)
            )}
          </p>
          <p className="stock">{book.stock > 0 ? `${t.inStock}: ${book.stock}` : t.out}</p>
          <p className="about">{t.aboutBook}</p>
          <p className="desc">{pick(book.description, lang)}</p>
          <div className="buy-row">
            <div className="stepper">
              <button type="button" onClick={() => setQty((value) => Math.max(1, value - 1))} aria-label="-">
                −
              </button>
              <span>{qty}</span>
              <button type="button" onClick={() => setQty((value) => Math.min(book.stock || 1, value + 1))} aria-label="+">
                +
              </button>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              disabled={book.stock < 1}
              onClick={() => {
                add(book.id, qty)
                setOpen(true)
              }}
            >
              {book.stock < 1 ? t.out : t.add}
            </button>
          </div>
        </div>
      </section>
      <section className="reviews">
        <h2>{t.reviewsTitle}</h2>
        <form onSubmit={(event) => void sendReview(event)}>
          <Stars value={stars} onPick={setStars} label={t.reviewStars} />
          <label>
            {t.name}
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label>
            {t.reviewPh}
            <textarea rows={3} value={text} onChange={(event) => setText(event.target.value)} />
          </label>
          {reviewNote ? <p className="muted">{reviewNote}</p> : null}
          <button className="btn" type="submit">
            {t.reviewSend}
          </button>
        </form>
        {reviews.length === 0 ? <p className="muted">{t.reviewEmpty}</p> : null}
        <div className="review-list">
          {reviews.map((review) => (
            <article key={review.id}>
              <div>
                <strong>{review.name}</strong>
                <Stars value={review.stars} label={t.reviewStars} />
              </div>
              <p>{review.text}</p>
            </article>
          ))}
        </div>
      </section>
      {related.length > 0 ? (
        <section className="block">
          <div className="section-head">
            <h2>{t.related}</h2>
          </div>
          <div className="book-grid">
            {related.map((item, index) => (
              <BookCard key={item.id} book={item} index={index} />
            ))}
          </div>
        </section>
      ) : null}
    </main>
  )
}
