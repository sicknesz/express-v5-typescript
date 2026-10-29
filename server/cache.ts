
type Timestamped<Value> = { expiresAt: number, value: Value };

// eslint-disable-next-line
export interface Cache<Key, Value> {
  values(): MapIterator<Value>;
  keys(): MapIterator<Key>;
  get(key: Key): Value | undefined;
  set(key: Key, value: Value, ttl: number): this;
  delete(key: Key): boolean;
  clear(): void;
  purge(): void;
};
/*
type WithFrequency<Value> = Timestamped<Value> & { frequency: number };

export class LFUCache<Key, Value> implements Cache<Key, Value> {

  #capacity: number;
  #cache: Map<Key, WithFrequency<Value>>;
  #ttlMs: number;

  constructor({ capacity, ttlMs, purgeInterval }: CacheOptions) {
    this.#capacity = capacity;
    this.#ttlMs = ttlMs;
    this.#cache = new Map<Key, WithFrequency<Value>>();

    // setInterval(this.purge.bind(this), purgeInterval);
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

  get head(): [Key, Value] | undefined {
    const iterator = this.#cache[Symbol.iterator]();
    const entry = iterator.next().value;
    if (!entry) {
      return undefined;
    }
    const [key, value] = entry;
    return [key, value.value];
  }

  get tail(): [Key, Value] | undefined {
    const result = [...this.#cache];
    const entry = result[result.length - 1];
    if (!entry) {
      return undefined;
    }
    const [key, value] = entry;
    return [key, value.value];
  }

  addJitter(ttlMs: number) {
    const randomJitter = Math.round(Math.random() * 1000);
    return ttlMs + randomJitter;
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

  delete(key: Key): boolean {
    return this.#cache.delete(key);
  }

  get(key: Key): Value | undefined {

    if (this.#cache.size >= this.#capacity) {
      // remove least frequently used element
    }

    return;
  }



  clear() {
    this.#cache.clear();
  }
}
*/

export type CacheOptions = { capacity: number, ttlMs: number, purgeInterval: number };
/**
 * @brief TTL based LRU (Least Recently Used) cache using Map<K,V> internally 
 * @example 
 * ```typescript 
 *     const options = { capacity: 2, ttlMs: 10000, purgeInterval : 50000 };
 *     const cache = new LRUCache<string, number>(options);
 *     cache.set("1", 333); // 0
 *     cache.set("2", 666); // 1
 *     cache.set("3", 999); // 2
 *     cache.set("4", 444); // 3
 *     // cache contains : [ ["3", 999], ["4", 444] ]
 *     // after 50000ms the purge is called and all elements older than 10000 will be purged
 * ```
 */
export class LRUCache<Key, Value> implements Cache<Key, Value> {

  #capacity: number;
  #cache: Map<Key, Timestamped<Value>>;
  #ttlMs: number;

  constructor({ capacity, ttlMs, purgeInterval }: CacheOptions) {
    this.#capacity = capacity;
    this.#ttlMs = ttlMs;
    this.#cache = new Map<Key, Timestamped<Value>>();

    setInterval(this.purge.bind(this), purgeInterval);
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

  get head(): [Key, Value] | undefined {
    const iterator = this.iterator;
    const entry = iterator.next().value;
    if (!entry) {
      return undefined;
    }
    const [key, value] = entry;
    return [key, value.value];
  }

  get tail(): [Key, Value] | undefined {
    const result = [...this.#cache];
    const entry = result[result.length - 1];
    if (!entry) {
      return undefined;
    }
    const [key, value] = entry;
    return [key, value.value];
  }

  addJitter(ttlMs: number) {
    const randomJitter = Math.round(Math.random() * 1000);
    return ttlMs + randomJitter;
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

    // to maintain the head as the least recently used 
    this.#cache.delete(key);
    const { expiresAt, value } = entry;
    if (Date.now() > expiresAt) {
      return undefined;
    }

    const deadLine = Date.now() + this.addJitter(this.#ttlMs);
    this.#cache.set(key, { expiresAt: deadLine, value: value });

    return value;
  }

  delete(key: Key): boolean {
    return this.#cache.delete(key);
  }

  set(key: Key, value: Value, ttl: number = this.#ttlMs): this {

    if (this.#cache.size >= this.#capacity) {
      const { head } = this;
      if (head) {
        this.#cache.delete(head[0]);
      }
    }

    const deadLine = Date.now() + this.addJitter(ttl);
    this.#cache.set(key, { expiresAt: deadLine, value: value });
    return this;
  }

  purge() {
    for (const [key, value] of this.#cache.entries()) {
      if (Date.now() > value.expiresAt) {
        this.#cache.delete(key);
      }
    }
  }

  clear() {
    this.#cache.clear();
  }
}

