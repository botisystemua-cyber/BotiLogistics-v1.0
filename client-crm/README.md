# BOTILOGISTICS

Клієнтський додаток логістичної компанії **BOTILOGISTICS** — бронювання пасажирських рейсів та відправка посилок між Україною та Європою.

## Стек технологій

- **React 19** + **TypeScript 5.9**
- **Vite 8** (збірка + dev-сервер)
- **Tailwind CSS 4** (утилітарні стилі)
- **Lucide React** (іконки)
- Adaptive layout: mobile-first + desktop sidebar

## Запуск

```bash
npm install
npm run dev        # dev-сервер (Vite HMR)
npm run build      # production build (tsc + vite build)
npm run preview    # preview production build
npm run lint       # ESLint
```

## Структура проекту

```
src/
├── App.tsx                   # Головний компонент, роутинг між екранами
├── index.css                 # Tailwind imports + кастомні кольори
├── main.tsx                  # Entry point
│
├── types/
│   └── index.ts              # Screen, Tab, OrderStatus, Flight, ChatMessage
│
├── data/
│   └── mock.ts               # Mock дані: рейси, чат, тарифи, типи вмісту
│
├── components/
│   ├── TabBar.tsx             # Мобільна нижня навігація + desktop sidebar
│   ├── Modal.tsx              # Модальне вікно (підтвердження замовлень)
│   ├── StatusBadge.tsx        # Бейдж статусу замовлення
│   └── Skeleton.tsx           # Skeleton-лоадер при завантаженні
│
└── screens/
    ├── LoginScreen.tsx        # Анімований login з автозаповненням demo-даних
    ├── HomeScreen.tsx         # Головна — 4 action-картки
    ├── FlightsScreen.tsx      # Список рейсів з фільтрами (напрямок + місто)
    ├── BookingScreen.tsx      # Форма бронювання рейсу
    ├── ParcelsScreen.tsx      # Вибір напрямку посилки
    ├── ParcelUaEuScreen.tsx   # Форма: посилка Україна → Європа (ТТН)
    ├── ParcelEuUaScreen.tsx   # Форма: посилка Європа → Україна (кур'єр)
    ├── OrdersScreen.tsx       # Мої замовлення (поїздки + посилки)
    ├── ChatScreen.tsx         # Чат з менеджером (mock)
    ├── TariffsScreen.tsx      # Тарифи: пасажири, посилки, контакти
    └── ProfileScreen.tsx      # Профіль користувача
```

## Навігація

- **Mobile**: нижній TabBar (5 табів: Головна, Поїздки, Посилки, Замовлення, Чат)
- **Desktop (md+)**: фіксований sidebar зліва (w-56), контент справа

Роутинг реалізований через `useState<Screen>` в `App.tsx` — без react-router.

## Основні екрани

| Екран | Опис |
|-------|------|
| Login | Анімований demo-вхід (автозаповнення телефону + пароля) |
| Home | 4 картки: Поїздки, Посилки, Чат, Тарифи |
| Flights | Фільтри (Україна → Європа / Європа → Україна + місто), картки рейсів |
| Booking | Форма бронювання обраного рейсу |
| Parcels | Вибір: Україна → Європа або Європа → Україна |
| ParcelUaEu | Реєстрація ТТН Нової Пошти |
| ParcelEuUa | Виклик кур'єра по Європі |
| Orders | Мої замовлення з відстеженням статусу |
| Chat | Чат з менеджером (mock повідомлення) |
| Tariffs | Ціни на пасажирів та посилки, контакти |
| Profile | Профіль користувача |

## Кольори (Tailwind custom)

- `navy` / `navy-dark` — основний темний
- `accent` — помаранчевий акцент
- `status-*` — кольори статусів (confirmed, transit, done, cancelled)

## Особливості

- **Mobile-first**: весь UI оптимізований для телефонів, потім адаптується для desktop
- **Skeleton loader**: при першому завантаженні показується анімований скелетон
- **Login**: форма входу та реєстрації
- **Responsive cards**: 2 колонки на мобільних, 4 на desktop (Home), 2-3 колонки grid на інших
- **Брендинг**: BOTILOGISTICS — у header, sidebar та на login
