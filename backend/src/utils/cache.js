class Cache {
  constructor(ttlSeconds = 3600) {
    this.cache = new Map();
    this.ttl = ttlSeconds * 1000;
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  }

  set(key, value) {
    this.cache.set(key, {
      value,
      expiry: Date.now() + this.ttl
    });
  }

  clear() {
    this.cache.clear();
  }
}

export const routeCache = new Cache(3600); // 1 hour TTL
export const geocodeCache = new Cache(86400); // 24 hours TTL
export const poiCache = new Cache(3600); // 1 hour TTL
