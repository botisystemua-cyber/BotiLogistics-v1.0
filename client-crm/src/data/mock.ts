import type { ChatMessage } from '../types';

export const chatMessages: ChatMessage[] = [
  { id: 1, sender: 'manager', text: 'Доброго дня! Ваша посилка PKG-0042 прибула до нас. Перевіряємо вміст.', time: '10:32' },
  { id: 2, sender: 'user', text: 'Дякую! Коли орієнтовно відправка?', time: '10:45' },
  { id: 3, sender: 'manager', text: 'Найближчого вівторка, 17 червня. Водій: Олексій, +380671234567', time: '11:02' },
  { id: 4, sender: 'user', text: 'Чудово, дякую!', time: '11:05' },
];

export const tariffsCities = [
  { city: 'Амстердам', price: 95 },
  { city: 'Роттердам', price: 90 },
  { city: 'Гаага', price: 90 },
  { city: 'Берлін', price: 70 },
  { city: 'Дюссельдорф', price: 75 },
  { city: 'Гамбург', price: 80 },
];

export const contentTypes = ['Одяг', 'Взуття', 'Документи', 'Електроніка', 'Косметика', 'Продукти', 'Інше'];
