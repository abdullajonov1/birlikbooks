import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { api } from '../api'
import type { Book } from '../types'

type BooksValue = {
  books: Book[]
  loading: boolean
  error: boolean
  reload: () => void
}

const BooksContext = createContext<BooksValue | null>(null)

export function BooksProvider({ children }: { children: ReactNode }) {
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const reload = useCallback(() => {
    setLoading(true)
    api<Book[]>('/api/books')
      .then((data) => {
        setBooks(data)
        setError(false)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const value = useMemo(() => ({ books, loading, error, reload }), [books, loading, error, reload])
  return <BooksContext.Provider value={value}>{children}</BooksContext.Provider>
}

export function useBooks() {
  const value = useContext(BooksContext)
  if (!value) throw new Error('books')
  return value
}
