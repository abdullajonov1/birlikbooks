import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { BookCard } from '../components/BookCard'
import { BookCover } from '../components/BookCover'
import { useBooks } from '../context/BooksContext'
import { useI18n } from '../context/LanguageContext'
import { categoryName } from '../labels'
import { CATEGORIES } from '../types'

const sections = ['fiction', 'children', 'study', 'business', 'psychology'] as const
const ease = [0.22, 1, 0.36, 1] as const

export function Home() {
  const { t, lang } = useI18n()
  const { books, loading, error, reload } = useBooks()
  const featured = books.filter((book) => book.featured).slice(0, 4)
  const stage = (featured.length ? featured : books).slice(0, 3)
  const words = t.heroTitle.split(' ')

  return (
    <main>
      <section className="hero-band">
        <div className="wrap hero">
          <div className="hero-copy">
            <motion.p className="eyebrow" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <span />
              {t.heroEyebrow}
            </motion.p>
            <h1>
              {words.map((word, index) => (
                <motion.span key={`${word}-${index}`} initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 + index * 0.05, duration: 0.55, ease }}>
                  {word}{' '}
                </motion.span>
              ))}
            </h1>
            <motion.p className="lead" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42 }}>
              {t.heroLead}
            </motion.p>
            <motion.div className="actions" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.52 }}>
              <Link className="btn btn-light" to="/katalog">
                {t.heroCatalog}
              </Link>
              <a className="btn btn-ghost" href="#qadam">
                {t.heroOrder}
              </a>
            </motion.div>
            <motion.dl className="facts" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}>
              <div>
                <dt>{t.catalogTitle}</dt>
                <dd>{loading ? '—' : books.length}</dd>
              </div>
              <div>
                <dt>{t.footerHours}</dt>
                <dd>09–22</dd>
              </div>
              <div>
                <dt>{t.footerPlace}</dt>
                <dd>{t.footerCity}</dd>
              </div>
            </motion.dl>
          </div>
          <div className="scene" aria-hidden={stage.length === 0}>
            <div className="scene-glow" />
            {stage.map((book, index) => (
              <Link key={book.id} to={`/kitob/${book.id}`} className={`scene-book s${index + 1}`}>
                <span className="drift">
                  <BookCover book={book} lang={lang} />
                </span>
              </Link>
            ))}
            <div className="scene-floor" />
          </div>
        </div>
      </section>

      <div className="marquee" aria-hidden="true">
        <div>
          {[0, 1].map((copy) => (
            <p key={copy}>
              {CATEGORIES.map((category) => (
                <span key={`${copy}-${category}`}>{categoryName(t, category)}</span>
              ))}
            </p>
          ))}
        </div>
      </div>

      <section className="wrap block">
        <div className="section-head">
          <h2>{t.featuredTitle}</h2>
          <p>{t.featuredLead}</p>
        </div>
        {error ? (
          <div className="notice">
            <p>{t.error}</p>
            <button type="button" onClick={reload}>
              {t.retry}
            </button>
          </div>
        ) : loading ? (
          <p className="muted">{t.loading}</p>
        ) : (
          <div className="book-grid">
            {featured.map((book, index) => (
              <BookCard key={book.id} book={book} index={index} />
            ))}
          </div>
        )}
      </section>

      <section className="wrap block">
        <div className="section-head">
          <h2>{t.catsTitle}</h2>
          <p>{t.catsLead}</p>
        </div>
        <div className="index">
          {sections.map((category, index) => (
            <motion.div key={category} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.04 }}>
              <Link to={`/katalog?tur=${category}`}>
                <span>0{index + 1}</span>
                <strong>{categoryName(t, category)}</strong>
                <em aria-hidden="true">→</em>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="wrap block" id="qadam">
        <div className="section-head">
          <h2>{t.stepsTitle}</h2>
        </div>
        <div className="steps">
          {[
            [t.step1t, t.step1d],
            [t.step2t, t.step2d],
            [t.step3t, t.step3d],
          ].map(([title, text], index) => (
            <article key={title}>
              <span>0{index + 1}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="wrap block why">
        <h2>{t.whyTitle}</h2>
        <div>
          {[
            [t.why1t, t.why1d],
            [t.why2t, t.why2d],
            [t.why3t, t.why3d],
          ].map(([title, text], index) => (
            <article key={title}>
              <span>0{index + 1}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
