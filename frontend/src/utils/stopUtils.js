import { createElement } from 'react';
import { Landmark, Coffee, Utensils, Hotel, MapPin } from 'lucide-react';

/**
 * Helper to compute category and numbered label (e.g. "Cafe 1", "Sight 2", "Food 1")
 * for a stop within a given day's stops list.
 */
export function getStopLabel(stop, dayStops = []) {
  const counters = { cafe: 0, sight: 0, food: 0, hotel: 0, other: 0 };
  
  for (const s of dayStops) {
    let cat = s.category;
    if (!cat) {
      const lower = (s.name || '').toLowerCase();
      if (lower.includes('cafe') || lower.includes('coffee') || lower.includes('tea') || lower.includes('bakery') || lower.includes('roastery')) {
        cat = 'cafe';
      } else if (lower.includes('restaurant') || lower.includes('snack') || lower.includes('ramen') || lower.includes('sushi') || lower.includes('food') || lower.includes('dining') || lower.includes('bistro') || lower.includes('izakaya')) {
        cat = 'food';
      } else if (lower.includes('hotel') || lower.includes('inn') || lower.includes('hostel') || lower.includes('stay')) {
        cat = 'hotel';
      } else {
        cat = 'sight';
      }
    }
    
    counters[cat] = (counters[cat] || 0) + 1;

    if (s.id === stop.id) {
      let catTitle = 'Sight';
      let iconType = 'sight';
      if (cat === 'cafe') { catTitle = 'Cafe'; iconType = 'cafe'; }
      else if (cat === 'food') { catTitle = 'Food'; iconType = 'food'; }
      else if (cat === 'hotel') { catTitle = 'Hotel'; iconType = 'hotel'; }
      else if (cat === 'sight') { catTitle = 'Sight'; iconType = 'sight'; }
      else { catTitle = 'Stop'; iconType = 'pin'; }

      const num = counters[cat];
      return {
        category: cat,
        number: num,
        label: `${catTitle} ${num}`,
        iconType
      };
    }
  }

  return { category: 'sight', number: 1, label: 'Sight 1', iconType: 'sight' };
}

export function CategoryIcon({ iconType, className = "w-3.5 h-3.5", size = 14 }) {
  switch (iconType) {
    case 'cafe': return createElement(Coffee, { size, className });
    case 'food': return createElement(Utensils, { size, className });
    case 'hotel': return createElement(Hotel, { size, className });
    case 'sight': return createElement(Landmark, { size, className });
    default: return createElement(MapPin, { size, className });
  }
}

