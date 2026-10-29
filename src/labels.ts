import type { Copy } from './i18n'

export function categoryName(t: Copy, category: string) {
  if (category === 'children') return t.catChildren
  if (category === 'study') return t.catStudy
  if (category === 'business') return t.catBusiness
  if (category === 'psychology') return t.catPsychology
  return t.catFiction
}
