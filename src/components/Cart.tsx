import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStudio } from '../store'
import { cartTotal } from '../cart'
import { Close, Trash } from './Icons'

/**
 * Consumer shopping cart — a slide-in drawer listing each customized item
 * with its preview, the list of customizations, and a (dummy) price.
 */
export function Cart() {
  const open = useStudio((s) => s.cartOpen)
  const setOpen = useStudio((s) => s.setCartOpen)
  const cart = useStudio((s) => s.cart)
  const removeFromCart = useStudio((s) => s.removeFromCart)
  const clearCart = useStudio((s) => s.clearCart)
  const toast = useStudio((s) => s.toast)
  const [placed, setPlaced] = useState(false)

  const total = cartTotal(cart)

  const checkout = () => {
    if (cart.length === 0) return
    setPlaced(true)
    clearCart()
    toast('Order placed (demo)')
    window.setTimeout(() => setPlaced(false), 2600)
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="cart-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false)
          }}
        >
          <motion.aside
            className="cart-drawer"
            role="dialog"
            aria-label="Cart"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <header className="cart-head">
              <h2>
                Your cart <span className="browse-count">{cart.length}</span>
              </h2>
              <button className="icon-btn lg" aria-label="Close cart" onClick={() => setOpen(false)}>
                <Close />
              </button>
            </header>

            {cart.length === 0 ? (
              <div className="cart-empty">
                {placed ? (
                  <>
                    <span className="model-dropzone-emoji" aria-hidden>✅</span>
                    <strong>Order placed</strong>
                    <p>Thanks! This is a demo checkout — nothing was charged.</p>
                  </>
                ) : (
                  <>
                    <span className="model-dropzone-emoji" aria-hidden>🛒</span>
                    <strong>Your cart is empty</strong>
                    <p>Customize an article and choose <strong>Add to cart</strong> to see it here.</p>
                  </>
                )}
              </div>
            ) : (
              <>
                <div className="cart-items">
                  {cart.map((item) => (
                    <div key={item.id} className="cart-item">
                      {item.thumb ? (
                        <img className="cart-thumb" src={item.thumb} alt="" />
                      ) : (
                        <span className="cart-thumb ph" aria-hidden>🧢</span>
                      )}
                      <div className="cart-item-body">
                        <div className="cart-item-top">
                          <strong className="cart-item-name">{item.articleName}</strong>
                          <button
                            className="icon-btn cart-remove"
                            aria-label={`Remove ${item.articleName}`}
                            title="Remove"
                            onClick={() => removeFromCart(item.id)}
                          >
                            <Trash size={16} />
                          </button>
                        </div>
                        <ul className="cart-customs">
                          {item.customizations.map((c, i) => (
                            <li key={i}>{c}</li>
                          ))}
                        </ul>
                        <span className="cart-price">${item.price.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <footer className="cart-foot">
                  <div className="cart-total-row">
                    <span>Subtotal</span>
                    <strong>${total.toFixed(2)}</strong>
                  </div>
                  <p className="cart-note">Demo pricing — a flat ${cart[0]?.price ?? 100} per item.</p>
                  <button className="primary-btn full" onClick={checkout}>
                    Checkout · ${total.toFixed(2)}
                  </button>
                  <button className="menu-text-btn" onClick={clearCart}>
                    Clear cart
                  </button>
                </footer>
              </>
            )}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
