export function BotiLogo({ size = 'lg' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-4xl',
  };

  return (
    <h1 className={`${sizes[size]} font-black tracking-wider select-none`}>
      <span className="text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">Boti</span>
      <span className="text-neon-green drop-shadow-[0_0_15px_rgba(57,255,20,0.6)]">
        Logistics
      </span>
    </h1>
  );
}
