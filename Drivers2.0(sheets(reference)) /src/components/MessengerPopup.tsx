import { useState } from 'react';
import { X } from 'lucide-react';

interface Props {
  phone: string;
  onClose: () => void;
}

export function MessengerPopup({ phone, onClose }: Props) {
  const clean = (phone || '').replace(/[^+\d]/g, '');
  const cleanNoPlus = clean.replace('+', '');
  const [waOpen, setWaOpen] = useState(false);

  const Btn = ({ href, bg, children, onClick }: { href?: string; bg: string; children: React.ReactNode; onClick?: () => void }) => {
    const cls = 'block w-full py-2.5 my-1 rounded-lg text-white font-semibold text-center text-sm cursor-pointer active:scale-[0.98] transition-transform';
    if (href) {
      return <a href={href} target="_blank" rel="noreferrer" className={cls} style={{ background: bg }} onClick={onClose}>{children}</a>;
    }
    return <button onClick={onClick} className={cls} style={{ background: bg }}>{children}</button>;
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-4 w-full max-w-xs shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <span className="font-bold text-sm text-text">📱 {waOpen ? 'Виберіть WhatsApp' : 'Написати'}</span>
          <button onClick={onClose} className="text-gray-500 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        {!waOpen ? (
          <>
            <Btn href={`viber://chat?number=${clean}`} bg="#7360f2">Viber</Btn>
            <Btn href={`https://t.me/${cleanNoPlus}`} bg="#0088cc">Telegram</Btn>
            <Btn bg="#25d366" onClick={() => setWaOpen(true)}>WhatsApp</Btn>
          </>
        ) : (
          <>
            <Btn href={`https://wa.me/${cleanNoPlus}`} bg="#25d366">📱 WhatsApp (звичайний)</Btn>
            <Btn href={`whatsapp-business://send?phone=${cleanNoPlus}`} bg="#075e54">💼 WhatsApp Business</Btn>
            <Btn bg="#94a3b8" onClick={() => setWaOpen(false)}>← Назад</Btn>
          </>
        )}
      </div>
    </div>
  );
}
