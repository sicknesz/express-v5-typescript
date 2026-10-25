
import { LRUCache, type CacheOptions } from "../cache.ts"
import { expect, test } from "vitest";

const options: CacheOptions = { capacity: 5, ttlMs: 5000, purgeInterval: 10000 };

test("LRU should remove the least recently used entry when calling set on a full cache", () => {

    const cache = new LRUCache<string, number>(options);
    cache.set("1", 333); // 0
    cache.set("2", 666); // 1
    cache.set("3", 999); // 2
    cache.set("4", 444); // 3
    cache.set("5", 222); // 4
    cache.set("OVERCAPACITY", 111); // 5 -- should remove the "1"

    const expected = [
        ["2", {
            expiresAt: expect.any(Number),
            value: 666,
        }], ["3", {
            expiresAt: expect.any(Number),
            value: 999,
        }], ["4", {
            expiresAt: expect.any(Number),
            value: 444,
        }], ["5", {
            expiresAt: expect.any(Number),
            value: 222,
        }], ["OVERCAPACITY", {
            expiresAt: expect.any(Number),
            value: 111,
        }]
    ];

    const result = [...cache];

    expect(result).toStrictEqual(expected)
})


test("LRU should mark as lru the latest accessed element", () => {

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