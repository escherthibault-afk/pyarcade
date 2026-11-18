export function Stars({ n, max = 3, size = 'text-base', className = '' }: { n: number; max?: number; size?: string; className?: string }) {
  return (
    <span className={`inline-flex gap-0.5 ${size} ${className}`} aria-label={`${n} étoile${n > 1 ? 's' : ''} sur ${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={i < n ? 'text-gold' : 'opacity-25 grayscale'}>
          ★
        </span>
      ))}
    </span>
  )
}
