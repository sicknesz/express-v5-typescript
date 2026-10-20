
type Timestamped<Value> = { expiresAt: number, value: Value };


// eslint-disable-next-line
export interface Cache<Key, Value> {
  values(): MapIterator<Value>;
  keys(): MapIterator<Key>;
  get(key: Key): Value | undefined;
  delete(key: Key): boolean;
  set(key: Key, value: Value): this;
  clear(): void;
  purgeExpiredEntries(): void;
};

export default class LRUCache<Key, Value> implements Cache<Key, Value> {

  #capacity: number;
  #cache: Map<Key, Timestamped<Value>>;
  #ttlMs: number;

  constructor(capacity: number, ttlMs: number, purgeInterval: number) {
    this.#capacity = capacity;
    this.#ttlMs = ttlMs;
    this.#cache = new Map<Key, Timestamped<Value>>();
    setInterval(this.purgeExpiredEntries.bind(this), purgeInterval);
  }

  [Symbol.iterator]() {
    return this.#cache[Symbol.iterator]();
  }

  get cache() {
    return this.#cache;
  }

  get iterator() {
    const iterator = this.#cache[Symbol.iterator]();
    return iterator;
  }

  get size() {
    return this.#cache.size;
  }

  get head() {
    const iterator = this.#cache[Symbol.iterator]();
    const entry = iterator.next().value;
    return entry;
  }

  get tail() {
    const result = [...this.#cache];
    const entry = result[result.length - 1];
    return entry;
  }

  values() {
    const entries = this.#cache.values();
    const values = entries.map(e => e.value);
    return values;
  }

  keys() {
    const keys = this.#cache.keys();
    return keys;
  }

  get(key: Key): Value | undefined {

    // if present 
    if (!this.#cache.has(key)) {
      return undefined;
    }

    // read value 
    const entry = this.#cache.get(key);
    if (!entry) {
      return undefined;
    }

    const { expiresAt, value } = entry;
    if (Date.now() > expiresAt) {
      this.#cache.delete(key);
      return undefined;
    }
    // to maintain the head as the least recently used 
    this.#cache.delete(key);
    this.#cache.set(key, { expiresAt: Date.now() + this.#ttlMs, value: value });

    return value;
  }

  delete(key: Key): boolean {
    return this.#cache.delete(key);
  }

  set(key: Key, value: Value): this {

    this.purgeExpiredEntries();

    if (this.#cache.size >= this.#capacity) {
      // remove oldest 
      const { head } = this;
      if (head) {
        this.#cache.delete(head[0]);
      }
    }

    const deadLine = Date.now() + this.#ttlMs;
    this.#cache.set(key, { expiresAt: deadLine, value: value });
    return this;
  }

  purgeExpiredEntries(): void {
    for (const [key, value] of this.#cache.entries()) {
      if (Date.now() > value.expiresAt) {
        this.#cache.delete(key);
      }
    }
  }

  clear(): void {
    this.#cache.clear();
  }
}

