
import LRUCache from "../cache.ts"
// @ts-ignore
import { expect, test } from "bun:test";

test("LRU should remove the least recently used entry when calling set on a full cache", () => {

    const cache = new LRUCache<string, number>(5, 10000);
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

    const result = [...cache.cache];

    expect(result).toStrictEqual(expected)
})


test("LRU should mark as lru the latest accessed element", () => {

    const cache = new LRUCache<string, number>(5, 10000);
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

    const cache = new LRUCache<string, number>(5, 10000);
    cache.set("1", 333);
    cache.set("2", 666);
    cache.set("3", 999);
    cache.set("4", 444);
    cache.set("5", 222);

    cache.delete("3");

    const keys = ["1", "2", "4", "5"];
    const values = [
        { "expiresAt": expect.any(Number), "value": 333 },
        { "expiresAt": expect.any(Number), "value": 666 },
        { "expiresAt": expect.any(Number), "value": 444 },
        { "expiresAt": expect.any(Number), "value": 222 }
    ];

    const resultKeys = [...cache.cache.keys()];
    const resultValues = [...cache.cache.values()];

    expect(resultKeys).toStrictEqual(keys);
    expect(resultValues).toStrictEqual(values);
})


test("LRU should purge TTL expired element after ttlMs", async () => {

    const cache = new LRUCache<string, number>(5, 1); // super low ttl 1ms
    cache.set("1", 333);
    cache.set("2", 666);
    cache.set("3", 999);
    cache.set("4", 444);
    cache.set("5", 222);

    await new Promise((resolve) => setTimeout(resolve, 10)); // sleep for 10ms to allow purge to happen
    cache.get("1");

    const expected: number[] = [];
    expect([...cache.cache]).toStrictEqual(expected);
})

test("LRU should return the head when calling .head()", () => {
    const cache = new LRUCache<string, number>(5, 1000);
    cache.set("1", 333);
    cache.set("2", 666);
    cache.set("3", 999);
    cache.set("4", 444);
    cache.set("5", 222);
    cache.set("OVERCAPACITY", 111); // this element will remove the 'a' hence the 'b' in the head as expected

    const head = cache.head;
    expect(head).toStrictEqual(["2", { value: 666, expiresAt: expect.any(Number) }]);
})

test("LRU should return the head when calling .tail()", () => {
    const cache = new LRUCache<string, number>(5, 1000);
    cache.set("1", 333);
    cache.set("2", 666);
    cache.set("3", 999);
    cache.set("4", 444);
    cache.set("5", 222);
    cache.set("OVERCAPACITY", 111);

    const tail = cache.tail;
    expect(tail).toStrictEqual(["OVERCAPACITY", { value: 111, expiresAt: expect.any(Number) }]);
})

test("LRU should be empty after calling cache.clear()", () => {
    const cache = new LRUCache<string, number>(5, 1000);
    cache.set("1", 333);
    cache.set("2", 666);
    cache.set("3", 999);
    cache.set("4", 444);
    cache.set("5", 222);
    cache.set("OVERCAPACITY", 111);
    cache.clear();

    const expected: number[] = [];
    expect([...cache.cache]).toStrictEqual(expected);
})