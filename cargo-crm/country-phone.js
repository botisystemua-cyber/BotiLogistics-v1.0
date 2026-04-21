// ============================================================
// country-phone.js — селектор країни + автодетект коду країни
// Використовується в scaner_ttn.html та index.html (fill-modal).
// Експорт: window.CountryPhone.{ attach, detect, normalize,
// COUNTRIES, findByIso }
// ============================================================
(function () {
  'use strict';

  // Актуально для логістики UA ↔ EU. Сортовано від найчастіших
  // напрямків до решти.
  var COUNTRIES = [
    // Головні напрямки
    { iso: 'UA', flag: '🇺🇦', code: '380', name: 'Україна' },
    { iso: 'PL', flag: '🇵🇱', code: '48',  name: 'Польща' },
    { iso: 'CZ', flag: '🇨🇿', code: '420', name: 'Чехія' },
    { iso: 'SK', flag: '🇸🇰', code: '421', name: 'Словаччина' },
    { iso: 'HU', flag: '🇭🇺', code: '36',  name: 'Угорщина' },
    { iso: 'DE', flag: '🇩🇪', code: '49',  name: 'Німеччина' },
    { iso: 'AT', flag: '🇦🇹', code: '43',  name: 'Австрія' },
    { iso: 'IT', flag: '🇮🇹', code: '39',  name: 'Італія' },
    { iso: 'CH', flag: '🇨🇭', code: '41',  name: 'Швейцарія' },
    // Решта ЄС
    { iso: 'ES', flag: '🇪🇸', code: '34',  name: 'Іспанія' },
    { iso: 'PT', flag: '🇵🇹', code: '351', name: 'Португалія' },
    { iso: 'FR', flag: '🇫🇷', code: '33',  name: 'Франція' },
    { iso: 'NL', flag: '🇳🇱', code: '31',  name: 'Нідерланди' },
    { iso: 'BE', flag: '🇧🇪', code: '32',  name: 'Бельгія' },
    { iso: 'LU', flag: '🇱🇺', code: '352', name: 'Люксембург' },
    { iso: 'IE', flag: '🇮🇪', code: '353', name: 'Ірландія' },
    { iso: 'DK', flag: '🇩🇰', code: '45',  name: 'Данія' },
    { iso: 'FI', flag: '🇫🇮', code: '358', name: 'Фінляндія' },
    { iso: 'GR', flag: '🇬🇷', code: '30',  name: 'Греція' },
    { iso: 'HR', flag: '🇭🇷', code: '385', name: 'Хорватія' },
    { iso: 'SI', flag: '🇸🇮', code: '386', name: 'Словенія' },
    { iso: 'RO', flag: '🇷🇴', code: '40',  name: 'Румунія' },
    { iso: 'BG', flag: '🇧🇬', code: '359', name: 'Болгарія' },
    { iso: 'EE', flag: '🇪🇪', code: '372', name: 'Естонія' },
    { iso: 'LV', flag: '🇱🇻', code: '371', name: 'Латвія' },
    { iso: 'LT', flag: '🇱🇹', code: '370', name: 'Литва' },
    { iso: 'MT', flag: '🇲🇹', code: '356', name: 'Мальта' },
    { iso: 'CY', flag: '🇨🇾', code: '357', name: 'Кіпр' },
    // Європа не-ЄС
    { iso: 'GB', flag: '🇬🇧', code: '44',  name: 'Великобританія' },
    { iso: 'SE', flag: '🇸🇪', code: '46',  name: 'Швеція' },
    { iso: 'NO', flag: '🇳🇴', code: '47',  name: 'Норвегія' },
    { iso: 'IS', flag: '🇮🇸', code: '354', name: 'Ісландія' },
    { iso: 'MD', flag: '🇲🇩', code: '373', name: 'Молдова' },
  ];

  // Мапа code → country і список кодів, відсортований за довжиною (desc),
  // щоб 380 матчився раніше за 38 (якби останній існував).
  var CODE_MAP = {};
  COUNTRIES.forEach(function (c) { CODE_MAP[c.code] = c; });
  var CODES_SORTED = COUNTRIES.map(function (c) { return c.code; })
    .sort(function (a, b) { return b.length - a.length; });

  function findByIso(iso) {
    for (var i = 0; i < COUNTRIES.length; i++) {
      if (COUNTRIES[i].iso === iso) return COUNTRIES[i];
    }
    return null;
  }

  // Спроба визначити країну з префіксу цифр номера.
  // Повертає country або null.
  function detect(phone) {
    var digits = String(phone || '').replace(/\D/g, '');
    if (!digits) return null;
    for (var i = 0; i < CODES_SORTED.length; i++) {
      var code = CODES_SORTED[i];
      if (digits.indexOf(code) === 0) return CODE_MAP[code];
    }
    return null;
  }

  // Нормалізація номера з урахуванням обраної країни.
  // Пріоритет:
  //   1. Якщо вже починається з коду якоїсь відомої країни — приймаємо
  //      як є (навіть якщо це інша країна — людина явно вставила «чуже»).
  //   2. UA-правила: 0XXXXXXXXX → +380XXXXXXXXX; 9 цифр → +380XXXXXXXXX.
  //   3. Інші країни: ведучий 0 = локальний префікс, прибираємо.
  //   4. Fallback: просто префіксуємо обраним кодом.
  function normalize(raw, country) {
    var digits = String(raw || '').replace(/\D/g, '');
    if (!digits) return '';
    var auto = detect(digits);
    if (auto) return '+' + digits;
    if (country && country.iso === 'UA') {
      if (digits.length === 10 && digits.charAt(0) === '0') return '+380' + digits.slice(1);
      if (digits.length === 9) return '+380' + digits;
    }
    if (country && digits.charAt(0) === '0') return '+' + country.code + digits.slice(1);
    if (country) return '+' + country.code + digits;
    return '+' + digits;
  }

  // Підключає селектор країни зліва від існуючого input.
  // opts: { theme: 'light'|'dark', defaultCountry: 'UA',
  //         onChange: fn(phone, country) }
  // Повертає { wrap, select, input, getCountry(), setCountry(iso),
  //            syncFromValue() }.
  function attach(inputEl, opts) {
    if (!inputEl) return null;
    if (inputEl._cpApi) return inputEl._cpApi;
    opts = opts || {};
    var theme = opts.theme || 'light';
    var defaultIso = opts.defaultCountry || 'UA';
    var onChange = opts.onChange;

    var wrap = document.createElement('div');
    wrap.className = 'cp-wrap' + (theme === 'dark' ? ' cp-wrap-dark' : '');

    var sel = document.createElement('select');
    sel.className = 'cp-select';
    sel.setAttribute('aria-label', 'Код країни');
    COUNTRIES.forEach(function (c) {
      var opt = document.createElement('option');
      opt.value = c.iso;
      opt.textContent = c.flag + ' +' + c.code;
      opt.title = c.name;
      sel.appendChild(opt);
    });
    sel.value = defaultIso;

    // Ставимо wrap на місце input, переміщаємо input усередину.
    var parent = inputEl.parentNode;
    parent.insertBefore(wrap, inputEl);
    wrap.appendChild(sel);
    wrap.appendChild(inputEl);
    inputEl.classList.add('cp-input');

    function getCountry() {
      return findByIso(sel.value) || COUNTRIES[0];
    }
    function setCountry(iso) {
      if (findByIso(iso)) sel.value = iso;
    }
    function syncFromValue() {
      var c = detect(inputEl.value);
      if (c && c.iso !== sel.value) sel.value = c.iso;
    }
    function fireChange() {
      if (onChange) onChange(inputEl.value, getCountry());
    }

    inputEl.addEventListener('focus', function () {
      if (!inputEl.value) inputEl.value = '+' + getCountry().code;
    });
    inputEl.addEventListener('paste', function (e) {
      e.preventDefault();
      var pasted = (e.clipboardData || window.clipboardData).getData('text');
      inputEl.value = normalize(pasted, getCountry());
      syncFromValue();
      fireChange();
    });
    inputEl.addEventListener('blur', function () {
      var cur = getCountry();
      if (inputEl.value && inputEl.value !== ('+' + cur.code)) {
        inputEl.value = normalize(inputEl.value, cur);
        syncFromValue();
      }
      fireChange();
    });
    inputEl.addEventListener('input', function () {
      syncFromValue();
      fireChange();
    });
    sel.addEventListener('change', function () {
      var cur = getCountry();
      var digits = (inputEl.value || '').replace(/\D/g, '');
      if (!digits) {
        inputEl.value = '+' + cur.code;
      } else {
        // Відрізаємо попередній код (якщо в номері він вже був), ставимо новий.
        var prev = detect(digits);
        var body = prev ? digits.slice(prev.code.length) : digits;
        inputEl.value = '+' + cur.code + body;
      }
      fireChange();
    });

    if (inputEl.value) syncFromValue();

    var api = {
      wrap: wrap, select: sel, input: inputEl,
      getCountry: getCountry, setCountry: setCountry,
      syncFromValue: syncFromValue,
    };
    inputEl._cpApi = api;
    return api;
  }

  window.CountryPhone = {
    attach: attach,
    detect: detect,
    normalize: normalize,
    findByIso: findByIso,
    COUNTRIES: COUNTRIES,
  };
})();
