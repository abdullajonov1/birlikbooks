import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

type CartItem = { bookId: string; qty: number }

type CartValue = {
  items: CartItem[]
  count: number
  open: boolean
  setOpen: (open: boolean) => void
  add: (bookId: string, qty?: number) => void
  setQty: (bookId: string, qty: number) => void
  remove: (bookId: string) => void
  clear: () => void
}

const CartContext = createContext<CartValue | null>(null)
const storageKey = 'birlik-cart'

function readCart(): CartItem[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) || '[]') as CartItem[]
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item) => item && typeof item.bookId === 'string' && item.qty > 0)
  } catch {
    return []
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(readCart)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(items))
  }, [items])

  const value = useMemo<CartValue>(() => {
    const count = items.reduce((sum, item) => sum + item.qty, 0)
    return {
      items,
      count,
      open,
      setOpen,
      add: (bookId, qty = 1) => {
        setItems((current) => {
          const found = current.find((item) => item.bookId === bookId)
          if (!found) return [...current, { bookId, qty }]
          return current.map((item) => (item.bookId === bookId ? { ...item, qty: Math.min(20, item.qty + qty) } : item))
        })
      },
      setQty: (bookId, qty) => {
        setItems((current) =>
          qty < 1 ? current.filter((item) => item.bookId !== bookId) : current.map((item) => (item.bookId === bookId ? { ...item, qty: Math.min(20, qty) } : item)),
        )
      },
      remove: (bookId) => setItems((current) => current.filter((item) => item.bookId !== bookId)),
      clear: () => setItems([]),
    }
  }, [items, open])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const value = useContext(CartContext)
  if (!value) throw new Error('cart')
  return value
}
