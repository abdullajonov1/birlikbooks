export const LANGS = ['uz', 'uz-cyrl', 'ru', 'en'] as const
export type Lang = (typeof LANGS)[number]

export const CATEGORIES = ['fiction', 'children', 'study', 'business', 'psychology'] as const
export type Category = (typeof CATEGORIES)[number]

export type Localized = Record<Lang, string>

export type Book = {
  id: string
  price: number
  salePrice?: number | null
  category: Category
  stock: number
  featured: boolean
  image: string
  cover: string
  title: Localized
  author: Localized
  description: Localized
  createdAt: number
  rating?: number
  ratingCount?: number
}

export type OrderStatus = 'new' | 'confirmed' | 'delivered' | 'cancelled'

export type OrderItem = {
  bookId: string
  qty: number
  price: number
  title: Localized
}

export type Order = {
  id: string
  createdAt: number
  name: string
  phone: string
  address: string
  note: string
  lang: Lang
  status: OrderStatus
  adminSeen?: boolean
  items: OrderItem[]
  total: number
  profile?: { name: string; username: string; phone: string; photo: string } | null
}

export type ChatRole = 'user' | 'bot' | 'admin'

export type ChatMessage = {
  id: string
  role: ChatRole
  text: string
  at: number
}

export type ChatProfile = {
  name: string
  username: string
  phone: string
  photo: string
}

export type Chat = {
  id: string
  lang: Lang
  messages: ChatMessage[]
  unread?: boolean
  createdAt?: number
  profile?: ChatProfile | null
}

export const emptyText = (): Localized => ({ uz: '', 'uz-cyrl': '', ru: '', en: '' })

export function offerPrice(book: { price: number; salePrice?: number | null }) {
  const sale = book.salePrice
  if (sale && sale > 0 && sale < book.price) return sale
  return book.price
}

export function pick(value: Localized | undefined, lang: Lang) {
  if (!value) return ''
  return value[lang] || value.uz || value.en || value.ru || value['uz-cyrl'] || ''
}
