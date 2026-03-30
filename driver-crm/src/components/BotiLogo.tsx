export function BotiLogo({ size = 'lg' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'text-xl', md: 'text-2xl', lg: 'text-4xl' };
  return (
    <h1 className={`${sizes[size]} font-black tracking-tight select-none`}>
      <span className="text-text">Boti</span>
      <span className="text-brand">Logistics</span>
    </h1>
  );
}
