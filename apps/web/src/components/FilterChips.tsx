// Collection filter chips (R4 Collection board): store code filters the prerendered grid in place,
// by product type. The grid stays server-rendered; without JS every product shows.
import { useEffect, useState } from 'preact/hooks'
import { t, type Locale } from '../i18n'

type Chip = { key: string; label: string; count: number }

export default function FilterChips({ chips, total, gridId, labelId, locale }: { chips: Chip[]; total: number; gridId: string; labelId: string; locale: Locale }) {
  const [on, setOn] = useState('all')
  useEffect(() => {
    const grid = document.getElementById(gridId)
    if (!grid) return
    // Filtered, every product takes a half tile (board rule: .row--grid.is-filtered).
    grid.classList.toggle('is-filtered', on !== 'all')
    for (const tile of grid.querySelectorAll<HTMLElement>('[data-type]'))
      tile.classList.toggle('is-hidden', on !== 'all' && tile.dataset.type !== on)
  }, [on])
  const current = chips.find((c) => c.key === on)
  return (
    <>
      <div class="chips" role="group" aria-labelledby={labelId} data-owner="Shopify">
        <button class="chip" type="button" aria-pressed={on === 'all'} onClick={() => setOn('all')}>
          <span class="led" aria-hidden="true" />{t(locale, 'all')} <b>{total}</b>
        </button>
        {chips.map((c) => (
          <button class="chip" type="button" aria-pressed={on === c.key} onClick={() => setOn(c.key)}>
            <span class="led" aria-hidden="true" />{c.label} <b>{c.count}</b>
          </button>
        ))}
      </div>
      <p class="chips__shown" role="status" data-owner="Code">
        {t(locale, 'shown', { n: current?.count ?? total, total })}
        {current ? ` · ${current.label}` : ''}
      </p>
    </>
  )
}
