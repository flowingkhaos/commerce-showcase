// The Rack Drawer (R3bRackDrawer board) and the bag button: Preact islands over Hydrogen's cart
// store. Line forms keep Hydrogen's progressive contract (hydrogen-cart-ui): each line is its own
// form posting to /api/cart, with a hidden `set` submit first and a real quantity input.
import { useStore } from '@nanostores/preact'
import { attachQuantityInput, EMPTY_CART_STATE, type CartLine, type CartState } from '@shopify/hydrogen'
import { useEffect, useRef } from 'preact/hooks'
import { localePath, t, type Locale } from '../i18n'
import { $cart, CART_DRAWER_ID, cartStore, closeCartDrawer, openCartDrawer, register, submitCart } from '../lib/cart'
import { ghost, price, shopifyImageUrl } from '../lib/format'
import Hud from './Hud'

type InitialData = Parameters<typeof cartStore>[0]

// The server renders from the cart it was handed; the browser reads the page's one store.
// Never a store on the server: a Worker isolate serves many shoppers.
function useCartState(initial?: InitialData): CartState {
  const browser = typeof document !== 'undefined'
  if (browser) cartStore(initial)
  const live = useStore($cart)
  if (!browser && initial) return { ...EMPTY_CART_STATE, loading: false, data: initial.cart ?? EMPTY_CART_STATE.data }
  return live
}

const pad = (n: number) => String(n).padStart(2, '0')
const countText = (locale: Locale, n: number) => (n === 1 ? t(locale, 'bagCountOne') : t(locale, 'bagCount', { n }))
const Minus = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M3 8h10" /></svg>
)
const Plus = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M8 3v10M3 8h10" /></svg>
)

export function BagButton({ locale }: { locale: Locale }) {
  const n = useCartState().data.totalQuantity
  return (
    <a
      class="bag"
      href={localePath(locale, '/cart')}
      aria-controls={CART_DRAWER_ID}
      aria-haspopup="dialog"
      onClick={(e) => {
        // Before hydration (or without JS) the link opens the full /cart page.
        e.preventDefault()
        openCartDrawer()
      }}
    >
      {t(locale, 'bag')}{' '}
      <span class="bag__count" data-owner="Shopify">
        <Hud o="Shopify" f="cart.totalQuantity" at="below-end" />
        <span aria-hidden="true">{pad(n)}</span>
        <span class="sr-only">, {countText(locale, n)}</span>
      </span>
    </a>
  )
}

function Line({ line, i, locale, pending, errors }: { line: CartLine; i: number; locale: Locale; pending: boolean; errors: string[] }) {
  const qty = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const input = qty.current
    return input?.form ? attachQuantityInput(input, input.form) : undefined
  }, [])
  const m = line.merchandise
  const ml = t(locale, 'moneyLocale')
  const out = m?.availableForSale === false
  const name = m?.product.title ?? m?.title ?? ''
  const opts = (m?.selectedOptions ?? []).filter((o) => o.value !== 'Default Title').map((o) => o.value).join(' · ')
  const total = price(line.cost.totalAmount, ml)
  return (
    <li class={out ? 'line is-out' : 'line'} style={`--i:${i}`}>
      <div class="line__th" data-owner="Shopify">
        <div class="ph">
          {m?.image ? (
            <img src={shopifyImageUrl(m.image.url, 128)} alt="" width={64} height={80} loading="lazy" />
          ) : (
            <span class="ph__none" aria-hidden="true">{t(locale, 'noPhoto')}</span>
          )}
        </div>
      </div>
      <div class="line__main" data-owner="Shopify">
        <h3 class="line__name">
          {m?.product.handle ? <a href={localePath(locale, `/products/${m.product.handle}`)}>{name}</a> : name}
        </h3>
        {opts && <p class="line__var">{opts}</p>}
        <p class="line__var">{price(line.cost.amountPerQuantity, ml)} {t(locale, 'each')}</p>
        {out && (
          <p class="flag"><span class="led led--yellow" aria-hidden="true" />{t(locale, 'notAvailable')}</p>
        )}
        {errors.map((message) => (
          <p class="flag" role="alert"><span class="led led--yellow" aria-hidden="true" />{message}</p>
        ))}
      </div>
      {out ? (
        <p class="readout line__tot" data-owner="Shopify"><span aria-hidden="true">—</span><span class="sr-only">{t(locale, 'notCounted')}</span></p>
      ) : (
        <p class={pending ? 'readout line__tot is-pending' : 'readout line__tot'} data-ghost={ghost(total)} data-owner="Shopify"><span>{total}</span></p>
      )}
      <form class="line__ctl" method="post" action="/api/cart" onSubmit={submitCart}>
        <button {...register('set')} />
        <input type="hidden" {...register('lineId', { value: line.id })} />
        {!out && (
          <div class="step" role="group" aria-label={t(locale, 'quantityOf', { name })} data-owner="Shopify">
            <button {...register('decrease')} type="submit" aria-label={t(locale, 'oneLess')} disabled={line.quantity <= 1}><Minus /></button>
            <input
              ref={qty}
              {...register('quantity', { value: line.quantity, interactive: true })}
              class={pending ? 'is-pending' : undefined}
              aria-label={t(locale, 'quantityOf', { name })}
            />
            <button {...register('increase')} type="submit" aria-label={t(locale, 'oneMore')}><Plus /></button>
          </div>
        )}
        <button {...register('remove')} type="submit" class="rm">
          {t(locale, 'remove')}<span class="sr-only"> {name}</span>
        </button>
      </form>
    </li>
  )
}

function BagView({ locale, state, drawer }: { locale: Locale; state: CartState; drawer: boolean }) {
  const { data } = state
  const lines = data.lines.nodes
  const n = data.totalQuantity
  const ml = t(locale, 'moneyLocale')
  const sub = price(data.cost.subtotalAmount, ml)
  const totalsPending = state.pending.cost === true || state.revalidating
  const anyOut = lines.some((l) => l.merchandise?.availableForSale === false)
  // ponytail: no dismiss on the banner; errors clear on the next change (cart-ui allows inline-first).
  const banner = [...state.errors.network.map((e) => e.message), ...state.errors.cart.userErrors.map((e) => e.message)]
  const Title = drawer ? 'h2' : 'h1'
  return (
    <>
      <header class="dr-head">
        <Title id={drawer ? 'bag-h' : 'bag-page-h'}>{t(locale, 'bag')}</Title>
        <p class="readout" data-ghost="88" data-owner="Shopify"><span>{pad(n)}</span><span class="sr-only"> {countText(locale, n)}</span></p>
        {drawer && (
          <button class="dr-x" type="button" aria-label={t(locale, 'closeBag')} onClick={closeCartDrawer}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" /></svg>
          </button>
        )}
      </header>
      {banner.length > 0 && <p class="errs" role="alert">{banner.join(' ')}</p>}
      {state.loading && !lines.length ? (
        <div class="empty"><p role="status">{t(locale, 'loadingBag')}</p></div>
      ) : !lines.length ? (
        <div class="empty">
          <div class="meter meter--zero" aria-hidden="true">{Array.from({ length: 14 }, () => <span class="seg" />)}</div>
          <h3>{t(locale, 'emptyTitle')}</h3>
          <p>{t(locale, 'emptyText')}</p>
          <div class="empty__go">
            <a href={localePath(locale, '/collections/equipment')}><span class="led" aria-hidden="true" />{t(locale, 'shopEquipment')}</a>
            <a href={localePath(locale, '/collections/apparel')}><span class="led" aria-hidden="true" />{t(locale, 'shopApparel')}</a>
          </div>
        </div>
      ) : (
        <>
          <div class="dr-body">
            {anyOut && (
              <div class="notice" role="status"><span class="led led--yellow" aria-hidden="true" /><p><b>{t(locale, 'bagChanged')}</b> {t(locale, 'bagChangedNote')}</p></div>
            )}
            <ul class="rack" aria-label={t(locale, 'bagItems')}>
              {lines.map((line, i) => (
                <Line
                  key={line.id}
                  line={line}
                  i={i}
                  locale={locale}
                  pending={state.pending.lines.has(line.id)}
                  errors={(state.errors.lines.get(line.id)?.userErrors ?? []).map((e) => e.message)}
                />
              ))}
            </ul>
          </div>
          <footer class="dr-foot">
            <div class="ledger">
              <p class="ledger__row">
                <span class="ledger__k">{t(locale, 'subtotal')}</span>
                <span class="ledger__lead" aria-hidden="true" />
                <output class={totalsPending ? 'readout ledger__v is-pending' : 'readout ledger__v'} data-ghost={ghost(sub)} data-owner="Shopify"><span>{sub}</span></output>
              </p>
              <p class="ledger__note">
                <span class="src"><span class="led led--green" aria-hidden="true" />{t(locale, 'fromShopify')}</span>
                <span>{countText(locale, n)}</span>
                <span>{t(locale, 'taxesNote')}</span>
              </p>
            </div>
            <a class="checkout" href={data.checkoutUrl ?? '/checkout'} data-owner="Shopify">
              <span class="checkout__go">
                {t(locale, 'checkout')}
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 11l6-6M6 5h5v5" /></svg>
              </span>
              <small>{t(locale, 'checkoutNote')}</small>
            </a>
            {drawer ? (
              <button class="keep" type="button" onClick={closeCartDrawer}>{t(locale, 'keepShopping')}</button>
            ) : (
              <a class="keep ghost" href={localePath(locale, '/')}>{t(locale, 'keepShopping')}</a>
            )}
          </footer>
        </>
      )}
      <p class="sr-only" role="status">{state.loading ? '' : countText(locale, n)}</p>
    </>
  )
}

/** Rendered once in the layout; every page can open it. */
export default function CartDrawer({ locale, initialData }: { locale: Locale; initialData?: InitialData }) {
  const state = useCartState(initialData)
  return (
    <dialog id={CART_DRAWER_ID} class="drawer" aria-labelledby="bag-h" {...{ closedby: 'any' }}>
      <BagView locale={locale} state={state} drawer />
    </dialog>
  )
}

/** The full /cart page: the drawer's fallback, rendered on the server from the real cart. */
export function CartPage({ locale, initialData }: { locale: Locale; initialData: InitialData }) {
  return (
    <div class="cartpage">
      <BagView locale={locale} state={useCartState(initialData)} drawer={false} />
    </div>
  )
}
