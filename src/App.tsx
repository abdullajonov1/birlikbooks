import { MotionConfig } from 'framer-motion'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { BooksProvider } from './context/BooksContext'
import { CartProvider } from './context/CartContext'
import { LanguageProvider } from './context/LanguageContext'
import { ThemeProvider } from './context/ThemeContext'
import { Admin } from './pages/Admin'
import { BookPage } from './pages/BookPage'
import { Catalog } from './pages/Catalog'
import { Checkout } from './pages/Checkout'
import { Delivery } from './pages/Delivery'
import { Home } from './pages/Home'
import { Orders } from './pages/Orders'

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <LanguageProvider>
        <ThemeProvider>
        <BooksProvider>
          <CartProvider>
            <Routes>
              <Route element={<Layout />}>
                <Route path="/" element={<Home />} />
                <Route path="/katalog" element={<Catalog />} />
                <Route path="/kitob/:id" element={<BookPage />} />
                <Route path="/buyurtma" element={<Checkout />} />
                <Route path="/yetkazish" element={<Delivery />} />
                <Route path="/buyurtmalarim" element={<Orders />} />
                <Route path="/kuzatish" element={<Navigate to="/buyurtmalarim" replace />} />
              </Route>
              <Route path="/admin" element={<Admin />} />
            </Routes>
          </CartProvider>
        </BooksProvider>
        </ThemeProvider>
      </LanguageProvider>
    </MotionConfig>
  )
}
