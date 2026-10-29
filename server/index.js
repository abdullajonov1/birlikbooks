import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import cors from 'cors'
import express from 'express'
import multer from 'multer'
import { categories } from './seed.js'
import { getState, mutate } from './store.js'
import { notifyAdmin, requestPhone, startTelegram, telegramBotId, telegramStatus } from './telegram.js'

const root = path.dirname(fileURLToPath(import.meta.url))
const uploadsDir = path.join(root, 'uploads')
fs.mkdirSync(uploadsDir, { recursive: true })

function loadEnv() {
  const envFile = path.join(process.cwd(), '.env')
  if (!fs.existsSync(envFile)) return
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index < 1) continue
    const key = trimmed.slice(0, index).trim()
    const value = trimmed.slice(index + 1).trim()
    if (!process.env[key]) process.env[key] = value
  }
}

loadEnv()

const PORT = Number(process.env.PORT || 3001)
const PASSWORD = process.env.ADMIN_PASSWORD || 'birlik2026'
const SECRET = process.env.SESSION_SECRET || 'birlik-dev-secret'
const LANGS = ['uz', 'uz-cyrl', 'ru', 'en']

function uid(prefix) {
  return `${prefix}_${crypto.randomBytes(5).toString('hex')}`
}

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = crypto.createHmac('sha256', SECRET).update(body).digest('base64url')
  return `${body}.${signature}`
}

function verify(token) {
  if (!token || !token.includes('.')) return null
  const [body, signature] = token.split('.')
  const expected = crypto.createHmac('sha256', SECRET).update(body).digest('base64url')
  const left = Buffer.from(signature)
  const right = Buffer.from(expected)
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) return null
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString())
    if (!data.exp || data.exp < Date.now()) return null
    return data
  } catch {
    return null
  }
}

function readCookie(req, name) {
  const header = req.headers.cookie || ''
  for (const part of header.split(';')) {
    const index = part.indexOf('=')
    if (index < 0) continue
    if (part.slice(0, index).trim() === name) return decodeURIComponent(part.slice(index + 1).trim())
  }
  return ''
}

function setSession(res) {
  const token = sign({ role: 'admin', exp: Date.now() + 7 * 24 * 60 * 60 * 1000 })
  res.setHeader('Set-Cookie', `birlik=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=604800`)
}

function clearSession(res) {
  res.setHeader('Set-Cookie', 'birlik=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0')
}

function isAdmin(req) {
  return Boolean(verify(readCookie(req, 'birlik')))
}

function requireAdmin(req, res, next) {
  if (!isAdmin(req)) return res.status(401).json({ error: 'unauthorized' })
  next()
}

function pushCookie(res, cookie) {
  const current = res.getHeader('Set-Cookie')
  const list = !current ? [] : Array.isArray(current) ? current : [String(current)]
  res.setHeader('Set-Cookie', [...list, cookie])
}

function currentUser(req) {
  const data = verify(readCookie(req, 'birlik_user'))
  if (!data || data.role !== 'user' || !data.id) return null
  return (getState().customers || []).find((item) => item.id === String(data.id)) || null
}

function setUserCookie(res, id) {
  const token = sign({ role: 'user', id: String(id), exp: Date.now() + 30 * 24 * 60 * 60 * 1000 })
  pushCookie(res, `birlik_user=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000`)
}

function publicProfile(user) {
  return {
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    username: user.username || '',
    photo: user.photo || '',
    phone: user.phone || '',
    extraPhone: user.extraPhone || '',
    email: user.email || '',
    region: user.region || '',
    district: user.district || '',
    street: user.street || '',
    house: user.house || '',
    apartment: user.apartment || '',
    entrance: user.entrance || '',
    landmark: user.landmark || '',
  }
}

const REGION_IDS = ['tashkent-city', 'tashkent', 'andijan', 'bukhara', 'fergana', 'jizzakh', 'khorezm', 'namangan', 'navoi', 'kashkadarya', 'samarkand', 'syrdarya', 'surkhandarya', 'karakalpakstan']

function cleanText(value, max) {
  return String(value || '').trim().slice(0, max)
}

function localized(input, max) {
  const source = input && typeof input === 'object' ? input : {}
  return Object.fromEntries(LANGS.map((lang) => [lang, cleanText(source[lang], max)]))
}

function hasText(value) {
  return LANGS.some((lang) => value[lang])
}

function ratingOf(bookId) {
  const rows = (getState().reviews || []).filter((item) => item.bookId === bookId)
  if (!rows.length) return { rating: 0, ratingCount: 0 }
  const rating = rows.reduce((sum, item) => sum + item.stars, 0) / rows.length
  return { rating: Math.round(rating * 10) / 10, ratingCount: rows.length }
}

function saleOf(book) {
  const sale = Math.round(Number(book?.salePrice))
  if (!Number.isInteger(sale) || sale <= 0 || sale >= Number(book?.price)) return null
  return sale
}

function readSale(input, price) {
  if (input === '' || input == null) return null
  const sale = Math.round(Number(input))
  if (!Number.isInteger(sale) || sale <= 0 || sale >= price) return null
  return sale
}

function publicBook(book) {
  return {
    id: book.id,
    price: book.price,
    salePrice: saleOf(book),
    category: book.category,
    stock: book.stock,
    featured: book.featured,
    image: book.image,
    cover: book.cover,
    title: book.title,
    author: book.author,
    description: book.description,
    createdAt: book.createdAt,
    ...ratingOf(book.id),
  }
}

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (_req, file, callback) => {
      const ext = path.extname(file.originalname).toLowerCase()
      const safe = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext) ? ext : '.jpg'
      callback(null, `${Date.now()}-${crypto.randomBytes(3).toString('hex')}${safe}`)
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (file.mimetype.startsWith('image/')) callback(null, true)
    else callback(new Error('image'))
  },
})

const app = express()
app.use(cors({ origin: true, credentials: true }))
app.use(express.json({ limit: '1mb' }))
app.use('/uploads', express.static(uploadsDir))

app.get('/api/books', (_req, res) => {
  const books = [...getState().books].sort((a, b) => b.createdAt - a.createdAt)
  res.json(books.map(publicBook))
})

app.get('/api/books/:id', (req, res) => {
  const book = getState().books.find((item) => item.id === req.params.id)
  if (!book) return res.status(404).json({ error: 'not_found' })
  res.json(publicBook(book))
})

app.get('/api/books/:id/reviews', (req, res) => {
  const reviews = (getState().reviews || []).filter((item) => item.bookId === req.params.id)
  res.json(reviews)
})

app.post('/api/books/:id/reviews', (req, res) => {
  const book = getState().books.find((item) => item.id === req.params.id)
  if (!book) return res.status(404).json({ error: 'not_found' })
  const name = cleanText(req.body?.name, 40)
  const text = cleanText(req.body?.text, 500)
  const stars = Number(req.body?.stars)
  if (name.length < 2 || text.length < 4 || !Number.isInteger(stars) || stars < 1 || stars > 5) {
    return res.status(400).json({ error: 'bad_request' })
  }
  const review = { id: uid('review'), bookId: book.id, name, text, stars, createdAt: Date.now() }
  mutate((state) => {
    state.reviews ??= []
    state.reviews.unshift(review)
  })
  res.json(review)
})

app.post('/api/admin/login', (req, res) => {
  const password = String(req.body?.password || '')
  const left = Buffer.from(password)
  const right = Buffer.from(PASSWORD)
  const same = left.length === right.length && crypto.timingSafeEqual(left, right)
  if (!same) return res.status(401).json({ error: 'unauthorized' })
  setSession(res)
  res.json({ ok: true })
})

app.post('/api/admin/logout', (_req, res) => {
  clearSession(res)
  res.json({ ok: true })
})

app.get('/api/admin/me', (req, res) => {
  res.json({ ok: isAdmin(req), telegram: telegramStatus() })
})

app.post('/api/upload', requireAdmin, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'bad_request' })
  res.json({ url: `/uploads/${req.file.filename}` })
})

app.post('/api/books', requireAdmin, (req, res) => {
  const title = localized(req.body?.title, 180)
  const author = localized(req.body?.author, 120)
  const description = localized(req.body?.description, 2000)
  const price = Number(req.body?.price)
  const stock = Number(req.body?.stock)
  const category = categories.includes(req.body?.category) ? req.body.category : 'fiction'
  if (!hasText(title) || !Number.isFinite(price) || price < 0 || !Number.isInteger(stock) || stock < 0) {
    return res.status(400).json({ error: 'bad_request' })
  }
  const book = {
    id: uid('book'),
    price: Math.round(price),
    salePrice: readSale(req.body?.salePrice, Math.round(price)),
    category,
    stock,
    featured: Boolean(req.body?.featured),
    image: cleanText(req.body?.image, 300),
    cover: /^#[0-9a-fA-F]{6}$/.test(req.body?.cover || '') ? req.body.cover : '#1b4332',
    title,
    author,
    description,
    createdAt: Date.now(),
  }
  mutate((state) => {
    state.books.unshift(book)
  })
  res.json(publicBook(book))
})

app.put('/api/books/:id', requireAdmin, (req, res) => {
  const current = getState().books.find((item) => item.id === req.params.id)
  if (!current) return res.status(404).json({ error: 'not_found' })
  const title = localized(req.body?.title, 180)
  const author = localized(req.body?.author, 120)
  const description = localized(req.body?.description, 2000)
  const price = Number(req.body?.price)
  const stock = Number(req.body?.stock)
  const category = categories.includes(req.body?.category) ? req.body.category : current.category
  if (!hasText(title) || !Number.isFinite(price) || price < 0 || !Number.isInteger(stock) || stock < 0) {
    return res.status(400).json({ error: 'bad_request' })
  }
  const next = {
    ...current,
    price: Math.round(price),
    salePrice: readSale(req.body?.salePrice, Math.round(price)),
    category,
    stock,
    featured: Boolean(req.body?.featured),
    image: cleanText(req.body?.image, 300),
    cover: /^#[0-9a-fA-F]{6}$/.test(req.body?.cover || '') ? req.body.cover : current.cover,
    title,
    author,
    description,
  }
  mutate((state) => {
    const index = state.books.findIndex((item) => item.id === current.id)
    if (index >= 0) state.books[index] = next
  })
  res.json(publicBook(next))
})

app.delete('/api/books/:id', requireAdmin, (req, res) => {
  const exists = getState().books.some((item) => item.id === req.params.id)
  if (!exists) return res.status(404).json({ error: 'not_found' })
  mutate((state) => {
    state.books = state.books.filter((item) => item.id !== req.params.id)
  })
  res.json({ ok: true })
})

app.post('/api/orders', async (req, res) => {
  const name = cleanText(req.body?.name, 80)
  const phone = cleanText(req.body?.phone, 30)
  const address = cleanText(req.body?.address, 200)
  const note = cleanText(req.body?.note, 500)
  const lang = LANGS.includes(req.body?.lang) ? req.body.lang : 'uz'
  const requested = Array.isArray(req.body?.items) ? req.body.items : []
  if (name.length < 2 || phone.replace(/\D/g, '').length < 7 || address.length < 4 || !requested.length) {
    return res.status(400).json({ error: 'bad_request' })
  }

  const books = getState().books
  const wanted = new Map()
  for (const row of requested) {
    const qty = Number(row.qty)
    if (!Number.isInteger(qty) || qty < 1 || qty > 20) return res.status(400).json({ error: 'bad_request' })
    wanted.set(row.bookId, (wanted.get(row.bookId) || 0) + qty)
  }
  const items = []
  for (const [bookId, qty] of wanted) {
    const book = books.find((item) => item.id === bookId)
    if (!book || book.stock < qty) return res.status(400).json({ error: 'out_of_stock' })
    items.push({ bookId: book.id, qty, price: saleOf(book) || book.price, title: book.title })
  }

  const order = {
    id: uid('order'),
    createdAt: Date.now(),
    name,
    phone,
    address,
    note,
    lang,
    status: 'new',
    adminSeen: false,
    telegramId: currentUser(req)?.id || '',
    items,
    total: items.reduce((sum, item) => sum + item.price * item.qty, 0),
  }

  mutate((state) => {
    for (const item of items) {
      const book = state.books.find((entry) => entry.id === item.bookId)
      if (book) book.stock -= item.qty
    }
    state.orders.unshift(order)
  })

  const lines = items.map((item) => `• ${item.title.uz || item.title.en || item.title.ru} × ${item.qty}`)
  try {
    await notifyAdmin(
      [`Yangi buyurtma ${order.id}`, `Ism: ${name}`, `Tel: ${phone}`, `Manzil: ${address}`, note ? `Izoh: ${note}` : '', `Til: ${lang}`, ...lines, `Jami: ${order.total} so'm`].filter(Boolean).join('\n'),
    )
  } catch (error) {
    console.error('telegram order', error.message)
  }

  res.json({ id: order.id, total: order.total })
})

function phonesMatch(storedPhone, givenPhone) {
  const stored = String(storedPhone || '').replace(/\D/g, '')
  const given = String(givenPhone || '').replace(/\D/g, '')
  return given.length >= 7 && stored.endsWith(given.slice(-9)) && given.endsWith(stored.slice(-9))
}

function findCustomer(id) {
  if (!id) return null
  return (getState().customers || []).find((item) => item.id === String(id)) || null
}

function customerBrief(customer) {
  if (!customer) return null
  const name = [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim()
  return {
    name,
    username: customer.username || '',
    phone: customer.phone || '',
    photo: customer.photo || '',
  }
}

function profileLines(customer) {
  if (!customer) return ['Profil: ro‘yxatdan o‘tmagan']
  const brief = customerBrief(customer)
  const who = [brief.name, brief.username ? `@${brief.username}` : ''].filter(Boolean).join(' ')
  const lines = [`Profil: ${who || 'Telegram'}`]
  if (brief.phone) lines.push(`Tel: ${brief.phone}`)
  return lines
}

function ordersFor(user) {
  return getState().orders.filter((order) => {
    if (order.telegramId && order.telegramId === user.id) return true
    return Boolean(user.phone) && phonesMatch(order.phone, user.phone)
  }).slice(0, 30)
}

function telegramAuthOk(body) {
  const hash = String(body?.hash || '')
  if (!/^[a-f0-9]{64}$/.test(hash) || !process.env.TELEGRAM_BOT_TOKEN || !body || typeof body !== 'object') return false
  const lines = Object.keys(body)
    .filter((key) => key !== 'hash' && body[key] !== undefined && body[key] !== null && String(body[key]) !== '')
    .sort()
    .map((key) => `${key}=${String(body[key])}`)
  const secret = crypto.createHash('sha256').update(process.env.TELEGRAM_BOT_TOKEN).digest()
  const hmac = crypto.createHmac('sha256', secret).update(lines.join('\n')).digest('hex')
  const left = Buffer.from(hmac)
  const right = Buffer.from(hash)
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) return false
  const authDate = Number(body.auth_date)
  return Number.isFinite(authDate) && Math.abs(Date.now() / 1000 - authDate) < 86400
}

app.get('/api/cabinet/widget', async (_req, res) => {
  if (!process.env.TELEGRAM_BOT_TOKEN) return res.status(503).json({ error: 'telegram_off' })
  try {
    res.json({ botId: await telegramBotId() })
  } catch (error) {
    console.error('telegram widget', error.message)
    res.status(502).json({ error: 'telegram_off' })
  }
})

app.post('/api/cabinet/telegram', (req, res) => {
  if (!telegramAuthOk(req.body)) return res.status(401).json({ error: 'unauthorized' })
  const id = String(req.body.id)
  mutate((state) => {
    state.customers ??= []
    let customer = state.customers.find((item) => item.id === id)
    if (!customer) {
      customer = { id, firstName: '', lastName: '', phone: '', extraPhone: '', email: '', region: '', district: '', street: '', house: '', apartment: '', entrance: '', landmark: '' }
      state.customers.unshift(customer)
    }
    const firstName = cleanText(req.body.first_name, 40)
    const lastName = cleanText(req.body.last_name, 40)
    if (firstName) customer.firstName = firstName
    if (lastName) customer.lastName = lastName
    if (req.body.username) customer.username = cleanText(req.body.username, 40)
    if (req.body.photo_url) customer.photo = cleanText(req.body.photo_url, 500)
  })
  const user = (getState().customers || []).find((item) => item.id === id)
  setUserCookie(res, id)
  res.json({ user: publicProfile(user), orders: ordersFor(user).map(publicOrder) })
})

app.get('/api/cabinet/me', (req, res) => {
  const user = currentUser(req)
  if (!user) return res.json({ user: null, orders: [] })
  res.json({ user: publicProfile(user), orders: ordersFor(user).map(publicOrder) })
})

app.post('/api/cabinet/logout', (_req, res) => {
  pushCookie(res, 'birlik_user=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0')
  res.json({ ok: true })
})

app.post('/api/cabinet/phone', async (req, res) => {
  const user = currentUser(req)
  if (!user) return res.status(401).json({ error: 'unauthorized' })
  try {
    await requestPhone(user.chatId)
  } catch (error) {
    console.error('telegram phone', error.message)
    return res.status(502).json({ error: 'telegram_off' })
  }
  res.json({ ok: true })
})

app.put('/api/cabinet/profile', (req, res) => {
  const user = currentUser(req)
  if (!user) return res.status(401).json({ error: 'unauthorized' })
  const firstName = cleanText(req.body?.firstName, 40)
  const email = cleanText(req.body?.email, 80)
  const region = cleanText(req.body?.region, 40)
  if (firstName.length < 2) return res.status(400).json({ error: 'bad_request' })
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'bad_request' })
  if (region && !REGION_IDS.includes(region)) return res.status(400).json({ error: 'bad_request' })
  mutate((state) => {
    const customer = state.customers.find((item) => item.id === user.id)
    if (!customer) return
    customer.firstName = firstName
    customer.lastName = cleanText(req.body?.lastName, 40)
    customer.extraPhone = cleanText(req.body?.extraPhone, 20)
    customer.email = email
    customer.region = region
    customer.district = cleanText(req.body?.district, 80)
    customer.street = cleanText(req.body?.street, 120)
    customer.house = cleanText(req.body?.house, 12)
    customer.apartment = cleanText(req.body?.apartment, 12)
    customer.entrance = cleanText(req.body?.entrance, 12)
    customer.landmark = cleanText(req.body?.landmark, 120)
  })
  const fresh = currentUser(req)
  res.json({ user: publicProfile(fresh), orders: ordersFor(fresh).map(publicOrder) })
})

function publicOrder(order) {
  return {
    id: order.id,
    createdAt: order.createdAt,
    status: order.status,
    total: order.total,
    items: order.items.map((item) => ({ qty: item.qty, title: item.title })),
  }
}

app.post('/api/orders/lookup', (req, res) => {
  const id = cleanText(req.body?.id, 40)
  const phone = cleanText(req.body?.phone, 30)
  const order = getState().orders.find((item) => item.id === id)
  if (!order || !phonesMatch(order.phone, phone)) return res.status(404).json({ error: 'not_found' })
  res.json(publicOrder(order))
})

app.post('/api/orders/mine', (req, res) => {
  const phone = cleanText(req.body?.phone, 30)
  if (phone.replace(/\D/g, '').length < 7) return res.status(400).json({ error: 'bad_request' })
  const orders = getState().orders.filter((item) => phonesMatch(item.phone, phone)).slice(0, 30)
  res.json(orders.map(publicOrder))
})

app.get('/api/orders', requireAdmin, (_req, res) => {
  res.json(getState().orders.map((order) => ({ ...order, adminSeen: order.adminSeen !== false, profile: customerBrief(findCustomer(order.telegramId)) })))
})

app.post('/api/admin/orders/seen', requireAdmin, (_req, res) => {
  mutate((state) => {
    for (const order of state.orders) {
      if (order.adminSeen === false) order.adminSeen = true
    }
  })
  res.json({ ok: true })
})

app.delete('/api/orders/:id', requireAdmin, (req, res) => {
  const exists = getState().orders.some((item) => item.id === req.params.id)
  if (!exists) return res.status(404).json({ error: 'not_found' })
  mutate((state) => {
    const order = state.orders.find((item) => item.id === req.params.id)
    if (!order) return
    if (order.status !== 'delivered') {
      for (const item of order.items) {
        const book = state.books.find((entry) => entry.id === item.bookId)
        if (book) book.stock += item.qty
      }
    }
    state.orders = state.orders.filter((item) => item.id !== req.params.id)
  })
  res.json({ ok: true })
})

app.patch('/api/orders/:id', requireAdmin, (req, res) => {
  const statuses = ['new', 'confirmed', 'delivered', 'cancelled']
  if (!statuses.includes(req.body?.status)) return res.status(400).json({ error: 'bad_request' })
  let updated = null
  mutate((state) => {
    const order = state.orders.find((item) => item.id === req.params.id)
    if (!order) return
    order.status = req.body.status
    updated = order
  })
  if (!updated) return res.status(404).json({ error: 'not_found' })
  res.json(updated)
})

app.post('/api/chats', (req, res) => {
  const lang = LANGS.includes(req.body?.lang) ? req.body.lang : 'uz'
  const user = currentUser(req)
  if (!user) return res.status(401).json({ error: 'auth_required' })
  const chat = { id: uid('chat'), lang, createdAt: Date.now(), messages: [], telegramIds: [], customerId: user.id }
  mutate((state) => {
    state.chats.unshift(chat)
  })
  res.json({ id: chat.id })
})

app.get('/api/chats/:id', (req, res) => {
  const chat = getState().chats.find((item) => item.id === req.params.id)
  if (!chat) return res.status(404).json({ error: 'not_found' })
  res.json({ id: chat.id, lang: chat.lang, messages: chat.messages })
})

app.post('/api/chats/:id/messages', async (req, res) => {
  const text = cleanText(req.body?.text, 2000)
  const answer = cleanText(req.body?.answer, 2000)
  const lang = LANGS.includes(req.body?.lang) ? req.body.lang : 'uz'
  if (!text) return res.status(400).json({ error: 'bad_request' })
  const user = currentUser(req)
  if (!user) return res.status(401).json({ error: 'auth_required' })
  const existing = getState().chats.find((item) => item.id === req.params.id)
  if (!existing) return res.status(404).json({ error: 'not_found' })

  const userMessage = { id: uid('msg'), role: 'user', text, at: Date.now() }
  const botMessage = answer ? { id: uid('msg'), role: 'bot', text: answer, at: Date.now() + 1 } : null

  mutate((state) => {
    const chat = state.chats.find((item) => item.id === existing.id)
    if (!chat) return
    chat.lang = lang
    if (user) chat.customerId = user.id
    chat.messages.push(userMessage)
    if (botMessage) chat.messages.push(botMessage)
    chat.unread = true
  })

  if (!answer) {
    try {
      const linked = findCustomer(user?.id || existing.customerId)
      const messageId = await notifyAdmin(
        [...profileLines(linked), 'Javobni shu xabarga reply qiling.', '', text].join('\n'),
      )
      if (messageId) {
        mutate((state) => {
          const chat = state.chats.find((item) => item.id === existing.id)
          if (chat) chat.telegramIds.push(messageId)
        })
      }
    } catch (error) {
      console.error('telegram chat', error.message)
    }
  }

  const chat = getState().chats.find((item) => item.id === existing.id)
  res.json({ id: chat.id, messages: chat.messages })
})

app.get('/api/admin/chats', requireAdmin, (_req, res) => {
  res.json(
    getState().chats.map((chat) => ({
      id: chat.id,
      lang: chat.lang,
      createdAt: chat.createdAt,
      messages: chat.messages,
      unread: Boolean(chat.unread),
      profile: customerBrief(findCustomer(chat.customerId)),
    })),
  )
})

app.post('/api/admin/chats/:id/read', requireAdmin, (req, res) => {
  let found = false
  mutate((state) => {
    const chat = state.chats.find((item) => item.id === req.params.id)
    if (!chat) return
    chat.unread = false
    found = true
  })
  if (!found) return res.status(404).json({ error: 'not_found' })
  res.json({ ok: true })
})

app.delete('/api/admin/chats/:id', requireAdmin, (req, res) => {
  const exists = getState().chats.some((item) => item.id === req.params.id)
  if (!exists) return res.status(404).json({ error: 'not_found' })
  mutate((state) => {
    state.chats = state.chats.filter((item) => item.id !== req.params.id)
  })
  res.json({ ok: true })
})

app.post('/api/admin/chats/:id/messages', requireAdmin, (req, res) => {
  const text = cleanText(req.body?.text, 2000)
  if (!text) return res.status(400).json({ error: 'bad_request' })
  let chat = null
  mutate((state) => {
    chat = state.chats.find((item) => item.id === req.params.id)
    if (!chat) return
    chat.messages.push({ id: uid('msg'), role: 'admin', text, at: Date.now() })
    chat.unread = false
  })
  if (!chat) return res.status(404).json({ error: 'not_found' })
  res.json({ id: chat.id, messages: chat.messages })
})

app.use((error, _req, res, _next) => {
  console.error(error)
  res.status(400).json({ error: 'bad_request' })
})

app.listen(PORT, () => {
  console.log(`Birlik API http://localhost:${PORT}`)
  startTelegram()
})
