/**
 * Currency utility module for Wanderloop.
 * Resolves currency symbols and codes dynamically based on destination place, coordinates, or trip attributes.
 */

const CURRENCY_MAP = [
  {
    code: 'INR',
    symbol: '₹',
    keywords: ['india', 'manali', 'mumbai', 'delhi', 'goa', 'jaipur', 'agra', 'bengaluru', 'kerala', 'kolkata', 'chennai', 'shimla', 'varanasi', 'udaipur', 'rishikesh', 'ladakh', 'darjeeling'],
    bounds: { minLat: 8, maxLat: 37, minLng: 68, maxLng: 97 }
  },
  {
    code: 'JPY',
    symbol: '¥',
    keywords: ['japan', 'tokyo', 'kyoto', 'osaka', 'hakone', 'nara', 'hiroshima', 'sapporo', 'fukuoka', 'yokohama', 'kobe', 'nikko', 'kamakura', 'kanazawa', 'takayama'],
    bounds: { minLat: 24, maxLat: 46, minLng: 122, maxLng: 154 }
  },
  {
    code: 'GBP',
    symbol: '£',
    keywords: ['uk', 'united kingdom', 'london', 'edinburgh', 'manchester', 'oxford', 'cambridge', 'scotland', 'belfast', 'liverpool', 'birmingham', 'bath'],
    bounds: { minLat: 50, maxLat: 59, minLng: -8, maxLng: 2 }
  },
  {
    code: 'EUR',
    symbol: '€',
    keywords: ['europe', 'paris', 'france', 'rome', 'milan', 'venice', 'florence', 'italy', 'barcelona', 'madrid', 'spain', 'berlin', 'munich', 'germany', 'amsterdam', 'netherlands', 'vienna', 'austria', 'lisbon', 'portugal', 'dublin', 'ireland', 'athens', 'greece', 'brussels', 'belgium', 'prague', 'czech'],
    bounds: { minLat: 35, maxLat: 71, minLng: -10, maxLng: 32 }
  },
  {
    code: 'USD',
    symbol: '$',
    keywords: ['usa', 'united states', 'america', 'new york', 'los angeles', 'san francisco', 'chicago', 'miami', 'las vegas', 'hawaii', 'washington', 'boston', 'seattle', 'orlando', 'orleans', 'austin', 'san diego'],
    bounds: { minLat: 24, maxLat: 50, minLng: -125, maxLng: -66 }
  },
  {
    code: 'AUD',
    symbol: 'A$',
    keywords: ['australia', 'sydney', 'melbourne', 'brisbane', 'perth', 'adelaide', 'cairns', 'gold coast'],
    bounds: { minLat: -44, maxLat: -10, minLng: 112, maxLng: 154 }
  },
  {
    code: 'CAD',
    symbol: 'CA$',
    keywords: ['canada', 'toronto', 'vancouver', 'montreal', 'banff', 'quebec', 'ottawa', 'calgary'],
    bounds: { minLat: 42, maxLat: 70, minLng: -141, maxLng: -52 }
  },
  {
    code: 'SGD',
    symbol: 'S$',
    keywords: ['singapore'],
    bounds: { minLat: 1, maxLat: 1.5, minLng: 103.5, maxLng: 104.1 }
  },
  {
    code: 'THB',
    symbol: '฿',
    keywords: ['thailand', 'bangkok', 'phuket', 'chiang mai', 'pattaya', 'krabi', 'samui'],
    bounds: { minLat: 5, maxLat: 21, minLng: 97, maxLng: 106 }
  },
  {
    code: 'AED',
    symbol: 'AED',
    keywords: ['uae', 'united arab emirates', 'dubai', 'abu dhabi', 'sharjah'],
    bounds: { minLat: 22, maxLat: 26, minLng: 51, maxLng: 57 }
  },
  {
    code: 'CHF',
    symbol: 'CHF',
    keywords: ['switzerland', 'zurich', 'geneva', 'interlaken', 'lucerne', 'zermatt', 'swiss'],
    bounds: { minLat: 45.8, maxLat: 47.8, minLng: 5.9, maxLng: 10.5 }
  },
  {
    code: 'KRW',
    symbol: '₩',
    keywords: ['korea', 'seoul', 'busan', 'jeju', 'incheon'],
    bounds: { minLat: 33, maxLat: 39, minLng: 124, maxLng: 131 }
  },
  {
    code: 'IDR',
    symbol: 'Rp',
    keywords: ['indonesia', 'bali', 'jakarta', 'ubud', 'lombok'],
    bounds: { minLat: -11, maxLat: 6, minLng: 95, maxLng: 141 }
  },
  {
    code: 'VND',
    symbol: '₫',
    keywords: ['vietnam', 'hanoi', 'ho chi minh', 'da nang', 'hoi an'],
    bounds: { minLat: 8, maxLat: 24, minLng: 102, maxLng: 110 }
  }
];

/**
 * Returns the currency object ({ code, symbol }) for a given trip or destination place string / coords.
 */
export function getTripCurrency(trip) {
  if (!trip) {
    return { code: 'JPY', symbol: '¥' };
  }

  // 1. Explicit symbol/code on trip object
  if (trip.currencySymbol) {
    return { code: trip.currency || 'USD', symbol: trip.currencySymbol };
  }

  const textToSearch = [
    trip.destination || '',
    trip.title || '',
    ...(trip.days || []).flatMap(d => (d.stops || []).map(s => s.name || ''))
  ].join(' ').toLowerCase();

  // 2. Keyword matching on destination/title/stops
  for (const item of CURRENCY_MAP) {
    if (item.keywords.some(kw => textToSearch.includes(kw))) {
      return { code: item.code, symbol: item.symbol };
    }
  }

  // 3. Coordinate bounds matching
  let lat = null;
  let lng = null;
  if (trip.days && trip.days.length > 0) {
    for (const d of trip.days) {
      if (d.stops && d.stops.length > 0) {
        lat = d.stops[0].lat;
        lng = d.stops[0].lng;
        break;
      }
    }
  }

  if (lat !== null && lng !== null) {
    for (const item of CURRENCY_MAP) {
      if (
        lat >= item.bounds.minLat &&
        lat <= item.bounds.maxLat &&
        lng >= item.bounds.minLng &&
        lng <= item.bounds.maxLng
      ) {
        return { code: item.code, symbol: item.symbol };
      }
    }
  }

  // Default fallback to JPY if Tokyo/Japan default or $ if generic
  return { code: 'USD', symbol: '$' };
}

/**
 * Gets just the currency symbol for a trip.
 */
export function getCurrencySymbol(trip) {
  return getTripCurrency(trip).symbol;
}

/**
 * Default budget multiplier per currency to set realistic limits when AI generates a trip.
 */
export function getDefaultBudgetLimit(currencyCode) {
  switch (currencyCode) {
    case 'JPY': return 20000;
    case 'INR': return 8000;
    case 'EUR': return 400;
    case 'GBP': return 350;
    case 'USD': return 450;
    case 'AUD': return 650;
    case 'CAD': return 600;
    case 'THB': return 7000;
    case 'AED': return 1500;
    case 'SGD': return 550;
    case 'KRW': return 200000;
    case 'IDR': return 2000000;
    default: return 450;
  }
}

/**
 * Estimates cost for a POI or stop, calculating average cafe / food / entry price in the trip's local currency.
 */
export function estimateStopCost(poiOrName, trip) {
  const name = (typeof poiOrName === 'string' ? poiOrName : (poiOrName.name || '')).toLowerCase();
  const category = (typeof poiOrName === 'object' && poiOrName.category ? poiOrName.category : '').toLowerCase();

  const isFoodOrCafe =
    category === 'cafe' ||
    category === 'food' ||
    category === 'restaurant' ||
    /cafe|coffee|roastery|bakes|bakery|restaurant|bistro|diner|food|kitchen|eatery|ramen|sushi|tacos|pizza|burger|tea|bar|grill|noodle|thali|dhaba|snack/i.test(name);

  const isFreeSpot = /park|garden|bridge|viewpoint|street|square|walk|temple|shrine|beach|lookout/i.test(name) && !isFoodOrCafe;

  const { code } = getTripCurrency(trip);

  if (isFoodOrCafe) {
    switch (code) {
      case 'INR': return category === 'cafe' ? 200 : 400;
      case 'EUR': return category === 'cafe' ? 5 : 12;
      case 'GBP': return category === 'cafe' ? 4 : 10;
      case 'USD': return category === 'cafe' ? 6 : 15;
      case 'AUD': return category === 'cafe' ? 8 : 18;
      case 'CAD': return category === 'cafe' ? 7 : 16;
      case 'THB': return category === 'cafe' ? 80 : 180;
      case 'AED': return category === 'cafe' ? 20 : 50;
      case 'JPY': default: return category === 'cafe' ? 600 : 1200;
    }
  }

  if (isFreeSpot) return 0;

  // General attraction / ticket entry default
  switch (code) {
    case 'INR': return 150;
    case 'EUR': return 8;
    case 'GBP': return 7;
    case 'USD': return 10;
    case 'JPY': default: return 500;
  }
}
