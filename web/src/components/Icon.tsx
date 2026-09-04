import clsx from 'clsx'

export function Icon({
  name,
  className,
  filled,
}: {
  name: string
  className?: string
  filled?: boolean
}) {
  return (
    <span
      className={clsx(
        'material-symbols-outlined inline-flex select-none',
        filled && 'filled',
        className,
      )}
      aria-hidden
    >
      {name}
    </span>
  )
}
