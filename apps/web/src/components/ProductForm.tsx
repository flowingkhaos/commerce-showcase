// Variant pills, price, stock and Add to bag over Hydrogen's product form store
// (hydrogen-variant-form). Two layouts from the boards: the product page's pinned buy box, and a
// home half tile. Selection is local (no network): Shopify's encoded existence/availability
// fields say which pills exist and which are sold out.
import {
  buildProductSelectionSearchParams,
  canAddToCart,
  createCartStore,
  createProductFormRegister,
  createProductFormStore,
  getSelectedProductOptions,
  type SelectedOption,
} from '@shopify/hydrogen'
import { useEffect, useId, useState } from 'preact/hooks'
import { t, type Locale } from '../i18n'
import { cartStore, openCartDrawer } from '../lib/cart'
import { ghost, price, swatch } from '../lib/format'
import type { FormProduct } from '../lib/shopify'

type Props = {
  product: FormProduct
  locale: Locale
  layout: 'buy' | 'half'
  /** The product page path, for option links (buy layout). */
  path: string
}

const plainClick = (e: MouseEvent) =>
  !e.defaultPrevented && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey

export default function ProductForm({ product, locale, layout, path }: Props) {
  const browser = typeof document !== 'undefined'
  // On the server the store only renders the first state; it must not share the page's cart store.
  const [store] = useState(() =>
    createProductFormStore(product, browser ? cartStore() : createCartStore({ initialData: { cart: null } })),
  )
  const [state, setState] = useState(() => store.getState())
  const optionNames = product.options.map((o) => o.name)
  const buy = layout === 'buy'

  useEffect(() => {
    store.connect()
    const off = store.subscribe(setState)
    // A prerendered page is one HTML for every selection: apply the URL's options in the browser.
    if (buy) {
      const searchParams = new URLSearchParams(location.search)
      for (const o of getSelectedProductOptions({ searchParams, allowedOptionNames: optionNames })) store.selectOption(o.name, o.value)
    }
    return () => {
      off()
      store.destroy()
    }
  }, [])

  const hrefFor = (selectedOptions: SelectedOption[]) => {
    const base = new URLSearchParams(browser ? location.search : '')
    const params = buildProductSelectionSearchParams({ selectedOptions, optionNames, base })
    return params.size ? `${path}?${params}` : path
  }
  const select = (name: string, value: string) => {
    const result = store.selectOption(name, value)
    // The URL is the durable selection: replace the entry, keep the scroll (no reload needed,
    // every variant is already in the page).
    if (buy && result.status !== 'invalid') history.replaceState(history.state, '', hrefFor(result.selectedOptions))
  }

  const uid = useId()
  const ml = t(locale, 'moneyLocale')
  const v = state.selectedVariant
  const money = v?.price ?? product.priceRange.minVariantPrice
  const amount = price(money, ml, true)
  const available = v ? v.availableForSale : product.availableForSale
  const addable = canAddToCart(product, state.options)
  const register = createProductFormRegister(v, select)
  const picker = state.options.some((o) => o.values.length > 1)
  const pick = picker ? state.selectedOptions.map((o) => o.value).join(' · ') : ''
  const errors = [...state.errors.userErrors, ...state.errors.networkErrors].map((e) => e.message)

  const priceLine = (
    <p class="price" data-owner="Shopify">
      <span class="readout" data-ghost={ghost(amount)}><span>{amount}</span></span>
      {money.currencyCode}
    </p>
  )
  const stockLine = (
    <p class="stock" data-owner="Shopify">
      <span class={available ? 'led led--green' : 'led led--yellow'} aria-hidden="true" />
      {available ? t(locale, buy ? 'inStockTest' : 'inStock') : t(locale, 'soldOut')}
    </p>
  )

  const groups = state.options.map((o, i) => {
    const labelId = `${uid}-o${i}`
    const chosen = o.values.find((x) => x.selected)?.name ?? ''
    return (
      <div>
        <p class="label" id={labelId}>{o.name} <b>{chosen}</b></p>
        <div class="keys" role={buy ? 'group' : 'radiogroup'} aria-labelledby={labelId}>
          {o.values.map((x) => {
            const sw = swatch(x.name, (x.swatch as { color?: string | null } | null)?.color)
            const mark = sw ? <span class="sw" style={`--sw: ${sw}`} aria-hidden="true" /> : <span class="led" aria-hidden="true" />
            const cls = x.available ? 'key' : 'key is-out'
            const label = x.available ? x.name : `${x.name}, ${t(locale, 'soldOut')}`
            // A combination that doesn't exist can't be picked (disabled); sold out stays pickable.
            if (!x.exists)
              return <button class="key" type="button" disabled aria-pressed={x.selected}>{mark}{x.name}</button>
            if (buy)
              return (
                <a
                  class={cls}
                  href={hrefFor(x.selectedOptions)}
                  aria-current={x.selected ? 'true' : undefined}
                  aria-label={label}
                  onClick={(e) => {
                    if (!plainClick(e)) return
                    e.preventDefault()
                    select(o.name, x.name)
                  }}
                >
                  {mark}{x.name}
                </a>
              )
            return (
              <button class={cls} type="button" role="radio" aria-checked={x.selected} aria-label={label} onClick={() => select(o.name, x.name)}>
                {mark}{x.name}
              </button>
            )
          })}
        </div>
      </div>
    )
  })

  const form = (
    <form
      method="post"
      action="/api/cart"
      onSubmit={(e) => {
        e.preventDefault()
        if (!addable) return
        // Open first so the pending line is visible while Shopify answers (hydrogen-cart-drawer).
        openCartDrawer()
        void store.handleFormSubmit(e as SubmitEvent)
      }}
    >
      <input type="hidden" {...register('merchandiseId', {})} />
      <input type="hidden" {...register('quantity', { value: 1 })} />
      <button {...register('addToCart', {})} class={buy ? 'add add--wide' : 'add'} aria-haspopup="dialog" data-owner="Shopify" disabled={!addable}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M8 3v10M3 8h10" /></svg>
        {addable ? t(locale, 'addToBag') : v ? t(locale, 'soldOut') : t(locale, 'selectOptions')}
        {pick && <span class="add__pick">{pick}</span>}
      </button>
      {errors.map((message) => (
        <p class="flag" role="alert"><span class="led led--yellow" aria-hidden="true" />{message}</p>
      ))}
    </form>
  )

  if (buy)
    return (
      <>
        {priceLine}
        {stockLine}
        {picker && <div class="variants" data-owner="Shopify">{groups}</div>}
        {form}
      </>
    )
  return (
    <>
      <div class="buyline">{priceLine}{stockLine}</div>
      {picker && <div class="picks" data-owner="Shopify">{groups}</div>}
      {form}
    </>
  )
}
