import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useBooks } from '../context/BooksContext'
import { useCart } from '../context/CartContext'
import { useI18n } from '../context/LanguageContext'
import { useTheme } from '../context/ThemeContext'
import { formatPrice } from '../format'
import { LANGS, offerPrice, pick } from '../types'
import type { Lang } from '../types'
import { BookCover } from './BookCover'
import { ChatWidget } from './ChatWidget'
import { MenuSelect } from './MenuSelect'

const langShort: Record<Lang, string> = {
  uz: 'uz',
  'uz-cyrl': 'kr',
  ru: 'ru',
  en: 'eng',
}

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}

function SocialIcon({ kind }: { kind: 'instagram' | 'telegram' | 'youtube' | 'map' }) {
  if (kind === 'instagram') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="4" width="16" height="16" rx="5" />
        <circle cx="12" cy="12" r="3.4" />
        <circle cx="17.2" cy="6.8" r="0.8" fill="currentColor" stroke="none" />
      </svg>
    )
  }
  if (kind === 'telegram') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M21 4 3 11.2l6.2 2.1L17.5 7.5l-6.4 7.2.2 4.3 3-3.2L18.8 20 21 4z" />
      </svg>
    )
  }
  if (kind === 'youtube') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="6" width="18" height="12" rx="3" />
        <path d="M11 10v4l4-2-4-2z" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11z" />
      <circle cx="12" cy="10" r="2" />
    </svg>
  )
}

const icons = {
  home: 'M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z',
  books: 'M12 7c-1.8-1.5-4-2.1-6.5-2.4v13.2c2.5.3 4.7 1 6.5 2.5 1.8-1.5 4-2.2 6.5-2.5V4.6C16 4.9 13.8 5.5 12 7zM12 7v13.3',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4M2 12h2m16 0h2',
  moon: 'M21 14.5A8.5 8.5 0 1 1 9.5 3a7 7 0 0 0 11.5 11.5z',
  admin: 'M12 3 5 6.5v5.2c0 4 2.7 6.8 7 8.3 4.3-1.5 7-4.3 7-8.3V6.5z',
  bag: 'M6 8h12l-1 12H7zM9 8V7a3 3 0 0 1 6 0v1',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20.5c1.4-3 3.8-4.5 7.5-4.5s6.1 1.5 7.5 4.5',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.2 2.4 3.4 5.5 3.4 9s-1.2 6.6-3.4 9c-2.2-2.4-3.4-5.5-3.4-9s1.2-6.6 3.4-9z',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  menu: 'M4 7h16M4 12h16M4 17h16',
  close: 'M6 6l12 12M18 6 6 18',
}

export function Layout() {
  const { t, lang, setLang } = useI18n()
  const { theme, toggle } = useTheme()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const themeLabel =
    theme === 'dark'
      ? ({ uz: "Yorug' mavzu", 'uz-cyrl': 'Ёруғ мавзу', ru: 'Светлая тема', en: 'Light theme' } as const)[lang]
      : ({ uz: "Qorong'i mavzu", 'uz-cyrl': 'Қоронғи мавзу', ru: 'Тёмная тема', en: 'Dark theme' } as const)[lang]
  const { items, count, open, setOpen, setQty, remove } = useCart()
  const { books } = useBooks()
  const location = useLocation()
  const [stuck, setStuck] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [phone, setPhone] = useState(() => window.matchMedia('(max-width: 650px)').matches)
  const headerRef = useRef<HTMLElement>(null)
  const stuckRef = useRef(false)
  const moreRef = useRef<HTMLDivElement>(null)
  const hamRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    window.scrollTo(0, 0)
    setOpen(false)
    setMenuOpen(false)
    stuckRef.current = false
    setStuck(false)
  }, [location.pathname, setOpen])

  useEffect(() => {
    function onScroll() {
      const y = window.scrollY
      const next = stuckRef.current ? y > 2 : y > 24
      if (next === stuckRef.current) return
      stuckRef.current = next
      setStuck(next)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    function onPointer(event: MouseEvent) {
      const target = event.target
      if (moreRef.current?.contains(target as Node) || hamRef.current?.contains(target as Node)) return
      if (target instanceof Element && target.closest('.menu-select-list')) return
      setMenuOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  useLayoutEffect(() => {
    const header = headerRef.current
    if (!header) return
    function placeEdge() {
      const vw = document.documentElement.clientWidth
      const restW = Math.min(1120, vw - 16)
      header.style.setProperty('--edge', `${(vw - restW) / 2}px`)
      document.documentElement.style.setProperty('--bar-h', `${header.offsetHeight}px`)
    }
    placeEdge()
    const observer = new ResizeObserver(placeEdge)
    observer.observe(header)
    window.addEventListener('resize', placeEdge)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', placeEdge)
    }
  }, [])

  useEffect(() => {
    const query = window.matchMedia('(max-width: 650px)')
    const sync = () => setPhone(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    document.body.style.overflow = menuOpen && phone ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [menuOpen, phone])

  const menuPanel = (
    <div className={menuOpen ? 'tool-fold open' : 'tool-fold'} ref={moreRef} aria-hidden={phone && !menuOpen ? true : undefined}>
      {phone ? (
        <button type="button" className="icon-btn menu-close" onClick={() => setMenuOpen(false)} aria-label={t.menu}>
          <Icon d={icons.close} />
        </button>
      ) : null}
      <MenuSelect
        className="lang-menu"
        menuWidth={88}
        label={t.tagline}
        value={lang}
        options={LANGS.map((code) => ({ value: code, label: langShort[code] }))}
        onChange={(value) => setLang(value as Lang)}
      />
      <button type="button" className="icon-btn" onClick={toggle} aria-label={themeLabel} title={themeLabel}>
        <Icon d={theme === 'dark' ? icons.sun : icons.moon} />
        <span className="tool-label">{themeLabel}</span>
      </button>
      <Link to="/admin" className="icon-btn" aria-label={t.adminTitle} title={t.adminTitle}>
        <Icon d={icons.admin} />
        <span className="tool-label">{t.adminTitle}</span>
      </Link>
    </div>
  )
  const menuScrim = (
    <button type="button" className={menuOpen ? 'menu-scrim show' : 'menu-scrim'} aria-label={t.menu} aria-hidden={menuOpen ? undefined : true} tabIndex={menuOpen ? 0 : -1} onClick={() => setMenuOpen(false)} />
  )

  const lines = items
    .map((item) => ({ item, book: books.find((book) => book.id === item.bookId) }))
    .filter((line) => line.book)
  const total = lines.reduce((sum, line) => sum + offerPrice(line.book!) * line.item.qty, 0)

  return (
    <div className="site">
      <header className={['header', stuck ? 'stuck' : '', menuOpen ? 'menu-open' : ''].filter(Boolean).join(' ')} ref={headerRef}>
        <div className="bar">
          <Link to="/" className="brand" aria-label={t.brand}>
            <img src="/logo.png" alt="Birlik" />
          </Link>
          <div className="head-mid">
            <nav className="nav-links">
              <NavLink to="/" end>
                {t.navHome}
              </NavLink>
              <NavLink to="/katalog">{t.navCatalog}</NavLink>
              <NavLink to="/yetkazish">{t.navDelivery}</NavLink>
            </nav>
            <form
              className="head-search"
              onSubmit={(event: FormEvent) => {
                event.preventDefault()
                const q = search.trim()
                navigate(q ? `/katalog?q=${encodeURIComponent(q)}` : '/katalog')
              }}
            >
              <Icon d={icons.search} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t.searchPlaceholder} aria-label={t.search} />
            </form>
          </div>
          <div className="tools">
            {phone ? null : menuPanel}
            <Link to="/buyurtmalarim" className="icon-btn" aria-label={t.cabinetTitle} title={t.cabinetTitle}>
              <Icon d={icons.user} />
            </Link>
            <button type="button" className="icon-btn cart-btn" onClick={() => setOpen(true)} aria-label={t.navCart} title={t.navCart}>
              <Icon d={icons.bag} />
              {count > 0 ? (
                <motion.span key={count} initial={{ scale: 0.6 }} animate={{ scale: 1 }}>
                  {count}
                </motion.span>
              ) : null}
            </button>
            <button
              type="button"
              className="icon-btn hamburger"
              ref={hamRef}
              aria-label={t.menu}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((openMenu) => !openMenu)}
            >
              <Icon d={menuOpen ? icons.close : icons.menu} />
            </button>
          </div>
        </div>
      </header>
      {phone ? createPortal(<>{menuScrim}{menuPanel}</>, document.body) : null}

      <motion.div className="page" key={location.pathname} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] as const }}>
        <Outlet />
      </motion.div>

      <footer className="footer">
        <div className="wrap foot">
          <img src="/logo.png" alt="" />
          <div className="foot-facts">
            <div className="foot-hours">
              <p>{t.footerHours}</p>
              <strong>{t.footerHoursValue}</strong>
            </div>
            <div>
              <p>{t.footerPlace}</p>
              <strong>{t.footerPlaceValue}</strong>
              <span className="landmark">{t.footerLandmark}</span>
              <a className="foot-phone" href="tel:+998900630040">
                {t.footerPhone}
              </a>
            </div>
          </div>
          <div className="foot-side">
            <nav className="foot-links">
              <Link to="/yetkazish">{t.navDelivery}</Link>
              <Link to="/buyurtmalarim">{t.cabinetTitle}</Link>
              <Link to="/katalog">{t.navCatalog}</Link>
            </nav>
            <div className="foot-social">
              <a className="icon-btn" href="https://www.instagram.com/birlikbooks/" target="_blank" rel="noreferrer" aria-label="Instagram" title="Instagram">
                <SocialIcon kind="instagram" />
              </a>
              <a className="icon-btn" href="https://t.me/birlikbooks" target="_blank" rel="noreferrer" aria-label="Telegram" title="Telegram">
                <SocialIcon kind="telegram" />
              </a>
              <a className="icon-btn" href="https://www.youtube.com/@Birlikbooks" target="_blank" rel="noreferrer" aria-label="YouTube" title="YouTube">
                <SocialIcon kind="youtube" />
              </a>
              <a className="icon-btn" href="https://maps.app.goo.gl/z21heNkpVpgwm6e18" target="_blank" rel="noreferrer" aria-label={t.footerMap} title={t.footerMap}>
                <SocialIcon kind="map" />
              </a>
            </div>
          </div>
          <p className="foot-note">{t.footerNote}</p>
        </div>
        <p className="rights">{t.rights}</p>
      </footer>

      <AnimatePresence>
        {open ? (
          <>
            <motion.button type="button" className="overlay" aria-label={t.close} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
            <motion.aside className="drawer" initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 40, opacity: 0 }} transition={{ type: 'spring', stiffness: 320, damping: 32 }}>
              <header>
                <h2>{t.cartTitle}</h2>
                <button type="button" onClick={() => setOpen(false)} aria-label={t.close}>
                  ×
                </button>
              </header>
              {lines.length === 0 ? (
                <div className="drawer-empty">
                  <p>{t.cartEmpty}</p>
                  <Link to="/katalog" onClick={() => setOpen(false)}>
                    {t.cartGo}
                  </Link>
                </div>
              ) : (
                <>
                  <ul>
                    {lines.map(({ item, book }) => (
                      <li key={item.bookId}>
                        <BookCover book={book!} lang={lang} />
                        <div>
                          <strong>{pick(book!.title, lang)}</strong>
                          <p>{formatPrice(offerPrice(book!), lang, t.currency)}</p>
                          <div className="stepper">
                            <button type="button" onClick={() => setQty(item.bookId, item.qty - 1)} aria-label="-">
                              −
                            </button>
                            <span>{item.qty}</span>
                            <button type="button" onClick={() => setQty(item.bookId, item.qty + 1)} aria-label="+">
                              +
                            </button>
                          </div>
                        </div>
                        <button type="button" className="text-btn" onClick={() => remove(item.bookId)}>
                          {t.remove}
                        </button>
                      </li>
                    ))}
                  </ul>
                  <footer>
                    <div>
                      <span>{t.total}</span>
                      <strong>{formatPrice(total, lang, t.currency)}</strong>
                    </div>
                    <Link to="/buyurtma" className="btn btn-primary" onClick={() => setOpen(false)}>
                      {t.checkout}
                    </Link>
                  </footer>
                </>
              )}
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
      <ChatWidget />
    </div>
  )
}
