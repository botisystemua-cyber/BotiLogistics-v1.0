import type { DeliveryRoute } from '../types';

export const CONFIG = {
  COMPANY_NAME: 'BotiLogistics',
  DELIVERY_API_URL:
    'https://script.google.com/macros/s/AKfycbwlo9O9RO_LUDmtTGD3GL8e1i1jkklM6heaypRGMZF_QidhBsDmagflqUhAMmwwguLYwg/exec',
  PASSENGER_API_URL:
    'https://script.google.com/macros/s/AKfycbzPJHn3OlBJbRlHvveT453NKUZMViUMMmfD9yqttGZ0b7mVCeKcUum_UsmamUe43g/exec',
  ROUTES_API_URL:
    'https://script.google.com/macros/s/AKfycbzPJHn3OlBJbRlHvveT453NKUZMViUMMmfD9yqttGZ0b7mVCeKcUum_UsmamUe43g/exec',
  ARCHIVE_API_URL:
    'https://script.google.com/macros/s/AKfycbwJLGZgYT333VdMW-nM5kPjYs2WIGGjfqkZnDJYjJxUt8nzE8GDGCPm7EzMHhcxNDOn/exec',
  DELIVERY_ROUTES: [
    { name: 'Братислава марш.', password: '1234' },
    { name: 'Нітра марш.', password: '12345' },
    { name: 'Словаччина марш.', password: '123456' },
    { name: 'Кошице+прешов марш.', password: '1234567' },
  ] as DeliveryRoute[],
};
