import { useEffect, useState } from 'react';
import { AdminPanel } from './components/AdminPanel';
import { readSession, redirectToLogin, type BotiSession } from './lib/session';

function App() {
  const [session, setSession] = useState<BotiSession | null | 'checking'>('checking');

  useEffect(() => {
    const s = readSession();
    if (!s) {
      redirectToLogin();
      return;
    }
    if (s.role !== 'owner') {
      setSession(null);
      return;
    }
    setSession(s);
  }, []);

  if (session === 'checking') {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center text-muted text-sm">
        Перевірка сесії…
      </div>
    );
  }

  if (session === null) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-black text-text">Доступ заборонено</h1>
        <p className="text-muted text-sm max-w-md">
          Ця сторінка доступна лише для ролі <b>Власник</b>. Увійдіть через вхідний екран,
          обравши відповідну роль.
        </p>
        <button
          onClick={redirectToLogin}
          className="px-5 py-3 rounded-xl bg-brand text-white font-bold text-sm cursor-pointer hover:brightness-110 transition-all"
        >
          Перейти до входу
        </button>
      </div>
    );
  }

  return <AdminPanel session={session} />;
}

export default App;
