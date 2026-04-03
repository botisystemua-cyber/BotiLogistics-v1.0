import { Package, Wrench } from 'lucide-react';

export default function ParcelsScreen() {
  return (
    <div className="animate-fade-in">
      <div className="bg-navy px-4 pt-6 pb-5 rounded-b-3xl md:rounded-none md:px-10 md:pt-8 md:pb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white mb-2">Посилки</h1>
          <p className="text-blue-200/60 text-xs md:text-sm">Відправка посилок Україна ⇄ Європа</p>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center px-6 py-20 md:py-32">
        <div className="w-20 h-20 bg-orange-50 rounded-2xl flex items-center justify-center mb-5">
          <Package size={40} className="text-accent" />
        </div>
        <div className="flex items-center gap-2 mb-3">
          <Wrench size={18} className="text-gray-400" />
          <h2 className="text-lg font-bold text-navy">Розділ в розробці</h2>
        </div>
        <p className="text-gray-400 text-sm text-center max-w-xs">
          Відправка посилок скоро буде доступна. Слідкуйте за оновленнями!
        </p>
      </div>
    </div>
  );
}
