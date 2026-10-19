type Timestamped<Value> = { expiresAt: number, value: Value };
export default class LRUCache<Key, Value> {

  capacity: number;
  cache: Map<Key, Timestamped<Value>>;
  ttlMs: number;

  constructor(capacity: number, ttlMs: number) {
    this.capacity = capacity;
    this.ttlMs = ttlMs;
    this.cache = new Map<Key, Timestamped<Value>>();
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

  get(key: Key): Value | null {

    this.purgeExpiredEntries();

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

  delete(key: Key): boolean {
    return this.cache.delete(key);
  }

  set(key: Key, value: Value): void {

    this.purgeExpiredEntries();

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

  purgeExpiredEntries(): void {
    for (const [key, value] of this.cache.entries()) {
      if (Date.now() > value.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

