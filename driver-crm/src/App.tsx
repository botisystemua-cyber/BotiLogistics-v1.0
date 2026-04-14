import { AppProvider } from './store/AppProvider';
import { useApp } from './store/useAppStore';
import { RouteScreen } from './components/RouteScreen';
import { ListScreen } from './components/ListScreen';
import { ExpensesScreen } from './components/ExpensesScreen';
import { Toast } from './components/Toast';
import { readSession, redirectToLogin } from './lib/session';

function AppContent() {
  const { currentScreen } = useApp();

  return (
    <>
      {currentScreen === 'routes' && <RouteScreen />}
      {currentScreen === 'list' && <ListScreen />}
      {currentScreen === 'expenses' && <ExpensesScreen />}
      <Toast />
    </>
  );
}

export default function App() {
  const session = readSession();
  if (!session) {
    redirectToLogin();
    return null;
  }

  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
