import { useState, useEffect, useCallback, useRef } from 'react';
import type { Screen, Tab, Flight } from './types';
import { fetchFlights } from './lib/api';
import TabBar from './components/TabBar';
import Skeleton from './components/Skeleton';
import LoginScreen from './screens/LoginScreen';
import HomeScreen from './screens/HomeScreen';
import FlightsScreen from './screens/FlightsScreen';
import BookingScreen from './screens/BookingScreen';
import ParcelsScreen from './screens/ParcelsScreen';
import OrdersScreen from './screens/OrdersScreen';
import ChatScreen from './screens/ChatScreen';
import TariffsScreen from './screens/TariffsScreen';
import ProfileScreen from './screens/ProfileScreen';

const tabScreens: Tab[] = ['home', 'flights', 'parcels', 'orders', 'chat'];

function formatDate(raw: string) {
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return raw;
    return d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' });
  } catch { return raw; }
}

function parseCities(raw: string): { from: string; to: string } {
  const cleaned = raw.replace(/_/g, '-').replace(/\s*-\s*/g, '-').trim();
  const parts = cleaned.split('-').map(s => s.trim()).filter(Boolean);
  if (parts.length >= 2) return { from: parts[0], to: parts[1] };
  return { from: cleaned, to: '' };
}

function formatDirection(raw: string) {
  const lower = raw.toLowerCase();
  if (lower.includes('ук') || lower.includes('ua')) return 'UA → EU';
  if (lower.includes('єв') || lower.includes('eu')) return 'EU → UA';
  return raw;
}

function mapFlights(data: Awaited<ReturnType<typeof fetchFlights>>): Flight[] {
  return data
    .filter(t => t.status !== 'Видалено' && t.status !== 'Закритий' && t.free_seats > 0)
    .map(t => {
      const cities = parseCities(t.city);
      return {
        cal_id: t.cal_id,
        city: t.city,
        from_city: cities.from,
        to_city: cities.to,
        date: formatDate(t.date),
        direction: formatDirection(t.direction),
        auto_name: t.auto_name,
        max_seats: t.max_seats,
        free_seats: t.free_seats,
        occupied: t.occupied,
        status: t.status,
        free_list: t.free_list,
      };
    });
}

function App() {
  const [phone, setPhone] = useState<string | null>(() => {
    return localStorage.getItem('boti_phone');
  });
  const [userName, setUserName] = useState<string | null>(() => {
    return localStorage.getItem('boti_name');
  });
  const [screen, setScreen] = useState<Screen>(phone ? 'home' : 'login');
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [loading, setLoading] = useState(false);
  const [selectedFlight, setSelectedFlight] = useState<Flight | null>(null);
  const [chatBadge, setChatBadge] = useState(1);

  // Prefetched flights — load once on app start, share with FlightsScreen
  const [prefetchedFlights, setPrefetchedFlights] = useState<Flight[]>([]);
  const [flightsLoading, setFlightsLoading] = useState(false);
  const [flightsError, setFlightsError] = useState('');
  const flightsFetched = useRef(false);

  const loadFlightsData = useCallback(async (silent = false) => {
    if (!silent) setFlightsLoading(true);
    setFlightsError('');
    try {
      const data = await fetchFlights();
      setPrefetchedFlights(mapFlights(data));
    } catch (e) {
      setFlightsError(e instanceof Error ? e.message : 'Помилка завантаження');
    } finally {
      setFlightsLoading(false);
    }
  }, []);

  // Prefetch flights on app start (if logged in)
  useEffect(() => {
    if (phone && !flightsFetched.current) {
      flightsFetched.current = true;
      loadFlightsData();
    }
  }, [phone, loadFlightsData]);

  const navigate = useCallback((s: Screen) => {
    if (tabScreens.includes(s as Tab)) {
      setActiveTab(s as Tab);
      setLoading(true);
      setScreen(s);
    } else {
      setScreen(s);
    }
  }, []);

  useEffect(() => {
    if (loading) {
      const t = setTimeout(() => setLoading(false), 800);
      return () => clearTimeout(t);
    }
  }, [loading]);

  const handleLogin = (phoneNumber: string, name: string) => {
    setPhone(phoneNumber);
    setUserName(name);
    localStorage.setItem('boti_phone', phoneNumber);
    localStorage.setItem('boti_name', name);
    setLoading(true);
    setScreen('home');
    setActiveTab('home');
    // Start prefetching flights immediately on login
    flightsFetched.current = true;
    loadFlightsData();
  };

  const handleLogout = () => {
    setPhone(null);
    setUserName(null);
    localStorage.removeItem('boti_phone');
    localStorage.removeItem('boti_name');
    setPrefetchedFlights([]);
    flightsFetched.current = false;
    setScreen('login');
  };

  const handleTabChange = (tab: Tab) => {
    if (tab === activeTab) return;
    setActiveTab(tab);
    setScreen(tab);
    setLoading(true);
  };

  const clearChatBadge = useCallback(() => setChatBadge(0), []);

  const showTabBar = screen !== 'login';

  const renderScreen = () => {
    if (loading && tabScreens.includes(screen as Tab)) return <Skeleton />;
    switch (screen) {
      case 'login':
        return <LoginScreen onLogin={handleLogin} />;
      case 'home': return <HomeScreen onNavigate={navigate} userName={userName} />;
      case 'flights': return (
        <FlightsScreen
          onNavigate={navigate}
          onSelectFlight={setSelectedFlight}
          flights={prefetchedFlights}
          flightsLoading={flightsLoading}
          flightsError={flightsError}
          onRefresh={loadFlightsData}
        />
      );
      case 'booking': return selectedFlight ? <BookingScreen flight={selectedFlight} onNavigate={navigate} /> : null;
      case 'parcels': return <ParcelsScreen />;
      case 'orders': return <OrdersScreen />;
      case 'chat': return <ChatScreen onClearBadge={clearChatBadge} />;
      case 'tariffs': return <TariffsScreen onNavigate={navigate} />;
      case 'profile': return <ProfileScreen onNavigate={navigate} onLogout={handleLogout} phone={phone} userName={userName} />;
      default: return null;
    }
  };

  return (
    <div className={`mx-auto min-h-screen relative ${showTabBar ? 'max-w-[480px] md:max-w-none md:ml-56 bg-slate-100' : 'max-w-none'}`}>
      <div className={showTabBar ? 'pb-16 md:pb-0' : ''}>
        {renderScreen()}
      </div>
      {showTabBar && <TabBar active={activeTab} onTab={handleTabChange} chatBadge={chatBadge} />}
    </div>
  );
}

export default App;
