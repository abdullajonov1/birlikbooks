import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BookCard } from '../components/BookCard'
import { MenuSelect } from '../components/MenuSelect'
import { useBooks } from '../context/BooksContext'
import { useI18n } from '../context/LanguageContext'
import { categoryName } from '../labels'
import { CATEGORIES, offerPrice } from '../types'

type Sort = 'new' | 'cheap' | 'rich'
type PriceBand = 'all' | 'low' | 'mid' | 'high'

export function Catalog() {
  const { t } = useI18n()
  const { books, loading, error, reload } = useBooks()
  const [params, setParams] = useSearchParams()
  const category = params.get('tur') || 'all'
  const query = params.get('q') || ''
  const [sort, setSort] = useState<Sort>('new')
  const [price, setPrice] = useState<PriceBand>('all')
  const [stack, setStack] = useState<'' | 'side' | 'below'>('')
  const barRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const bar = barRef.current
    if (!bar) return
    const fit = () => {
      delete bar.dataset.stack
      const chips = bar.querySelector<HTMLElement>('.chips')
      const side = bar.querySelector<HTMLElement>('.toolbar-side')
      if (!chips || !side) return
      const styles = getComputedStyle(bar)
      const available = bar.clientWidth - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight)
      const chipButton = chips.querySelector('button')
      if (chipButton) bar.style.setProperty('--chip-h', `${Math.round(chipButton.getBoundingClientRect().height)}px`)
      let next: '' | 'side' | 'below' = ''
      if (chips.scrollWidth + 14 + side.scrollWidth > available + 1) {
        bar.dataset.stack = 'side'
        const selects = [...side.querySelectorAll<HTMLElement>('.menu-select-btn')]
        const widest = selects.reduce((max, button) => Math.max(max, button.getBoundingClientRect().width), 0)
        bar.style.setProperty('--sel', `${Math.ceil(widest)}px`)
        const beside = chips.getBoundingClientRect().width + 14 + side.getBoundingClientRect().width
        next = beside > available + 1 ? 'below' : 'side'
      }
      if (next) bar.dataset.stack = next
      else delete bar.dataset.stack
      setStack((current) => (current === next ? current : next))
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(bar)
    return () => observer.disconnect()
  }, [t])

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const filtered = books.filter((book) => {
      const inCategory = category === 'all' || book.category === category
      const amount = offerPrice(book)
      const inPrice = price === 'all' || (price === 'low' && amount < 40000) || (price === 'mid' && amount >= 40000 && amount <= 60000) || (price === 'high' && amount > 60000)
      const blob = [...Object.values(book.title), ...Object.values(book.author)].join(' ').toLowerCase()
      return inCategory && inPrice && (!needle || blob.includes(needle))
    })
    return filtered.sort((a, b) => {
      if (sort === 'cheap') return offerPrice(a) - offerPrice(b)
      if (sort === 'rich') return offerPrice(b) - offerPrice(a)
      return b.createdAt - a.createdAt
    })
  }, [books, category, query, sort, price])

  function choose(next: string) {
    const nextParams: Record<string, string> = {}
    if (query) nextParams.q = query
    if (next !== 'all') nextParams.tur = next
    setParams(nextParams)
  }

  return (
    <main className="wrap page">
      <div className="section-head">
        <h1>{t.catalogTitle}</h1>
      </div>
      <div className="toolbar" ref={barRef} data-stack={stack || undefined}>
        <div className="chips">
          <button type="button" className={category === 'all' ? 'on' : ''} onClick={() => choose('all')}>
            {t.all}
          </button>
          {CATEGORIES.map((item) => (
            <button key={item} type="button" className={category === item ? 'on' : ''} onClick={() => choose(item)}>
              {categoryName(t, item)}
            </button>
          ))}
        </div>
        <div className="toolbar-side">
          <MenuSelect
            label={t.priceAll}
            value={price}
            options={[
              { value: 'all', label: t.priceAll },
              { value: 'low', label: t.priceLow },
              { value: 'mid', label: t.priceMid },
              { value: 'high', label: t.priceHigh },
            ]}
            onChange={(value) => setPrice(value as PriceBand)}
          />
          <MenuSelect
            label={t.sortNew}
            value={sort}
            options={[
              { value: 'new', label: t.sortNew },
              { value: 'cheap', label: t.sortCheap },
              { value: 'rich', label: t.sortRich },
            ]}
            onChange={(value) => setSort(value as Sort)}
          />
        </div>
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
      ) : visible.length === 0 ? (
        <p className="muted">{t.noResults}</p>
      ) : (
        <>
          <p className="muted count-line">{t.found.replace('{n}', String(visible.length))}</p>
          <div className="book-grid">
            {visible.map((book, index) => (
              <BookCard key={book.id} book={book} index={index} />
            ))}
          </div>
        </>
      )}
    </main>
  )
}
