// SMS parser for passenger booking text — ported 1:1 from passenger CRM
export const KNOWN_CITIES_EU = ['цюріх','цюріха','цюріху','женева','женеви','женеву','берн','берна','базель','базеля','люцерн','люцерна','лозанна','лозанни','лозанну','берлін','берліна','берліну','мюнхен','мюнхена','мюнхену','франкфурт','франкфурта','гамбург','гамбурга','відень','відня','відні','прага','праги','прагу','празі','варшава','варшави','варшаву','краків','кракова','вроцлав','вроцлава','братислава','братислави','братиславу','будапешт','будапешта','будапешту','бухарест','бухареста','мілан','мілана','рим','рима','риму','париж','парижа','парижу','амстердам','амстердама','брюссель','брюсселя','мадрид','мадрида','мадріду','мадрід','мадріда','барселона','барселони','барселону','лісабон','лісабона'];

export const KNOWN_CITIES_UA = ['київ','києва','києву','києві','львів','львова','львову','львові','одеса','одеси','одесу','одесі','харків','харкова','харкову','харкові','дніпро','дніпра','запоріжжя','запоріжжі','вінниця','вінниці','вінницю','тернопіль','тернополя','тернополі','івано-франківськ','івано-франківська','рівне','рівного','луцьк','луцька','чернівці','чернівців','ужгород','ужгорода','мукачево','мукачева','хмельницький','хмельницького','полтава','полтави','полтаву','черкаси','черкас','житомир','житомира','суми','сум','миколаїв','миколаєва','херсон','херсона','кропивницький','кропивницького','чернігів','чернігова'];

export const NUM_WORDS: Record<string, number> = {'один':1,'одна':1,'одного':1,'два':2,'дві':2,'двох':2,'три':3,'трьох':3,'чотири':4,'чотирьох':4,"п'ять":5,'пять':5,'шість':6,'сім':7,'вісім':8,"дев'ять":9,'десять':10};

export interface SmsParseResult {
  date?: string;          // YYYY-MM-DD
  phone?: string;
  seats?: number;
  direction?: 'ua-eu' | 'eu-ua';
  fromValue?: string;
  toValue?: string;
  timing?: string;        // HH:MM
  name?: string;
  log: string[];
}

export function parseSmsText(raw: string): SmsParseResult {
  const result: SmsParseResult = { log: [] };
  if (!raw.trim()) return result;
  const text = raw.toLowerCase();

  // 1. Date
  const dateMatch = text.match(/(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?/);
  if (dateMatch) {
    const day = dateMatch[1].padStart(2, '0');
    const month = dateMatch[2].padStart(2, '0');
    let year = dateMatch[3] || String(new Date().getFullYear());
    if (year.length === 2) year = '20' + year;
    result.date = `${year}-${month}-${day}`;
    result.log.push('📅 Дата: ' + day + '.' + month + '.' + year);
  }

  // 2. Phone
  let phone = '';
  const intlMatch = raw.match(/(\+[\d\s\-()]{9,22})/);
  const uaMatch = raw.match(/(?<!\d)\+?3?8?(0\d{9})(?!\d)/);
  if (intlMatch) phone = intlMatch[1].replace(/[\s\-()]/g, '');
  else if (uaMatch) phone = '+380' + uaMatch[1].slice(1);
  if (phone.length >= 10) {
    result.phone = phone;
    result.log.push('📞 Телефон: ' + phone);
  }

  // 3. Seats
  let seats = 1;
  const seatsNumMatch = text.match(/(\d+)\s*(?:пасажир|місц|особ|людин|чоловік)/);
  if (seatsNumMatch) {
    seats = parseInt(seatsNumMatch[1]);
  } else {
    for (const [word, num] of Object.entries(NUM_WORDS)) {
      if (text.includes(word + ' пасажир') || text.includes(word + ' місц') || text.includes(word + ' особ') || text.includes(word + ' людин')) {
        seats = num;
        break;
      }
    }
  }
  if (seats > 1) {
    result.seats = seats;
    result.log.push('💺 Місць: ' + seats);
  }

  // 4. Cities and direction
  let fromCity = '', toCity = '', direction: 'ua-eu' | 'eu-ua' | '' = '';
  const routeMatch = text.match(/(?:з\s+)?(\S+)\s*[-–—→⟶>]+\s*(\S+)/);
  const toMatch = text.match(/(?:до|в|на)\s+([а-яіїєґ']+)/i);
  const fromMatch = text.match(/(?:з|від|із)\s+([а-яіїєґ']+)/i);

  const foundEU = KNOWN_CITIES_EU.filter((c) => text.includes(c));
  const foundUA = KNOWN_CITIES_UA.filter((c) => text.includes(c));

  if (routeMatch) {
    const c1 = routeMatch[1].replace(/[,.:]/g, '');
    const c2 = routeMatch[2].replace(/[,.:]/g, '');
    const c1isUA = KNOWN_CITIES_UA.some((c) => c1.includes(c));
    const c2isEU = KNOWN_CITIES_EU.some((c) => c2.includes(c));
    const c1isEU = KNOWN_CITIES_EU.some((c) => c1.includes(c));
    const c2isUA = KNOWN_CITIES_UA.some((c) => c2.includes(c));
    if (c1isUA && c2isEU) { fromCity = c1; toCity = c2; direction = 'ua-eu'; }
    else if (c1isEU && c2isUA) { fromCity = c1; toCity = c2; direction = 'eu-ua'; }
    else { fromCity = c1; toCity = c2; }
  } else {
    if (toMatch) toCity = toMatch[1];
    if (fromMatch) fromCity = fromMatch[1];
    if (!fromCity && foundUA.length > 0) fromCity = foundUA[0];
    if (!toCity && foundEU.length > 0) toCity = foundEU[0];
  }

  if (!direction) {
    const toL = toCity.toLowerCase(), fromL = fromCity.toLowerCase();
    if (KNOWN_CITIES_EU.some((c) => toL.includes(c))) direction = 'ua-eu';
    else if (KNOWN_CITIES_UA.some((c) => toL.includes(c))) direction = 'eu-ua';
    else if (KNOWN_CITIES_UA.some((c) => fromL.includes(c))) direction = 'ua-eu';
    else if (KNOWN_CITIES_EU.some((c) => fromL.includes(c))) direction = 'eu-ua';
  }

  if (direction) {
    result.direction = direction;
    result.log.push('🧭 Напрям: ' + (direction === 'ua-eu' ? 'UA→EU' : 'EU→UA'));
  }

  // 4b. Addresses
  let fromAddress = '', toAddress = '';
  const addrFromMatch = raw.match(/(?:виїзд|відправ\w*|забрати|посадка|адреса\s+відправ\w*)\s*[:：]\s*(.+)/i);
  const addrToMatch = raw.match(/(?:прибут\w*|доставк\w*|привезти|висадка|адреса\s+прибут\w*)\s*[:：]\s*(.+)/i);
  if (addrFromMatch) fromAddress = addrFromMatch[1].replace(/[+]?\d{10,}.*$/, '').replace(/\n.*$/, '').trim();
  if (addrToMatch) toAddress = addrToMatch[1].replace(/[+]?\d{10,}.*$/, '').replace(/\n.*$/, '').trim();

  if (fromCity || fromAddress) {
    const fromVal = fromAddress || (fromCity.charAt(0).toUpperCase() + fromCity.slice(1));
    result.fromValue = fromVal;
    result.log.push('📍 Звідки: ' + fromVal);
  }
  if (toCity || toAddress) {
    const toVal = toAddress || (toCity.charAt(0).toUpperCase() + toCity.slice(1));
    result.toValue = toVal;
    result.log.push('📍 Куди: ' + toVal);
  }

  // 5. Time
  const timeMatch = text.match(/(\d{1,2}):(\d{2})(?!\d)/);
  if (timeMatch && parseInt(timeMatch[1]) < 24) {
    result.timing = timeMatch[1].padStart(2, '0') + ':' + timeMatch[2];
    result.log.push('🕐 Час: ' + result.timing);
  }

  // 6. Name
  let rawForName = raw;
  if (fromAddress) rawForName = rawForName.replace(fromAddress, '');
  if (toAddress) rawForName = rawForName.replace(toAddress, '');
  rawForName = rawForName.replace(/(?:виїзд|відправ\w*|забрати|прибут\w*|доставк\w*|привезти|посадка|висадка|адреса\w*)\s*[:：][^\n]*/gi, '');
  const nameWords = rawForName.match(/[А-ЯІЇЄҐ][а-яіїєґ'-]+/g);
  if (nameWords) {
    const excludeExact = ['до','від','людини','людин','пасажир','пасажири','пасажирів','місць','місце','їхати','іхати','їду','потрібно'];
    const allCities = [...KNOWN_CITIES_EU, ...KNOWN_CITIES_UA];
    if (fromCity) allCities.push(fromCity.toLowerCase());
    if (toCity) allCities.push(toCity.toLowerCase());
    const nameParts = nameWords.filter((w) => {
      const wl = w.toLowerCase();
      if (wl.length <= 1) return false;
      if (excludeExact.includes(wl)) return false;
      if (allCities.includes(wl)) return false;
      return true;
    });
    if (nameParts.length >= 1) {
      result.name = nameParts.slice(0, 3).join(' ');
      result.log.push('👤 ПіБ: ' + result.name);
    }
  }

  return result;
}

// Map parsed direction → backend "Напрям" string
export function directionToNapryam(d: 'ua-eu' | 'eu-ua'): string {
  return d === 'ua-eu' ? 'Україна-ЄВ' : 'Європа-УК';
}

// Detect direction from existing passenger.direction string
// Examples: 'Україна-ЄВ', 'Європа-УК', 'UA-EU', 'EU-UA'
export function isUaEu(dir: string): boolean {
  const first = String(dir || '').split(/[-–—→]/)[0].toLowerCase();
  return /укра|^ук$|ua/.test(first);
}
export function isEuUa(dir: string): boolean {
  const first = String(dir || '').split(/[-–—→]/)[0].toLowerCase();
  return /євр|^єв$|eu/.test(first);
}
