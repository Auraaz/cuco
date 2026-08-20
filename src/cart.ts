/**
 * Consumer cart persistence (localStorage). No backend — the cart is a
 * local list of customized-article snapshots with dummy pricing.
 */
import type { CartItem } from './types'

const CART_KEY = 'apparel-studio:cart:v1'

/** Flat demo price applied to every customized item. */
export const ITEM_PRICE = 100

const CART_LIMIT = 50

/** All cart items, most-recent first. */
export function readCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_KEY)
    const list = raw ? (JSON.parse(raw) as CartItem[]) : []
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function writeCart(list: CartItem[]) {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(list))
  } catch {
    /* Over quota — retry without preview thumbnails. */
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(list.map((i) => ({ ...i, thumb: '' }))))
    } catch {
      /* give up silently */
    }
  }
}

/** Add an item to the cart, prepending it. */
export function addToCartStore(item: CartItem): CartItem[] {
  const next = [item, ...readCart()].slice(0, CART_LIMIT)
  writeCart(next)
  return next
}

/** Remove one item by id. */
export function removeFromCart(id: string): CartItem[] {
  const next = readCart().filter((i) => i.id !== id)
  writeCart(next)
  return next
}

/** Empty the cart. */
export function clearCart(): CartItem[] {
  writeCart([])
  return []
}

/** Cart subtotal in whole dollars. */
export function cartTotal(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.price, 0)
}
