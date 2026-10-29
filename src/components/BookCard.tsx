import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { useI18n } from '../context/LanguageContext'
import { formatPrice } from '../format'
import { categoryName } from '../labels'
import { offerPrice, pick } from '../types'
import type { Book } from '../types'
import { BookCover } from './BookCover'

export function BookCard({ book, index = 0 }: { book: Book; index?: number }) {
  const { t, lang } = useI18n()
  const { add, items } = useCart()
  const inCart = items.some((item) => item.bookId === book.id)
  const title = pick(book.title, lang)

  return (
    <motion.article
      className="book-card"
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.6, delay: Math.min(index, 8) * 0.06, ease: [0.22, 1, 0.36, 1] as const }}
    >
      <Link to={`/kitob/${book.id}`} className="stand" aria-label={title}>
        <BookCover book={book} lang={lang} />
      </Link>
      <div className="ledge" aria-hidden="true" />
      <div className="book-meta">
        <p className="kicker">{categoryName(t, book.category)}</p>
        <h3>
          <Link to={`/kitob/${book.id}`}>{title}</Link>
        </h3>
        <p className="author">{pick(book.author, lang)}</p>
        <p className="card-stars" aria-hidden={book.ratingCount ? undefined : true} aria-label={book.ratingCount ? `${book.rating}` : undefined}>
          {book.ratingCount ? (
            <>
              {'★'.repeat(Math.round(book.rating || 0))}
              {'☆'.repeat(5 - Math.round(book.rating || 0))}
              <span>{book.rating?.toFixed(1)}</span>
            </>
          ) : null}
        </p>
        <div className="book-row">
          {offerPrice(book) < book.price ? (
            <span className="price-pair">
              <s>{formatPrice(book.price, lang, t.currency)}</s>
              <strong>{formatPrice(offerPrice(book), lang, t.currency)}</strong>
            </span>
          ) : (
            <strong>{formatPrice(book.price, lang, t.currency)}</strong>
          )}
          <button type="button" disabled={book.stock < 1} onClick={() => add(book.id)}>
            {book.stock < 1 ? t.out : inCart ? t.added : t.add}
          </button>
        </div>
      </div>
    </motion.article>
  )
}