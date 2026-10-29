import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { MenuSelect } from '../components/MenuSelect'
import { useBooks } from '../context/BooksContext'
import { useI18n } from '../context/LanguageContext'
import { formatPrice, formatWhen } from '../format'
import { categoryName } from '../labels'
import { CATEGORIES, LANGS, emptyText, offerPrice, pick } from '../types'
import type { Book, Category, Chat, Lang, Localized, Order, OrderStatus } from '../types'

const fieldLangName: Record<Lang, string> = {
  uz: "O‘zbekcha",
  'uz-cyrl': 'Ўзбекча',
  ru: 'Русский',
  en: 'English',
}

type Tab = 'analytics' | 'books' | 'orders' | 'chats'

type Draft = {
  price: string
  salePrice: string
  stock: string
  category: Category
  featured: boolean
  image: string
  cover: string
  title: Localized
  author: Localized
  description: Localized
}

const blank = (): Draft => ({
  price: '',
  salePrice: '',
  stock: '1',
  category: 'fiction',
  featured: false,
  image: '',
  cover: '#1b4332',
  title: emptyText(),
  author: emptyText(),
  description: emptyText(),
})

function fromBook(book: Book): Draft {
  return {
    price: String(book.price),
    salePrice: book.salePrice ? String(book.salePrice) : '',
    stock: String(book.stock),
    category: book.category,
    featured: book.featured,
    image: book.image,
    cover: book.cover || '#1b4332',
    title: { ...book.title },
    author: { ...book.author },
    description: { ...book.description },
  }
}

export function Admin() {
  const { t, lang, setLang } = useI18n()
  const { books, reload } = useBooks()
  const [ready, setReady] = useState(false)
  const [authed, setAuthed] = useState(false)
  const [telegram, setTelegram] = useState(false)
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [tab, setTab] = useState<Tab>('analytics')
  const [orders, setOrders] = useState<Order[]>([])
  const [chats, setChats] = useState<Chat[]>([])
  const [activeChat, setActiveChat] = useState('')
  const [reply, setReply] = useState('')
  const [editor, setEditor] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>(blank)
  const [fieldLang, setFieldLang] = useState(lang)
  const [file, setFile] = useState<File | null>(null)
  const [formError, setFormError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    api<{ ok: boolean; telegram: { configured: boolean } }>('/api/admin/me')
      .then((data) => {
        setAuthed(data.ok)
        setTelegram(data.telegram.configured)
      })
      .catch(() => setAuthed(false))
      .finally(() => setReady(true))
  }, [])

  useEffect(() => {
    if (!authed) return
    let stop = false
    const load = () => {
      api<Order[]>('/api/orders').then((data) => { if (!stop) setOrders(data) }).catch(() => undefined)
      api<Chat[]>('/api/admin/chats').then((data) => { if (!stop) setChats(data) }).catch(() => undefined)
    }
    load()
    const timer = window.setInterval(load, 20000)
    return () => {
      stop = true
      window.clearInterval(timer)
    }
  }, [authed])

  useEffect(() => {
    if (!authed || tab !== 'orders' || !orders.some((order) => order.adminSeen === false)) return
    api('/api/admin/orders/seen', { method: 'POST' })
      .then(() => setOrders((current) => current.map((order) => ({ ...order, adminSeen: true }))))
      .catch(() => undefined)
  }, [authed, tab, orders])

  async function login(event: FormEvent) {
    event.preventDefault()
    setLoginError('')
    try {
      await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ password }) })
      setAuthed(true)
      setPassword('')
    } catch {
      setLoginError(t.badPassword)
    }
  }

  async function logout() {
    await api('/api/admin/logout', { method: 'POST' })
    setAuthed(false)
  }

  function openNew() {
    setEditingId(null)
    setDraft(blank())
    setFile(null)
    setFormError('')
    setEditor(true)
  }

  function openEdit(book: Book) {
    setEditingId(book.id)
    setDraft(fromBook(book))
    setFile(null)
    setFormError('')
    setEditor(true)
  }

  function patchText(key: 'title' | 'author' | 'description', value: string) {
    setDraft((current) => ({ ...current, [key]: { ...current[key], [fieldLang]: value } }))
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    setFormError('')
    if (!LANGS.some((code) => draft.title[code].trim())) {
      setFormError(t.needTitle)
      return
    }
    const price = Number(draft.price)
    const sale = draft.salePrice.trim() === '' ? null : Number(draft.salePrice)
    if (sale != null && (!Number.isFinite(sale) || sale <= 0 || sale >= price)) {
      setFormError(t.saleBad)
      return
    }
    try {
      let image = draft.image
      if (file) {
        const body = new FormData()
        body.append('file', file)
        const uploaded = await api<{ url: string }>('/api/upload', { method: 'POST', body })
        image = uploaded.url
      }
      const payload = {
        ...draft,
        image,
        price,
        salePrice: sale,
        stock: Number(draft.stock),
      }
      await api(editingId ? `/api/books/${editingId}` : '/api/books', {
        method: editingId ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      })
      setEditor(false)
      setNotice(t.saved)
      reload()
    } catch {
      setFormError(t.error)
    }
  }

  async function remove(id: string) {
    if (!window.confirm(t.confirmDelete)) return
    await api(`/api/books/${id}`, { method: 'DELETE' })
    reload()
  }

  async function clearOrder(id: string) {
    if (!window.confirm(t.confirmClear)) return
    await api(`/api/orders/${id}`, { method: 'DELETE' })
    setOrders((current) => current.filter((order) => order.id !== id))
  }

  async function setStatus(id: string, status: OrderStatus) {
    const updated = await api<Order>(`/api/orders/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
    setOrders((current) => current.map((order) => (order.id === id ? updated : order)))
  }

  async function removeChat(id: string) {
    if (!window.confirm(t.confirmChat)) return
    await api(`/api/admin/chats/${id}`, { method: 'DELETE' })
    setChats((current) => current.filter((chat) => chat.id !== id))
    if (activeChat === id) setActiveChat('')
  }

  function chatTitle(chat: Chat) {
    if (!chat.profile) return t.guest
    return chat.profile.name || (chat.profile.username ? `@${chat.profile.username}` : t.guest)
  }

  async function sendReply(event: FormEvent) {
    event.preventDefault()
    if (!activeChat || !reply.trim()) return
    const chat = await api<Chat>(`/api/admin/chats/${activeChat}/messages`, {
      method: 'POST',
      body: JSON.stringify({ text: reply }),
    })
    setReply('')
    setChats((current) => current.map((item) => (item.id === chat.id ? { ...item, messages: chat.messages, unread: false } : item)))
  }

  useEffect(() => {
    if (!authed || !activeChat) return
    const chat = chats.find((item) => item.id === activeChat)
    if (!chat?.unread) return
    api(`/api/admin/chats/${activeChat}/read`, { method: 'POST' })
      .then(() => setChats((current) => current.map((item) => (item.id === activeChat ? { ...item, unread: false } : item))))
      .catch(() => undefined)
  }, [authed, activeChat, chats])

  const currentChat = chats.find((chat) => chat.id === activeChat)
  const statusLabel: Record<OrderStatus, string> = {
    new: t.statusNew,
    confirmed: t.statusOk,
    delivered: t.statusDone,
    cancelled: t.statusCancel,
  }

  if (!ready) return <main className="admin-page"><p className="muted">{t.loading}</p></main>

  if (!authed) {
    return (
      <main className="login-screen">
        <aside>
          <img src="/logo.png" alt="Birlik" />
          <h1>{t.adminTitle}</h1>
          <p>{t.adminLead}</p>
        </aside>
        <section>
          <form className="login" onSubmit={login}>
            <MenuSelect
              className="side-lang"
              label={t.tagline}
              value={lang}
              options={LANGS.map((code) => ({ value: code, label: fieldLangName[code] }))}
              onChange={(value) => setLang(value as Lang)}
            />
            <h2>{t.login}</h2>
            <label>
              {t.password}
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoFocus />
            </label>
            {loginError ? <p className="form-error">{loginError}</p> : null}
            <button className="btn" type="submit">
              {t.login}
            </button>
            <Link className="btn btn-quiet" to="/">
              {t.toSite}
            </Link>
          </form>
        </section>
      </main>
    )
  }

  const alerts: Partial<Record<Tab, number>> = {
    orders: orders.filter((order) => order.adminSeen === false).length,
    chats: chats.filter((chat) => chat.unread).length,
  }
  const soldByBook = new Map<string, number>()
  for (const order of orders) {
    if (order.status === 'cancelled') continue
    for (const item of order.items) soldByBook.set(item.bookId, (soldByBook.get(item.bookId) || 0) + item.qty)
  }
  const soldTotal = [...soldByBook.values()].reduce((sum, qty) => sum + qty, 0)
  const revenue = orders.filter((order) => order.status !== 'cancelled').reduce((sum, order) => sum + order.total, 0)
  const stockTotal = books.reduce((sum, book) => sum + book.stock, 0)
  const saleCount = books.filter((book) => offerPrice(book) < book.price).length

  return (
    <main className="admin-shell">
      <aside className="admin-side">
        <Link to="/" className="side-brand">
          <img src="/logo.png" alt="Birlik" />
        </Link>
        <nav>
          {(['analytics', 'books', 'orders', 'chats'] as const).map((item) => (
            <button key={item} type="button" className={tab === item ? 'on' : ''} onClick={() => setTab(item)}>
              <span>{t[item]}</span>
              {alerts[item] ? <em>{alerts[item]}</em> : null}
            </button>
          ))}
        </nav>
        <div className="side-foot">
          <p className={telegram ? 'ok' : 'warn'}>{telegram ? t.telegramOn : t.telegramOff}</p>
          <MenuSelect
            className="side-lang"
            label={t.tagline}
            value={lang}
            options={LANGS.map((code) => ({ value: code, label: fieldLangName[code] }))}
            onChange={(value) => setLang(value as Lang)}
          />
          <Link className="side-link" to="/">
            {t.toSite}
          </Link>
          <button type="button" className="side-logout" onClick={() => void logout()}>
            {t.logout}
          </button>
        </div>
      </aside>
      <section className="admin-main">
      <header className="admin-top">
        <div>
          <h1>{t[tab]}</h1>
          {notice ? <p className="saved">{notice}</p> : null}
        </div>
        {tab === 'books' ? (
          <button type="button" className="btn" onClick={openNew}>
            {t.newBook}
          </button>
        ) : null}
      </header>

      {tab === 'analytics' ? (
        <>
          <div className="stats">
            <article className="stat">
              <span>{t.soldQty}</span>
              <strong>{soldTotal}</strong>
            </article>
            <article className="stat">
              <span>{t.revenue}</span>
              <strong>{formatPrice(revenue, lang, t.currency)}</strong>
            </article>
            <article className="stat">
              <span>{t.stockLeft}</span>
              <strong>{stockTotal}</strong>
            </article>
            <article className="stat">
              <span>{t.onSaleCount}</span>
              <strong>{saleCount}</strong>
            </article>
          </div>
          <section className="panel">
            <table className="stat-table">
              <thead>
                <tr>
                  <th>{t.books}</th>
                  <th>{t.soldCol}</th>
                  <th>{t.stock}</th>
                  <th>{t.price}</th>
                </tr>
              </thead>
              <tbody>
                {books.map((book) => {
                  const now = offerPrice(book)
                  return (
                    <tr key={book.id}>
                      <td>{pick(book.title, lang)}</td>
                      <td>{soldByBook.get(book.id) || 0}</td>
                      <td className={book.stock === 0 ? 'warn' : book.stock <= 3 ? 'low' : ''}>
                        {book.stock}
                        {book.stock === 0 ? ` · ${t.outStock}` : book.stock <= 3 ? ` · ${t.lowStock}` : ''}
                      </td>
                      <td>
                        {now < book.price ? (
                          <span className="price-pair">
                            <s>{formatPrice(book.price, lang, t.currency)}</s>
                            <strong>{formatPrice(now, lang, t.currency)}</strong>
                          </span>
                        ) : (
                          formatPrice(book.price, lang, t.currency)
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </section>
        </>
      ) : null}

      {tab === 'books' ? (
        <section className="panel">
          <div className="admin-books">
            {books.map((book) => (
              <article key={book.id}>
                <div className="swatch" style={{ background: book.cover }}>
                  {book.image ? <img src={book.image} alt="" /> : null}
                </div>
                <div>
                  <h2>{pick(book.title, lang)}</h2>
                  <p>
                    {categoryName(t, book.category)} · {offerPrice(book) < book.price ? `${formatPrice(offerPrice(book), lang, t.currency)} · ` : ''}
                    {formatPrice(book.price, lang, t.currency)} · {book.stock} {t.pcs}
                  </p>
                </div>
                <div className="row-actions">
                  <button type="button" onClick={() => openEdit(book)}>
                    {t.editBook}
                  </button>
                  <button type="button" onClick={() => void remove(book.id)}>
                    {t.delete}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {tab === 'orders' ? (
        <section className="stack">
          {orders.length === 0 ? <p className="muted">{t.noOrders}</p> : null}
          {orders.map((order) => (
            <article key={order.id} className="order-row">
              <div>
                <strong>
                  {order.name}
                  {order.profile?.username ? <em> @{order.profile.username}</em> : null}
                </strong>
                <p>
                  {order.phone} · {formatWhen(order.createdAt, lang)}
                </p>
              </div>
              <div className="order-books">
                {order.items.map((item) => {
                  const book = books.find((entry) => entry.id === item.bookId)
                  return (
                    <div key={item.bookId} className="order-book">
                      <span className="swatch" style={{ background: book?.cover || '#1b4332' }}>
                        {book?.image ? <img src={book.image} alt="" /> : null}
                      </span>
                      <strong>
                        {pick(item.title, lang)}
                        <span>× {item.qty}</span>
                      </strong>
                    </div>
                  )
                })}
                {order.address || order.note ? <p>{[order.address, order.note].filter(Boolean).join(' · ')}</p> : null}
              </div>
              <strong>{formatPrice(order.total, lang, t.currency)}</strong>
              <MenuSelect
                label={statusLabel[order.status]}
                value={order.status}
                menuWidth={150}
                options={(Object.keys(statusLabel) as OrderStatus[]).map((status) => ({ value: status, label: statusLabel[status] }))}
                onChange={(value) => void setStatus(order.id, value as OrderStatus)}
              />
              <button type="button" onClick={() => void clearOrder(order.id)}>
                {t.clear}
              </button>
            </article>
          ))}
        </section>
      ) : null}

      {tab === 'chats' ? (
        <section className="chat-admin">
          <div className="chat-list">
            {chats.length === 0 ? <p className="muted">{t.noChats}</p> : null}
            {chats.map((chat) => (
              <div key={chat.id} className={chat.id === activeChat ? 'chat-row on' : chat.unread ? 'chat-row unread' : 'chat-row'}>
                <button type="button" onClick={() => setActiveChat(chat.id)}>
                  {chat.profile?.photo ? <img src={chat.profile.photo} alt="" /> : <i>{chatTitle(chat).slice(0, 1)}</i>}
                  <span>
                    <strong>{chatTitle(chat)}</strong>
                    <em>{chat.messages.filter((message) => message.role === 'user').at(-1)?.text || t.empty}</em>
                  </span>
                </button>
                <button type="button" aria-label={t.delete} onClick={() => void removeChat(chat.id)}>
                  ×
                </button>
              </div>
            ))}
          </div>
          <div className="chat-read">
            {currentChat ? (
              <>
                <header className="chat-head">
                  {currentChat.profile?.photo ? <img src={currentChat.profile.photo} alt="" /> : <i>{chatTitle(currentChat).slice(0, 1)}</i>}
                  <div>
                    <strong>{chatTitle(currentChat)}</strong>
                    <p>
                      {currentChat.profile?.username ? `@${currentChat.profile.username}` : t.guest}
                      {currentChat.profile?.phone ? ` · ${currentChat.profile.phone}` : ''}
                    </p>
                  </div>
                  <button type="button" onClick={() => void removeChat(currentChat.id)}>
                    {t.delete}
                  </button>
                </header>
                <div className="thread plain">
                  {currentChat.messages.map((message) => (
                    <p key={message.id} className={`bubble ${message.role === 'user' ? 'user' : message.role}`}>
                      {message.text}
                    </p>
                  ))}
                </div>
                <form onSubmit={sendReply}>
                  <input value={reply} onChange={(event) => setReply(event.target.value)} placeholder={t.replyPh} />
                  <button className="btn btn-primary" type="submit">
                    {t.reply}
                  </button>
                </form>
              </>
            ) : (
              <p className="muted">{t.noChats}</p>
            )}
          </div>
        </section>
      ) : null}

      {editor ? (
        <div className="modal" onMouseDown={() => setEditor(false)}>
          <form className="dialog" onSubmit={save} onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <h2>{editingId ? t.editBook : t.newBook}</h2>
              <button type="button" onClick={() => setEditor(false)} aria-label={t.close}>
                ×
              </button>
            </header>
            <div className="dialog-body">
              <div className="split-fields">
                <label>
                  {t.price}
                  <input value={draft.price} onChange={(event) => setDraft({ ...draft, price: event.target.value })} inputMode="numeric" required />
                </label>
                <label>
                  {t.salePrice}
                  <input value={draft.salePrice} onChange={(event) => setDraft({ ...draft, salePrice: event.target.value })} inputMode="numeric" />
                </label>
                <label>
                  {t.stock}
                  <input value={draft.stock} onChange={(event) => setDraft({ ...draft, stock: event.target.value })} inputMode="numeric" required />
                </label>
                <label>
                  {t.category}
                  <MenuSelect
                    label={t.category}
                    value={draft.category}
                    options={CATEGORIES.map((category) => ({ value: category, label: categoryName(t, category) }))}
                    onChange={(value) => setDraft({ ...draft, category: value as Category })}
                  />
                </label>
                <label>
                  {t.image}
                  <span className="file-row">
                    <input type="color" value={draft.cover} onChange={(event) => setDraft({ ...draft, cover: event.target.value })} aria-label={t.image} />
                    <input type="file" accept="image/*" onChange={(event) => setFile(event.target.files?.[0] || null)} />
                  </span>
                </label>
              </div>
              <label className="check-row">
                <input type="checkbox" checked={draft.featured} onChange={(event) => setDraft({ ...draft, featured: event.target.checked })} />
                {t.featuredFlag}
              </label>
              <div className="seg">
                {LANGS.map((code) => (
                  <button key={code} type="button" className={fieldLang === code ? 'on' : ''} onClick={() => setFieldLang(code)}>
                    {fieldLangName[code]}
                  </button>
                ))}
              </div>
              <label>
                {t.titleField}
                <input value={draft.title[fieldLang]} onChange={(event) => patchText('title', event.target.value)} />
              </label>
              <label>
                {t.authorField}
                <input value={draft.author[fieldLang]} onChange={(event) => patchText('author', event.target.value)} />
              </label>
              <label>
                {t.descField}
                <textarea rows={4} value={draft.description[fieldLang]} onChange={(event) => patchText('description', event.target.value)} />
              </label>
              {formError ? <p className="form-error">{formError}</p> : null}
            </div>
            <footer>
              <button type="button" className="btn btn-quiet" onClick={() => setEditor(false)}>
                {t.cancel}
              </button>
              <button className="btn" type="submit">
                {t.save}
              </button>
            </footer>
          </form>
        </div>
      ) : null}
      </section>
    </main>
  )
}
