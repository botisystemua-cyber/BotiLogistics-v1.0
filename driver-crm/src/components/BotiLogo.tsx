export function BotiLogo({ size = 'lg', onDark = false }: { size?: 'sm' | 'md' | 'lg'; onDark?: boolean }) {
  const sizes = {
    sm: 'text-xl',
    md: 'text-3xl',
    lg: 'text-5xl',
  };

  return (
    <h1 className={`${sizes[size]} font-black tracking-tight select-none`}>
      <span className={onDark ? 'text-white' : 'text-text'}>Boti</span>
      <span className="text-brand">Logistics</span>
    </h1>
  );
}
