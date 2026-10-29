import type { Lang } from './types'

const locale: Record<Lang, string> = {
  uz: 'uz-UZ',
  'uz-cyrl': 'uz-UZ',
  ru: 'ru-RU',
  en: 'en-GB',
}

export function formatPrice(value: number, lang: Lang, currency: string) {
  const amount = new Intl.NumberFormat(locale[lang]).format(value)
  return `${amount} ${currency}`
}

export function formatWhen(value: number, lang: Lang) {
  return new Intl.DateTimeFormat(locale[lang], {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(value)
}
