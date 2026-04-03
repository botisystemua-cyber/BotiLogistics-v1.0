import { useState, useEffect, useRef } from 'react';
import { Bus, Calendar, Users, Loader2, RefreshCw, ArrowLeft, ChevronDown, MapPin } from 'lucide-react';
import type { Screen, Flight } from '../types';

interface Props {
  onNavigate: (screen: Screen) => void;
  onSelectFlight: (flight: Flight) => void;
  flights: Flight[];
  flightsLoading: boolean;
  flightsError: string;
  onRefresh: (silent?: boolean) => Promise<void>;
}

export default function FlightsScreen({ onNavigate, onSelectFlight, flights, flightsLoading, flightsError, onRefresh }: Props) {
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');
  const [showFrom, setShowFrom] = useState(false);
  const [showTo, setShowTo] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<{ from: string; to: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const carouselRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (flights.length > 0) onRefresh(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll carousel
  useEffect(() => {
    const el = carouselRef.current;
    if (!el || flights.length === 0) return;
    let pos = 0;
    const speed = 0.5;
    let raf: number;
    let paused = false;

    const step = () => {
      if (!paused) {
        pos += speed;
        if (pos >= el.scrollWidth / 2) pos = 0;
        el.scrollLeft = pos;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);

    const pause = () => { paused = true; };
    const resume = () => { setTimeout(() => { paused = false; }, 2000); };
    el.addEventListener('touchstart', pause);
    el.addEventListener('touchend', resume);
    el.addEventListener('mouseenter', pause);
    el.addEventListener('mouseleave', resume);

    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('touchstart', pause);
      el.removeEventListener('touchend', resume);
      el.removeEventListener('mouseenter', pause);
      el.removeEventListener('mouseleave', resume);
    };
  }, [flights.length]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await onRefresh(false);
    setRefreshing(false);
  };

  // Navigate to date selection when both selected
  const handleSelect = (fromVal: string, toVal: string) => {
    setFrom(fromVal);
    setTo(toVal);
    setShowFrom(false);
    setShowTo(false);
    setSelectedRoute({ from: fromVal, to: toVal });
  };

  const fromCities = [...new Set(flights.map(f => f.from_city))].filter(Boolean).sort();
  const toCities = [...new Set(
    flights.filter(f => !from || f.from_city === from).map(f => f.to_city)
  )].filter(Boolean).sort();

  const routeFlights = selectedRoute
    ? flights.filter(f => f.from_city === selectedRoute.from && f.to_city === selectedRoute.to)
    : [];

  const isLoading = flightsLoading && flights.length === 0;

  // Carousel cards — duplicate for infinite scroll
  const carouselFlights = flights.length > 0 ? [...flights, ...flights] : [];

  // ── Date selection view ──
  if (selectedRoute) {
    return (
      <div className="animate-fade-in">
        <div className="bg-navy px-4 pt-6 pb-5 rounded-b-3xl md:rounded-none md:px-10 md:pt-8 md:pb-6">
          <button
            onClick={() => { setSelectedRoute(null); setFrom(''); setTo(''); }}
            className="text-blue-200/60 flex items-center gap-1 mb-3 text-sm"
          >
            <ArrowLeft size={16} /> Назад
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-white">
                {selectedRoute.from} → {selectedRoute.to}
              </h1>
              <p className="text-blue-200/60 text-xs mt-1">Оберіть дату поїздки</p>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="text-blue-200/60 hover:text-white transition-colors"
            >
              <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        <div className="px-4 -mt-3 pb-4 space-y-2.5 md:px-10 md:mt-4 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-4 md:space-y-0">
          {routeFlights.length === 0 ? (
            <div className="text-center py-12 text-gray-400 md:col-span-full">
              <Calendar size={40} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Немає доступних дат</p>
            </div>
          ) : (
            routeFlights.map(flight => (
              <button
                key={flight.cal_id}
                onClick={() => {
                  onSelectFlight(flight);
                  onNavigate('booking');
                }}
                className="w-full bg-white rounded-2xl p-4 shadow-sm flex items-center justify-between active:scale-[0.98] transition-transform text-left md:hover:shadow-md"
              >
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-accent/10 rounded-xl flex items-center justify-center shrink-0">
                    <Calendar size={20} className="text-accent" />
                  </div>
                  <div>
                    <p className="font-bold text-navy text-sm">{flight.date}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Users size={12} className="text-status-confirmed" />
                      <span className="text-xs font-semibold text-status-confirmed">{flight.free_seats} вільних місць</span>
                    </div>
                  </div>
                </div>
                <div className="px-4 py-2 bg-accent text-white text-sm font-semibold rounded-xl shrink-0">
                  Обрати
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    );
  }

  // ── Main view: selectors + carousel ──
  return (
    <div className="animate-fade-in">
      <div className="bg-navy px-4 pt-6 pb-6 rounded-b-3xl md:rounded-none md:px-10 md:pt-8 md:pb-8">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-xl md:text-2xl font-bold text-white">Поїздки</h1>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="text-blue-200/60 hover:text-white transition-colors"
          >
            <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* From / To selectors */}
        <div className="space-y-2.5">
          {/* From */}
          <div className="relative">
            <button
              onClick={() => { setShowFrom(!showFrom); setShowTo(false); }}
              className="w-full flex items-center gap-3 px-4 py-3.5 bg-white/10 backdrop-blur border border-white/20 rounded-xl text-left transition-all focus:border-accent"
            >
              <MapPin size={18} className="text-blue-200/50 shrink-0" />
              <span className={from ? 'text-white font-medium' : 'text-blue-200/50'}>
                {from || 'Звідки?'}
              </span>
              <ChevronDown size={16} className={`ml-auto text-blue-200/50 transition-transform ${showFrom ? 'rotate-180' : ''}`} />
            </button>
            {showFrom && (
              <div className="absolute z-20 mt-1 w-full bg-white rounded-xl shadow-lg overflow-hidden animate-fade-in">
                {fromCities.map(c => (
                  <button
                    key={c}
                    onClick={() => {
                      setFrom(c);
                      setShowFrom(false);
                      setTo('');
                      // If only one "to" option — auto-select and navigate
                      const availableTo = [...new Set(flights.filter(f => f.from_city === c).map(f => f.to_city))].filter(Boolean);
                      if (availableTo.length === 1) {
                        handleSelect(c, availableTo[0]);
                      } else {
                        setTimeout(() => setShowTo(true), 150);
                      }
                    }}
                    className={`w-full px-4 py-3 text-left text-sm hover:bg-accent/5 transition-colors ${from === c ? 'bg-accent/10 text-accent font-semibold' : 'text-navy'}`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* To */}
          <div className="relative">
            <button
              onClick={() => { if (from) { setShowTo(!showTo); setShowFrom(false); } }}
              className={`w-full flex items-center gap-3 px-4 py-3.5 bg-white/10 backdrop-blur border border-white/20 rounded-xl text-left transition-all focus:border-accent ${!from ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <MapPin size={18} className="text-blue-200/50 shrink-0" />
              <span className={to ? 'text-white font-medium' : 'text-blue-200/50'}>
                {to || 'Куди?'}
              </span>
              <ChevronDown size={16} className={`ml-auto text-blue-200/50 transition-transform ${showTo ? 'rotate-180' : ''}`} />
            </button>
            {showTo && from && (
              <div className="absolute z-20 mt-1 w-full bg-white rounded-xl shadow-lg overflow-hidden animate-fade-in">
                {toCities.map(c => (
                  <button
                    key={c}
                    onClick={() => handleSelect(from, c)}
                    className={`w-full px-4 py-3 text-left text-sm hover:bg-accent/5 transition-colors ${to === c ? 'bg-accent/10 text-accent font-semibold' : 'text-navy'}`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Carousel */}
      <div className="mt-5 mb-4">
        <p className="px-4 md:px-10 text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Найближчі рейси</p>
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 size={28} className="animate-spin text-accent" />
          </div>
        ) : flightsError && flights.length === 0 ? (
          <div className="flex flex-col items-center py-10">
            <p className="text-red-400 text-sm mb-2">{flightsError}</p>
            <button onClick={handleRefresh} className="text-accent text-sm font-semibold">Спробувати ще</button>
          </div>
        ) : (
          <div
            ref={carouselRef}
            className="flex gap-3 overflow-x-hidden px-4 md:px-10"
            style={{ scrollBehavior: 'auto' }}
          >
            {carouselFlights.map((flight, i) => (
              <div
                key={`${flight.cal_id}-${i}`}
                onClick={() => {
                  setFrom(flight.from_city);
                  setTo(flight.to_city);
                  handleSelect(flight.from_city, flight.to_city);
                }}
                className="shrink-0 w-[220px] bg-white rounded-2xl p-4 shadow-sm cursor-pointer active:scale-[0.97] transition-transform md:hover:shadow-md"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Bus size={16} className="text-accent" />
                  <span className="font-bold text-navy text-sm truncate">{flight.auto_name}</span>
                </div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Calendar size={12} className="text-gray-400" />
                  <span className="text-xs font-semibold text-navy">{flight.date}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Users size={12} className="text-status-confirmed" />
                  <span className="text-xs font-semibold text-status-confirmed">{flight.free_seats} вільних</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
