import type { Lang } from './types'

export const REGIONS: { id: string; uz: string; cyrl: string; ru: string; en: string }[] = [
  { id: 'tashkent-city', uz: 'Toshkent shahri', cyrl: 'Тошкент шаҳри', ru: 'г. Ташкент', en: 'Tashkent city' },
  { id: 'tashkent', uz: 'Toshkent viloyati', cyrl: 'Тошкент вилояти', ru: 'Ташкентская область', en: 'Tashkent region' },
  { id: 'andijan', uz: 'Andijon viloyati', cyrl: 'Андижон вилояти', ru: 'Андижанская область', en: 'Andijan region' },
  { id: 'bukhara', uz: 'Buxoro viloyati', cyrl: 'Бухоро вилояти', ru: 'Бухарская область', en: 'Bukhara region' },
  { id: 'fergana', uz: "Farg'ona viloyati", cyrl: 'Фарғона вилояти', ru: 'Ферганская область', en: 'Fergana region' },
  { id: 'jizzakh', uz: 'Jizzax viloyati', cyrl: 'Жиззах вилояти', ru: 'Джизакская область', en: 'Jizzakh region' },
  { id: 'khorezm', uz: 'Xorazm viloyati', cyrl: 'Хоразм вилояти', ru: 'Хорезмская область', en: 'Khorezm region' },
  { id: 'namangan', uz: 'Namangan viloyati', cyrl: 'Наманган вилояти', ru: 'Наманганская область', en: 'Namangan region' },
  { id: 'navoi', uz: 'Navoiy viloyati', cyrl: 'Навоий вилояти', ru: 'Навоийская область', en: 'Navoi region' },
  { id: 'kashkadarya', uz: 'Qashqadaryo viloyati', cyrl: 'Қашқадарё вилояти', ru: 'Кашкадарьинская область', en: 'Kashkadarya region' },
  { id: 'samarkand', uz: 'Samarqand viloyati', cyrl: 'Самарқанд вилояти', ru: 'Самаркандская область', en: 'Samarkand region' },
  { id: 'syrdarya', uz: 'Sirdaryo viloyati', cyrl: 'Сирдарё вилояти', ru: 'Сырдарьинская область', en: 'Syrdarya region' },
  { id: 'surkhandarya', uz: 'Surxondaryo viloyati', cyrl: 'Сурхондарё вилояти', ru: 'Сурхандарьинская область', en: 'Surkhandarya region' },
  { id: 'karakalpakstan', uz: "Qoraqalpog'iston", cyrl: 'Қорақалпоғистон', ru: 'Каракалпакстан', en: 'Karakalpakstan' },
]

const langKey: Record<Lang, 'uz' | 'cyrl' | 'ru' | 'en'> = {
  uz: 'uz',
  'uz-cyrl': 'cyrl',
  ru: 'ru',
  en: 'en',
}

export function regionLabel(id: string, lang: Lang) {
  const row = REGIONS.find((item) => item.id === id)
  return row ? row[langKey[lang]] : ''
}
