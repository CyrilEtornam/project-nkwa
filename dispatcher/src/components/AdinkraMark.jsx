// Adinkrahene — three concentric circles, the "chief of adinkra". The shared
// Nkwa mark: on this console it doubles as the live-signal motif.
export default function AdinkraMark({ className }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <circle cx="24" cy="24" r="6.5" fill="currentColor" />
      <circle cx="24" cy="24" r="14" fill="none" stroke="currentColor" strokeWidth="3.5" />
      <circle cx="24" cy="24" r="21.5" fill="none" stroke="currentColor" strokeWidth="3.5" />
    </svg>
  )
}
