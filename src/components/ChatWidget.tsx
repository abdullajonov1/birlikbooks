import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, api } from '../api'
import { useI18n } from '../context/LanguageContext'
import { faqAnswer, faqLabel, matchFaq } from '../i18n'
import type { Chat, ChatMessage } from '../types'

const faqs = ['hours', 'delivery', 'pay', 'order'] as const
const storageKey = 'birlik-chat'

export function ChatWidget() {
  const { t, lang } = useI18n()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [chatId, setChatId] = useState(() => localStorage.getItem(storageKey) || '')
  const [typing, setTyping] = useState(false)
  const [notice, setNotice] = useState('')
  const [seen, setSeen] = useState(0)
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const launcherRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    function onPointer(event: MouseEvent) {
      const target = event.target as Node
      if (panelRef.current?.contains(target) || launcherRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    return () => document.removeEventListener('mousedown', onPointer)
  }, [open])

  useEffect(() => {
    if (!open) return
    let stop = false
    api<{ user: object | null }>('/api/cabinet/me')
      .then((data) => {
        if (!stop) setSignedIn(Boolean(data.user))
      })
      .catch(() => {
        if (!stop) setSignedIn(false)
      })
    return () => {
      stop = true
    }
  }, [open])

  useEffect(() => {
    if (!chatId || !signedIn) return
    let stop = false
    const pull = () => {
      api<Chat>(`/api/chats/${chatId}`)
        .then((chat) => {
          if (!stop) setMessages(chat.messages)
        })
        .catch((error: unknown) => {
          if (error instanceof ApiError && error.code === 'not_found') {
            localStorage.removeItem(storageKey)
            if (!stop) {
              setChatId('')
              setMessages([])
            }
          }
        })
    }
    pull()
    const timer = window.setInterval(pull, open ? 3000 : 12000)
    return () => {
      stop = true
      window.clearInterval(timer)
    }
  }, [chatId, open, signedIn])

  useEffect(() => {
    if (open) setSeen(Date.now())
  }, [open, messages])

  useEffect(() => {
    const node = scroller.current
    if (!node) return
    node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' })
  }, [messages, typing, open])

  const unread = !open && messages.some((message) => message.role === 'admin' && message.at > seen)

  async function ensureChat() {
    if (chatId) return chatId
    const created = await api<{ id: string }>('/api/chats', {
      method: 'POST',
      body: JSON.stringify({ lang }),
    })
    localStorage.setItem(storageKey, created.id)
    setChatId(created.id)
    return created.id
  }

  async function send(raw: string, preset?: (typeof faqs)[number]) {
    const value = raw.trim()
    if (!value || typing) return
    if (!signedIn) {
      setNotice(t.chatNeedLogin)
      return
    }
    setText('')
    setNotice('')
    const matched = preset || matchFaq(value)
    try {
      const id = await ensureChat()
      if (matched) {
        setTyping(true)
        await new Promise((resolve) => window.setTimeout(resolve, 700))
        const chat = await api<Chat>(`/api/chats/${id}/messages`, {
          method: 'POST',
          body: JSON.stringify({ text: value, answer: t[faqAnswer[matched]], lang }),
        })
        setMessages(chat.messages)
        setTyping(false)
        return
      }
      const chat = await api<Chat>(`/api/chats/${id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ text: value, lang }),
      })
      setMessages(chat.messages)
      setNotice(t.chatSent)
    } catch (error) {
      setTyping(false)
      if (error instanceof ApiError && error.code === 'auth_required') {
        setSignedIn(false)
        setNotice(t.chatNeedLogin)
        return
      }
      if (error instanceof ApiError && error.code === 'not_found') {
        localStorage.removeItem(storageKey)
        setChatId('')
        setMessages([])
      }
      setNotice(t.error)
    }
  }

  return (
    <>
      <button type="button" className={`chat-launcher ${open ? 'open' : ''}`} ref={launcherRef} onClick={() => setOpen((value) => !value)} aria-label={t.chatOpen}>
        <span className="pulse" />
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 6.5A3.5 3.5 0 0 1 8.5 3h7A3.5 3.5 0 0 1 19 6.5v6A3.5 3.5 0 0 1 15.5 16H12l-4.2 3.2c-.7.5-1.8 0-1.8-.9V16A3.5 3.5 0 0 1 5 12.5v-6Z" />
        </svg>
        {unread ? <i /> : null}
      </button>
      <AnimatePresence>
        {open ? (
          <motion.section
            className="chat-panel"
            ref={panelRef}
            role="dialog"
            aria-label={t.chatTitle}
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          >
            <header>
              <div>
                <strong>{t.chatTitle}</strong>
                <em>{t.footerHoursValue}</em>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label={t.close}>
                ×
              </button>
            </header>
            <div className="thread" ref={scroller}>
              <p className="bubble bot">{t.chatHello}</p>
              {messages.map((message) => (
                <p key={message.id} className={`bubble ${message.role === 'user' ? 'user' : message.role}`}>
                  {message.text}
                </p>
              ))}
              {typing ? (
                <p className="bubble bot typing" aria-label={t.loading}>
                  <span />
                  <span />
                  <span />
                </p>
              ) : null}
            </div>
            {signedIn === null ? null : signedIn ? (
              <div className="chips">
                {faqs.map((id) => (
                  <button key={id} type="button" onClick={() => send(t[faqLabel[id]], id)}>
                    {t[faqLabel[id]]}
                  </button>
                ))}
              </div>
            ) : null}
            {notice ? <p className="chat-note">{notice}</p> : null}
            {signedIn === null ? null : signedIn ? (
              <form
                className="composer"
                onSubmit={(event) => {
                  event.preventDefault()
                  void send(text)
                }}
              >
                <input value={text} onChange={(event) => setText(event.target.value)} placeholder={t.chatPlaceholder} aria-label={t.chatPlaceholder} />
                <button type="submit">{t.chatSend}</button>
              </form>
            ) : (
              <div className="chat-gate">
                <p>{t.chatNeedLogin}</p>
                <Link to="/buyurtmalarim">{t.chatLogin}</Link>
              </div>
            )}
          </motion.section>
        ) : null}
      </AnimatePresence>
    </>
  )
}
