import { useState, type CSSProperties, type SyntheticEvent } from 'react'
import { pick } from '../types'
import type { Book, Lang } from '../types'

function edgeColor(image: HTMLImageElement, width: number, height: number) {
  if (!image.naturalWidth || !image.naturalHeight || width < 1 || height < 1) return ''
  const canvas = document.createElement('canvas')
  canvas.width = 8
  canvas.height = Math.max(1, Math.round(height))
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return ''
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight)
  const drawnWidth = image.naturalWidth * scale
  const drawnHeight = image.naturalHeight * scale
  context.drawImage(image, (width - drawnWidth) / 2, (height - drawnHeight) / 2, drawnWidth, drawnHeight)
  let red = 0
  let green = 0
  let blue = 0
  let count = 0
  const pixels = context.getImageData(0, 0, 2, canvas.height).data
  for (let index = 0; index < pixels.length; index += 4) {
    if (pixels[index + 3] < 20) continue
    red += pixels[index]
    green += pixels[index + 1]
    blue += pixels[index + 2]
    count += 1
  }
  if (!count) return ''
  return `rgb(${Math.round(red / count)}, ${Math.round(green / count)}, ${Math.round(blue / count)})`
}

export function BookCover({ book, lang, className = '' }: { book: Book; lang: Lang; className?: string }) {
  const title = pick(book.title, lang)
  const author = pick(book.author, lang)
  const [sampled, setSampled] = useState<{ src: string; color: string } | null>(null)
  const cloth = book.image && sampled?.src === book.image ? sampled.color : book.cover || '#1b4332'
  const style = { '--cloth': cloth } as CSSProperties

  function matchSpine(event: SyntheticEvent<HTMLImageElement>) {
    const image = event.currentTarget
    const face = image.parentElement
    if (!face || !book.image) return
    const next = edgeColor(image, face.clientWidth, face.clientHeight)
    if (next) setSampled({ src: book.image, color: next })
  }

  return (
    <div className={`tome ${book.image ? 'has-photo' : ''} ${className}`} style={style} data-kind={book.category}>
      <div className="tome-spine" aria-hidden="true" />
      <div className="tome-face">
        {book.image ? <img src={book.image} alt="" onLoad={matchSpine} /> : null}
        <span>{author}</span>
        <strong>{title}</strong>
        <i aria-hidden="true" />
        <em>Birlik</em>
      </div>
    </div>
  )
}
