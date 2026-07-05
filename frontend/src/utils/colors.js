export const getDayColorHex = (hue) => {
  switch (hue) {
    case 'teal': return '#2dd4bf';
    case 'amber': return '#fbbf24';
    case 'violet': return '#c084fc';
    case 'rose': return '#f43f5e';
    case 'lime': return '#a3e635';
    default: return '#2dd4bf';
  }
};

export const getDayColorTextClass = (hue) => {
  switch (hue) {
    case 'teal': return 'text-day-1';
    case 'amber': return 'text-day-2';
    case 'violet': return 'text-day-3';
    case 'rose': return 'text-day-4';
    case 'lime': return 'text-day-5';
    default: return 'text-day-1';
  }
};

export const getDayColorBgClass = (hue) => {
  switch (hue) {
    case 'teal': return 'bg-day-1';
    case 'amber': return 'bg-day-2';
    case 'violet': return 'bg-day-3';
    case 'rose': return 'bg-day-4';
    case 'lime': return 'bg-day-5';
    default: return 'bg-day-1';
  }
};

export const getDayColorBorderClass = (hue) => {
  switch (hue) {
    case 'teal': return 'border-day-1';
    case 'amber': return 'border-day-2';
    case 'violet': return 'border-day-3';
    case 'rose': return 'border-day-4';
    case 'lime': return 'border-day-5';
    default: return 'border-day-1';
  }
};
