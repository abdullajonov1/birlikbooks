import { useI18n } from '../context/LanguageContext'

export function Delivery() {
  const { t } = useI18n()
  const rows = [
    [t.delivery1t, t.delivery1d],
    [t.delivery2t, t.delivery2d],
    [t.delivery3t, t.delivery3d],
    [t.deliveryPay, t.deliveryPayD],
  ]

  return (
    <main className="wrap page">
      <div className="section-head">
        <h1>{t.deliveryTitle}</h1>
      </div>
      <div className="info-grid">
        {rows.map(([title, text]) => (
          <article key={title}>
            <h2>{title}</h2>
            <p>{text}</p>
          </article>
        ))}
      </div>
    </main>
  )
}
