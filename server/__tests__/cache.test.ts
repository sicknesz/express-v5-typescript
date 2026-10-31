
import { LRUCache, type CacheOptions } from "../cache.ts"
import { expect, test } from "vitest";

const options: CacheOptions = { capacity: 10, ttlMs: 5000, purgeInterval: 10000 };

test("LRU should remove the least recently used entry when calling set on a full cache", () => {

    const cache = new LRUCache<string, number>(options);
    cache.set("1", 333); // 0
    cache.set("2", 666); // 1
    cache.set("3", 999); // 2
    cache.set("4", 444); // 3
    cache.set("5", 222); // 4
    cache.set("5", 223); // 5
    cache.set("5", 224); // 6
    cache.set("5", 225); // 7
    cache.set("5", 226); // 8
    cache.set("OVERCAPACITY", 111); // 9 -- should remove the "1"

    cache.get("1");
    cache.get("3");
    cache.get("4");
    cache.get("5");
    cache.get("OVERCAPACITY");

    const keys = ["2", "1", "3", "4", "5", "OVERCAPACITY"];
    const values = [
        { "expiresAt": expect.any(Number), "value": 666 },
        { "expiresAt": expect.any(Number), "value": 333 },
        { "expiresAt": expect.any(Number), "value": 999 },
        { "expiresAt": expect.any(Number), "value": 444 },
        { "expiresAt": expect.any(Number), "value": 226 },
        { "expiresAt": expect.any(Number), "value": 111 }
    ];

    const resultKeys = [...cache.cache.keys()];
    const resultValues = [...cache.cache.values()];

    expect(resultKeys).toStrictEqual(keys);
    expect(resultValues).toStrictEqual(values);
})

test("LRU .size should return the size", () => {

    options.capacity = 5;
    const cache = new LRUCache<string, number>(options);
    cache.set("1", 333);
    cache.set("2", 666);
    cache.set("3", 999);

    expect(cache.size).toEqual(3);
})

test("LRU calling .head on empty cache returns undefined", () => {
    const cache = new LRUCache<string, number>(options);
    const head = cache.head;
    expect(head).toEqual(undefined);
})

test("LRU calling .tail on empty cache returns undefined", () => {
    const cache = new LRUCache<string, number>(options);
    const tail = cache.tail;
    expect(tail).toEqual(undefined);
})

test("LRU getting an non-existent key returns undefined", () => {

    options.capacity = 5;
    const cache = new LRUCache<string, number>(options);
    cache.set("1", 333);

    const entry = cache.get("2");
    expect(entry).toEqual(undefined);
});

// should cover line 201-202 .. but 
test("LRU getting an expired key returns undefined", async () => {

    options.capacity = 5;
    const cache = new LRUCache<string, number>({ capacity: 1, ttlMs: 10, purgeInterval: 50, jitter: 1 });
    cache.set("1", 333);
    cache.set("2", 444);
    cache.set("3", 444);

    // 250 + 1000 (due to jitter)
    await new Promise(resolve => setTimeout(resolve, 250));

    const one = cache.get("1");
    const two = cache.get("2");
    const three = cache.get("3");
    expect(cache.size).toEqual(0);
    expect(one).toEqual(undefined);
    expect(two).toEqual(undefined);
    expect(three).toEqual(undefined);
});

test("LRU should mark as lru the latest accessed element", () => {

    options.capacity = 5;
    const cache = new LRUCache<string, number>(options);
    cache.set("1", 333);
    cache.set("2", 666);
    cache.set("3", 999);
    cache.set("4", 444);
    cache.set("5", 222);
    cache.get("2");
    cache.set("OVERCAPACITY", 111);

    const keys = ["3", "4", "5", "2", "OVERCAPACITY"];
    const values = [
        { "expiresAt": expect.any(Number), "value": 999 },
        { "expiresAt": expect.any(Number), "value": 444 },
        { "expiresAt": expect.any(Number), "value": 222 },
        { "expiresAt": expect.any(Number), "value": 666 },
        { "expiresAt": expect.any(Number), "value": 111 }
    ];

    const resultKeys = [...cache.cache.keys()];
    const resultValues = [...cache.cache.values()];

    expect(resultKeys).toStrictEqual(keys);
    expect(resultValues).toStrictEqual(values);
})

test("LRU should delete element when asked", () => {

    const cache = new LRUCache<string, number>(options);
    cache.set("1", 333);
    cache.set("2", 666);
    cache.set("3", 999);
    cache.set("4", 444);
    cache.set("5", 222);

    cache.delete("3");

    const keys = ["1", "2", "4", "5"];
    const values = [333, 666, 444, 222];

    const resultKeys = [...cache.keys()];
    const resultValues = [...cache.values()];

    expect(resultKeys).toStrictEqual(keys);
    expect(resultValues).toStrictEqual(values);
})


test("LRU should purge TTL expired element after purge interval", async () => {

    const cache = new LRUCache<string, number>({ capacity: 5, ttlMs: 1, purgeInterval: 5 });
    cache.set("1", 333);
    cache.set("2", 666);
    cache.set("3", 999);
    cache.set("4", 444);
    cache.set("5", 222);

    await new Promise((resolve) => setTimeout(resolve, 1500)); // sleep for 10ms to allow purge to happen

    const expected: number[] = [];
    expect([...cache]).toStrictEqual(expected);
})

test("LRU should return the head when calling .head()", () => {
    const cache = new LRUCache<string, number>(options);
    cache.set("1", 333);
    cache.set("2", 666);
    cache.set("3", 999);
    cache.set("4", 444);
    cache.set("5", 222);
    cache.set("OVERCAPACITY", 111); // this element will remove the '1' hence the '2' in the head as expected

    const head = cache.head;
    expect(head).toStrictEqual(["2", 666]);
})

test("LRU should return the head when calling .tail()", () => {
    const cache = new LRUCache<string, number>(options);
    cache.set("1", 333);
    cache.set("2", 666);
    cache.set("3", 999);
    cache.set("4", 444);
    cache.set("5", 222);
    cache.set("OVERCAPACITY", 111);

    const tail = cache.tail;
    expect(tail).toStrictEqual(["OVERCAPACITY", 111]);
})

test("LRU should be empty after calling cache.clear()", () => {

    const cache = new LRUCache<string, number>(options);
    cache.set("1", 333);
    cache.set("2", 666);
    cache.set("3", 999);
    cache.set("4", 444);
    cache.set("5", 222);
    cache.set("OVERCAPACITY", 111);
    cache.clear();

    const expected: number[] = [];
    expect([...cache]).toStrictEqual(expected);
})

// test("LRU can be iterated using for..of", () => {
//     const cache = new LRUCache<string, number>(options);
//     cache.set("1", 333);
//     cache.set("2", 666);
//     cache.set("3", 999);
//     cache.set("4", 444);
//     cache.set("5", 222);

//     for (const [key, value] of cache) {
//         console.log(key, value);
//     }

//     const keys = ["1", "2", "3", "4", "5"];
//     const values = [333, 666, 999, 444, 222];

//     const resultKeys = [...cache.keys()];
//     const resultValues = [...cache.values()];

//     expect(resultKeys).toStrictEqual(keys);
//     expect(resultValues).toStrictEqual(values);
// })