const API_URL = 'https://script.google.com/macros/s/AKfycbxkCTZ7Dfj8_4mEvwR3yCc6Dm7Ll28jG-NC1AEWrGL0K3-3l-t9MJEXOK9xMYVHAL-WPA/exec';

export async function fetchFlights() {
  const res = await fetch(`${API_URL}?action=getTrips`);
  const json = await res.json();

  if (!json.ok) {
    throw new Error(json.error || 'Помилка завантаження рейсів');
  }

  return json.data as {
    cal_id: string;
    rte_id: string;
    auto_id: string;
    auto_name: string;
    layout: string;
    date: string;
    direction: string;
    city: string;
    max_seats: number;
    free_seats: number;
    occupied: number;
    free_list: string;
    occupied_list: string;
    paired_id: string;
    status: string;
  }[];
}
