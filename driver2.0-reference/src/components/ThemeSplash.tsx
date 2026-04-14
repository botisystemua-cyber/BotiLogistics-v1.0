import { useEffect } from 'react';
import type { Theme } from '../store/useAppStore';

interface Props {
  theme: Theme;
  onDone: () => void;
}

const THEME_META: Record<Theme, { title: string; subtitle: string; bg: string; accent: string }> = {
  'top-driver': {
    title: 'ТОП ВОДІЙ',
    subtitle: 'Класика на дорозі',
    bg: 'linear-gradient(180deg, #fafafa 0%, #e8e8e8 100%)',
    accent: '#d4af37',
  },
  'lone-wolf': {
    title: 'ВОВК-ОДИНАК',
    subtitle: 'Нічний рейс',
    bg: 'radial-gradient(ellipse at center top, #1c1c22 0%, #08080a 100%)',
    accent: '#c0c0c8',
  },
  'detonator': {
    title: 'ПІДРИВНИК',
    subtitle: 'Швидкість і вогонь',
    bg: 'linear-gradient(180deg, #ffd500 0%, #ffaa00 100%)',
    accent: '#d40511',
  },
  'lightning': {
    title: 'БЛИСКАВКА',
    subtitle: 'Експрес-доставка',
    bg: 'linear-gradient(180deg, #ffffff 0%, #ffe5e6 100%)',
    accent: '#de2329',
  },
};

export function ThemeSplash({ theme, onDone }: Props) {
  useEffect(() => {
    const t = setTimeout(onDone, 2200);
    return () => clearTimeout(t);
  }, [onDone]);

  const meta = THEME_META[theme];

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden"
      style={{ background: meta.bg, animation: 'splashFade 2.2s ease-in-out forwards' }}
    >
      {theme === 'lone-wolf' && <LoneWolfScene accent={meta.accent} />}
      {theme === 'top-driver' && <TopDriverScene accent={meta.accent} />}
      {theme === 'detonator' && <DetonatorScene accent={meta.accent} />}
      {theme === 'lightning' && <LightningScene accent={meta.accent} />}

      {/* Title */}
      <div
        className="absolute bottom-[22%] left-0 right-0 text-center"
        style={{ animation: 'titleIn 0.9s 0.6s ease-out both' }}
      >
        <div
          className="text-[32px] font-black tracking-[0.25em]"
          style={{ color: meta.accent, textShadow: `0 0 24px ${meta.accent}40` }}
        >
          {meta.title}
        </div>
        <div
          className="text-[11px] font-semibold mt-1 tracking-[0.3em] opacity-70"
          style={{ color: meta.accent }}
        >
          {meta.subtitle}
        </div>
      </div>

      {/* Speedometer */}
      <Speedometer accent={meta.accent} />
    </div>
  );
}

function LoneWolfScene({ accent }: { accent: string }) {
  return (
    <>
      {/* Stars */}
      {Array.from({ length: 24 }).map((_, i) => {
        const x = (i * 37) % 100;
        const y = (i * 53) % 45;
        const delay = (i % 5) * 0.2;
        return (
          <div
            key={i}
            className="absolute w-[2px] h-[2px] rounded-full bg-white"
            style={{
              left: `${x}%`,
              top: `${y}%`,
              animation: `starTwinkle 2s ${delay}s ease-in-out infinite`,
            }}
          />
        );
      })}

      {/* Moon */}
      <div
        className="absolute top-[12%] left-1/2 w-[140px] h-[140px] rounded-full"
        style={{
          background: `radial-gradient(circle at 35% 35%, #f5f5f8 0%, #c0c0c8 60%, #6e6e76 100%)`,
          boxShadow: `0 0 80px 20px ${accent}40, inset -20px -20px 40px rgba(0,0,0,0.4)`,
          animation: 'moonRise 1.2s ease-out both',
        }}
      />

      {/* Mountains */}
      <svg
        className="absolute bottom-0 left-0 w-full"
        viewBox="0 0 400 180"
        preserveAspectRatio="none"
        style={{ height: '40%' }}
      >
        <defs>
          <linearGradient id="mtn1" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#2a2a32" />
            <stop offset="100%" stopColor="#0a0a0c" />
          </linearGradient>
          <linearGradient id="mtn2" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#16161a" />
            <stop offset="100%" stopColor="#000" />
          </linearGradient>
        </defs>
        <path d="M0,180 L0,90 L60,40 L110,80 L160,30 L220,90 L280,50 L340,85 L400,40 L400,180 Z" fill="url(#mtn1)" />
        <path d="M0,180 L0,120 L50,90 L100,130 L170,80 L240,120 L320,90 L400,130 L400,180 Z" fill="url(#mtn2)" />
      </svg>

      {/* Wolf silhouette */}
      <div
        className="absolute"
        style={{
          bottom: '32%',
          left: '50%',
          transform: 'translateX(-50%)',
          animation: 'wolfRise 1s 0.3s ease-out both',
          transformOrigin: 'center bottom',
        }}
      >
        <div style={{ animation: 'howlShake 1.4s 1.2s ease-in-out' }}>
          <svg width="120" height="110" viewBox="0 0 120 110">
            {/* Wolf body silhouette - howling pose */}
            <path
              d="M20,95 Q18,80 22,70 L30,55 Q28,45 32,38 L42,28 Q45,18 52,12 L58,5 Q62,2 65,8 L68,18 Q72,22 70,30 L66,40 L72,42 Q80,45 85,52 L92,62 Q98,72 95,82 L92,95 L80,95 L78,85 L70,90 L60,88 L50,92 L40,88 L30,92 Z"
              fill="#000"
              stroke={accent}
              strokeWidth="1"
              opacity="0.95"
            />
            {/* Eye glow */}
            <circle cx="60" cy="18" r="1.8" fill={accent}>
              <animate attributeName="opacity" values="0.4;1;0.4" dur="1.5s" repeatCount="indefinite" />
            </circle>
          </svg>
        </div>
      </div>

      {/* Mist */}
      <div
        className="absolute bottom-0 left-0 w-full h-[15%]"
        style={{
          background: 'linear-gradient(to top, rgba(150,150,160,0.15), transparent)',
          animation: 'mistDrift 4s ease-in-out infinite alternate',
        }}
      />
    </>
  );
}

function TopDriverScene({ accent }: { accent: string }) {
  return (
    <>
      {/* Sun rays */}
      <div
        className="absolute top-[15%] left-1/2 w-[180px] h-[180px] rounded-full"
        style={{
          background: `radial-gradient(circle, ${accent}60 0%, transparent 70%)`,
          transform: 'translateX(-50%)',
          animation: 'moonRise 1.2s ease-out both',
        }}
      />
      {/* Crown */}
      <svg
        className="absolute top-[20%] left-1/2"
        width="100"
        height="70"
        viewBox="0 0 100 70"
        style={{ transform: 'translateX(-50%)', animation: 'wolfRise 0.8s 0.2s ease-out both' }}
      >
        <path
          d="M10,55 L20,15 L35,40 L50,5 L65,40 L80,15 L90,55 Z"
          fill={accent}
          stroke="#a08020"
          strokeWidth="2"
        />
        <circle cx="50" cy="20" r="4" fill="#fff" />
        <circle cx="20" cy="25" r="3" fill="#fff" />
        <circle cx="80" cy="25" r="3" fill="#fff" />
      </svg>
    </>
  );
}

function DetonatorScene({ accent }: { accent: string }) {
  return (
    <>
      {/* Flash */}
      <div
        className="absolute inset-0"
        style={{ background: '#fff', animation: 'flash 0.3s 0.4s ease-out both' }}
      />
      {/* Explosion */}
      <div
        className="absolute top-[20%] left-1/2"
        style={{ transform: 'translateX(-50%)', animation: 'explosionPop 1s 0.2s ease-out both' }}
      >
        <svg width="180" height="180" viewBox="0 0 180 180">
          <defs>
            <radialGradient id="boom" cx="50%" cy="50%">
              <stop offset="0%" stopColor="#fff" />
              <stop offset="30%" stopColor="#ffeb00" />
              <stop offset="70%" stopColor={accent} />
              <stop offset="100%" stopColor="#7a0306" stopOpacity="0" />
            </radialGradient>
          </defs>
          <path
            d="M90,10 L105,55 L150,40 L120,80 L170,90 L120,100 L150,140 L105,125 L90,170 L75,125 L30,140 L60,100 L10,90 L60,80 L30,40 L75,55 Z"
            fill="url(#boom)"
          />
        </svg>
      </div>
      {/* DHL Truck silhouette */}
      <div
        className="absolute"
        style={{
          bottom: '32%',
          left: 0,
          right: 0,
          animation: 'truckDrive 1.8s 0.6s cubic-bezier(0.2,0.8,0.4,1) both',
        }}
      >
        <div className="flex justify-center">
          <svg width="160" height="80" viewBox="0 0 160 80">
            <rect x="10" y="20" width="90" height="40" fill="#1a1a1a" stroke={accent} strokeWidth="2" rx="3" />
            <rect x="100" y="30" width="40" height="30" fill="#1a1a1a" stroke={accent} strokeWidth="2" rx="2" />
            <rect x="105" y="35" width="20" height="15" fill="#ffeb00" opacity="0.9" />
            <text x="55" y="48" fontSize="20" fontWeight="900" fill="#ffeb00" textAnchor="middle">DHL</text>
            <circle cx="30" cy="65" r="10" fill="#0a0a0a" stroke={accent} strokeWidth="2" />
            <circle cx="60" cy="65" r="10" fill="#0a0a0a" stroke={accent} strokeWidth="2" />
            <circle cx="120" cy="65" r="10" fill="#0a0a0a" stroke={accent} strokeWidth="2" />
          </svg>
        </div>
      </div>
    </>
  );
}

function LightningScene({ accent }: { accent: string }) {
  return (
    <>
      {/* Flash */}
      <div
        className="absolute inset-0"
        style={{ background: accent, animation: 'flash 0.4s 0.2s ease-out both', opacity: 0.4 }}
      />
      {/* Big lightning bolt */}
      <div
        className="absolute top-[10%] left-1/2"
        style={{
          transform: 'translateX(-50%)',
          transformOrigin: 'top center',
          animation: 'boltStrike 0.6s ease-out both',
        }}
      >
        <svg width="140" height="240" viewBox="0 0 140 240">
          <defs>
            <linearGradient id="bolt" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#fff" />
              <stop offset="50%" stopColor={accent} />
              <stop offset="100%" stopColor="#7a0e12" />
            </linearGradient>
          </defs>
          <path
            d="M80,0 L30,120 L65,120 L40,240 L120,90 L80,90 L110,0 Z"
            fill="url(#bolt)"
            stroke="#fff"
            strokeWidth="2"
            style={{ filter: `drop-shadow(0 0 20px ${accent})` }}
          />
        </svg>
      </div>
      {/* NP truck silhouette */}
      <div
        className="absolute"
        style={{
          bottom: '30%',
          left: 0,
          right: 0,
          animation: 'truckDrive 1.6s 0.7s cubic-bezier(0.2,0.8,0.4,1) both',
        }}
      >
        <div className="flex justify-center">
          <svg width="150" height="70" viewBox="0 0 150 70">
            <rect x="5" y="15" width="100" height="38" fill={accent} stroke="#7a0e12" strokeWidth="2" rx="3" />
            <rect x="105" y="25" width="35" height="28" fill={accent} stroke="#7a0e12" strokeWidth="2" rx="2" />
            <rect x="110" y="30" width="18" height="14" fill="#fff" opacity="0.95" />
            <text x="55" y="42" fontSize="16" fontWeight="900" fill="#fff" textAnchor="middle">НП</text>
            <circle cx="25" cy="58" r="9" fill="#1a1a1a" stroke={accent} strokeWidth="2" />
            <circle cx="55" cy="58" r="9" fill="#1a1a1a" stroke={accent} strokeWidth="2" />
            <circle cx="120" cy="58" r="9" fill="#1a1a1a" stroke={accent} strokeWidth="2" />
          </svg>
        </div>
      </div>
    </>
  );
}

function Speedometer({ accent }: { accent: string }) {
  return (
    <div
      className="absolute bottom-[8%] left-1/2"
      style={{ transform: 'translateX(-50%)' }}
    >
      <svg width="120" height="70" viewBox="0 0 120 70">
        {/* Arc */}
        <path
          d="M10,60 A50,50 0 0,1 110,60"
          fill="none"
          stroke={accent}
          strokeWidth="2"
          opacity="0.3"
        />
        <path
          d="M10,60 A50,50 0 0,1 110,60"
          fill="none"
          stroke={accent}
          strokeWidth="3"
          strokeDasharray="157"
          strokeDashoffset="40"
          opacity="0.9"
        />
        {/* Ticks */}
        {Array.from({ length: 9 }).map((_, i) => {
          const angle = -180 + (i * 180) / 8;
          const rad = (angle * Math.PI) / 180;
          const x1 = 60 + Math.cos(rad) * 45;
          const y1 = 60 + Math.sin(rad) * 45;
          const x2 = 60 + Math.cos(rad) * 50;
          const y2 = 60 + Math.sin(rad) * 50;
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={accent} strokeWidth="1.5" opacity="0.7" />;
        })}
        {/* Needle */}
        <g style={{ transformOrigin: '60px 60px', animation: 'speedoNeedle 1.6s 0.4s cubic-bezier(0.25,0.8,0.4,1) both' }}>
          <line x1="60" y1="60" x2="60" y2="18" stroke={accent} strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="60" cy="60" r="4" fill={accent} />
        </g>
      </svg>
    </div>
  );
}
