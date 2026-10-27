// The browser side of the bag: one Hydrogen cart store per page, mirrored into a nanostore so
// every island (bag button, drawer, product forms, /cart) reads the same state.
// Client-safe: no env and no gql here.
import {
  configureCartEndpoint,
  createCartFormRegister,
  createCartStore,
  EMPTY_CART_STATE,
  initializeShopifyScripts,
  type CartState,
  type CartStore,
} from '@shopify/hydrogen'
import { atom } from 'nanostores'
import { routeTemplates } from './market'

export const CART_DRAWER_ID = 'cart-drawer'
export const $cart = atom<CartState>(EMPTY_CART_STATE)
export const register = createCartFormRegister()

type InitialData = { cart: Parameters<CartStore['hydrate']>[0] | null }
let store: CartStore | undefined

/**
 * The page's cart store, created on first use. A page with no `cart` cookie starts from an empty
 * cart and makes no request; a page with one loads it from /api/cart. The first caller's initial
 * data wins (the /cart page passes the cart it rendered on the server).
 */
export function cartStore(initialData?: InitialData): CartStore {
  if (store) return store
  const browser = typeof document !== 'undefined'
  // ponytail: a returning shopper's page view costs one /api/cart call to show the count; a
  // count cookie written by the Worker would skip it if the Workers request cap ever matters.
  const hasCart = browser && /(?:^|;\s*)cart=[^;]/.test(document.cookie)
  if (browser) configureCartEndpoint('/api/cart')
  store = createCartStore({ initialData: initialData ?? (hasCart ? undefined : { cart: null }) })
  if (browser) {
    store.subscribe((state) => $cart.set(state))
    store.connect()
  }
  $cart.set(store.getState())
  return store
}

/** Native form submit → the cart store (the form still posts to /api/cart without JS). */
export function submitCart(event: Event) {
  event.preventDefault()
  void cartStore().handleFormSubmit(event as SubmitEvent)
}

function drawer() {
  const el = typeof document !== 'undefined' ? document.getElementById(CART_DRAWER_ID) : null
  return el instanceof HTMLDialogElement ? el : null
}
export function openCartDrawer() {
  const el = drawer()
  if (el && !el.open) el.showModal()
}
export const closeCartDrawer = () => drawer()?.close()

// Shopify's runtime (window.Shopify.actions) loads as a module script; wire it once it exists,
// so `Shopify.actions.openCart()` opens our drawer (hydrogen-cart-drawer).
let wired = false
function wireShopify() {
  const actions = typeof window !== 'undefined' ? window.Shopify?.actions : undefined
  if (wired || !actions?.openCart) return false
  actions.openCart.configure({ handler: async () => openCartDrawer() })
  void initializeShopifyScripts({ routes: routeTemplates, webMcp: false })
  wired = true
  return true
}
if (typeof document !== 'undefined' && !wireShopify()) {
  window.addEventListener('load', () => wireShopify(), { once: true })
}
