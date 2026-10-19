type Value<V> = { expiresAt: number, value: V };

export default class LRUCache<K, V> {

  capacity: number;
  cache: Map<K, Value<V>>;
  ttlMs: number;

  constructor(capacity: number, ttlMs: number) {
    this.capacity = capacity;
    this.ttlMs = ttlMs;
    this.cache = new Map<K, Value<V>>();
  }

  get iterator() {
    const iterator = this.cache[Symbol.iterator]();
    return iterator;
  }

  get size() {
    return this.cache.size;
  }

  get head() {
    const iterator = this.cache[Symbol.iterator]();
    const entry = iterator.next().value;
    return entry;
  }

  get tail() {
    const result = [...this.cache];
    const entry = result[result.length - 1];
    return entry;
  }

  get(key: K): V | null {

    this.removeExpiredEntries();

    // if present 
    if (!this.cache.has(key)) {
      return null;
    }

    // read value 
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    const { expiresAt, value } = entry;
    if (Date.now() > expiresAt) {
      this.cache.delete(key);
      return null;
    }
    // to maintain the head as the least recently used 
    this.cache.delete(key);
    this.cache.set(key, { expiresAt: Date.now() + this.ttlMs, value: value });

    return entry.value;
  }

  set(key: K, value: V) {

    this.removeExpiredEntries();

    if (this.cache.size >= this.capacity) {
      // remove oldest 
      const { head } = this;
      if (head) {
        this.cache.delete(head[0]);
      }
    }

    const deadLine = Date.now() + this.ttlMs;
    this.cache.set(key, { expiresAt: deadLine, value: value });
  }

  removeExpiredEntries() {
    for (const [key, value] of this.cache.entries()) {
      if (Date.now() > value.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  clear() {
    this.cache.clear();
  }
}

