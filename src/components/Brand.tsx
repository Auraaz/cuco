const LOGO = `${import.meta.env.BASE_URL}brand/logo.png`

/** The StudioERP logo mark on its own (blue/green monogram). */
export function BrandMark({ size = 26 }: { size?: number }) {
  return (
    <img
      className="brand-mark"
      src={LOGO}
      alt="StudioERP"
      style={{ height: size }}
      draggable={false}
    />
  )
}

/**
 * Full brand lockup — mark + "StudioERP Article Creator" wordmark.
 * `bar` is the compact top-nav form; `hero` is the large home-page form.
 */
export function BrandLockup({
  variant = 'bar',
  showSub = true,
}: {
  variant?: 'bar' | 'hero'
  showSub?: boolean
}) {
  return (
    <span className={`brand-lockup ${variant}`}>
      <BrandMark size={variant === 'hero' ? 46 : 24} />
      <span className="brand-words">
        <span className="brand-name">
          Studio<span className="brand-erp">ERP</span>
        </span>
        {showSub && <span className="brand-sub">Article Creator</span>}
      </span>
    </span>
  )
}
