import { AppProvider } from './store/AppProvider';
import { useApp } from './store/useAppStore';
import { LoginScreen } from './components/LoginScreen';
import { RouteScreen } from './components/RouteScreen';
import { ListScreen } from './components/ListScreen';
import { ExpensesScreen } from './components/ExpensesScreen';
import { Toast } from './components/Toast';

function AppContent() {
  const { currentScreen } = useApp();

  return (
    <>
      {currentScreen === 'login' && <LoginScreen />}
      {currentScreen === 'routes' && <RouteScreen />}
      {currentScreen === 'list' && <ListScreen />}
      {currentScreen === 'expenses' && <ExpensesScreen />}
      <Toast />
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
