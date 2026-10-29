import { getState, mutate } from './store.js'

function configured() {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID)
}

export function telegramStatus() {
  return { configured: configured() }
}

async function api(method, body) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await response.json()
  if (!data.ok) throw new Error(data.description || 'telegram')
  return data.result
}

export async function notifyAdmin(text) {
  if (!configured()) return null
  const result = await api('sendMessage', {
    chat_id: process.env.TELEGRAM_CHAT_ID,
    text: text.slice(0, 4000),
  })
  return result.message_id
}

function pushAdminMessage(chat, text) {
  chat.messages.push({
    id: `msg_${Date.now().toString(36)}`,
    role: 'admin',
    text: text.slice(0, 2000),
    at: Date.now(),
  })
  chat.unread = false
}

function personLabel(customer) {
  if (!customer) return 'ro‘yxatdan o‘tmagan'
  const name = [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim()
  const user = customer.username ? `@${customer.username}` : ''
  return [name, user].filter(Boolean).join(' ') || 'Telegram'
}

function labelOf(state, chat) {
  const customer = (state.customers || []).find((item) => item.id === String(chat.customerId || ''))
  return personLabel(customer)
}

function attachReply(messageId, text) {
  const clean = text.trim()
  if (!clean) return ''
  let label = ''
  mutate((state) => {
    const chat = state.chats.find((item) => item.telegramIds?.includes(messageId))
    if (!chat) return
    pushAdminMessage(chat, clean)
    label = labelOf(state, chat)
  })
  return label
}

function attachOnlyWaiting(text) {
  const clean = text.trim()
  if (!clean) return { sent: false, many: false, label: '' }
  let result = { sent: false, many: false, label: '' }
  mutate((state) => {
    const waiting = state.chats.filter((item) => item.unread)
    if (waiting.length !== 1) {
      result = { sent: false, many: waiting.length > 1, label: '' }
      return
    }
    pushAdminMessage(waiting[0], clean)
    result = { sent: true, many: false, label: labelOf(state, waiting[0]) }
  })
  return result
}

let polling = false
let botId = ''

export async function telegramBotId() {
  if (botId) return botId
  const me = await api('getMe', {})
  botId = String(me.id)
  return botId
}

function rememberCustomer(from, chatId) {
  const id = String(from.id)
  mutate((state) => {
    state.customers ??= []
    let customer = state.customers.find((item) => item.id === id)
    if (!customer) {
      customer = { id, firstName: '', lastName: '', phone: '', extraPhone: '', email: '', region: '', district: '', street: '', house: '', apartment: '', entrance: '', landmark: '' }
      state.customers.unshift(customer)
    }
    if (!customer.firstName && from.first_name) customer.firstName = String(from.first_name).slice(0, 40)
    if (!customer.lastName && from.last_name) customer.lastName = String(from.last_name).slice(0, 40)
    customer.username = from.username || customer.username || ''
    customer.chatId = chatId
  })
}

function saveContact(from, phone) {
  mutate((state) => {
    const customer = (state.customers || []).find((item) => item.id === String(from.id))
    if (customer) customer.phone = String(phone).slice(0, 20)
  })
}

async function askContact(chatId) {
  await api('sendMessage', {
    chat_id: chatId,
    text: "Birlik kabineti ochildi. Telefonni tasdiqlash uchun kontaktni yuboring.",
    reply_markup: {
      keyboard: [[{ text: 'Telefonni yuborish', request_contact: true }]],
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  })
}

export async function requestPhone(chatId) {
  if (!process.env.TELEGRAM_BOT_TOKEN || !chatId) return false
  await askContact(chatId)
  return true
}

async function pollOnce() {
  if (!configured()) return
  const offset = getState().telegramOffset || 0
  const updates = await api('getUpdates', { offset, timeout: 0, allowed_updates: ['message'] })
  let next = offset
  for (const update of updates) {
    next = update.update_id + 1
    const message = update.message
    if (!message || message.from?.is_bot) continue
    const adminChat = String(process.env.TELEGRAM_CHAT_ID)
    if (String(message.chat.id) === adminChat && message.text && !message.text.startsWith('/')) {
      const replyId = message.reply_to_message?.message_id
      const named = replyId ? attachReply(replyId, message.text) : ''
      const routed = named ? { sent: true, many: false, label: named } : replyId ? { sent: false, many: false, label: '' } : attachOnlyWaiting(message.text)
      const note = routed.sent
        ? `Javob ${routed.label} ga yuborildi.`
        : routed.many
          ? 'Bir nechta odam yozgan. Qaysi biriga ketishini bilish uchun uning xabariga reply qiling.'
          : replyId
            ? 'Bu xabar chatga bog‘lanmadi. Javobni uning xabariga reply qilib yozing.'
            : 'Hozircha javob kutayotgan chat yo‘q.'
      try {
        await api('sendMessage', {
          chat_id: message.chat.id,
          text: note,
        })
      } catch (error) {
        console.error('telegram reply', error.message)
      }
      continue
    }
    const start = String(message.text || '').match(/^\/start(?:@\w+)?(?:\s+\S+)?$/i)
    if (start && message.from) {
      rememberCustomer(message.from, message.chat.id)
      continue
    }
    if (message.contact && message.from && message.contact.user_id === message.from.id) {
      saveContact(message.from, message.contact.phone_number)
      try {
        await api('sendMessage', {
          chat_id: message.chat.id,
          text: 'Telefon tasdiqlandi. Saytga qayting.',
          reply_markup: { remove_keyboard: true },
        })
      } catch (error) {
        console.error('telegram contact', error.message)
      }
      continue
    }
    const replyId = message.reply_to_message?.message_id
    if (replyId && message.text) attachReply(replyId, message.text)
  }
  if (next !== offset) mutate((state) => {
    state.telegramOffset = next
  })
}

export function startTelegram() {
  if (!configured()) {
    console.log('Telegram sozlanmagan: chat saytda saqlanadi, botga yuborilmaydi.')
    return
  }
  setInterval(async () => {
    if (polling) return
    polling = true
    try {
      await pollOnce()
    } catch (error) {
      console.error('telegram poll', error.message)
    } finally {
      polling = false
    }
  }, 4000)
}
