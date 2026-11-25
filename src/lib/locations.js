import { DEFAULT_LOCATION, DEFAULT_SETTINGS, locationName } from './buying';

// Little Rock keeps the original keys so a phone remembers its last location.
const storagePrefix = DEFAULT_SETTINGS.shopId && DEFAULT_SETTINGS.shopId !== 'gameday'
  ? DEFAULT_SETTINGS.shopId
  : 'gameday';
const CURRENT_KEY = `${storagePrefix}-buy-location`;
const RECENT_KEY = `${storagePrefix}-recent-locations`;

function storage() {
  try {
    return window.localStorage;
  } catch (ignore) {
    return null;
  }
}

export function readStoredLocation() {
  const store = storage();
  if (!store) return DEFAULT_LOCATION;
  return locationName(store.getItem(CURRENT_KEY));
}

export function readRecentLocations() {
  const store = storage();
  const names = [];
  if (store) {
    try {
      const parsed = JSON.parse(store.getItem(RECENT_KEY) || '[]');
      if (Array.isArray(parsed)) parsed.forEach((item) => names.push(locationName(item)));
    } catch (ignore) {
      // A bad saved list just falls back to the default location.
    }
  }
  if (!names.some((name) => name.toLowerCase() === DEFAULT_LOCATION.toLowerCase())) names.unshift(DEFAULT_LOCATION);
  const unique = [];
  names.forEach((name) => {
    if (!unique.some((item) => item.toLowerCase() === name.toLowerCase())) unique.push(name);
  });
  return unique.slice(0, 8);
}

/** Remember the location on this device and keep it in the recent picks. */
export function rememberLocation(value) {
  const name = locationName(value);
  const store = storage();
  if (!store) return name;
  store.setItem(CURRENT_KEY, name);
  const recent = [name, ...readRecentLocations().filter((item) => item.toLowerCase() !== name.toLowerCase())].slice(0, 8);
  store.setItem(RECENT_KEY, JSON.stringify(recent));
  return name;
}
