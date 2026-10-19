
import LRUCache from "./cache.ts"
import { expect, test } from "bun:test";

test("LRU should remove the least recently used entry when calling set on a full cache", () => {

    const cache = new LRUCache<string, number>(5, 10000);
    cache.set("a", 333); // 0
    cache.set("b", 666); // 1
    cache.set("c", 999); // 2
    cache.set("d", 444); // 3
    cache.set("e", 222); // 4

    cache.set("f", 111); // 5 -- should remove the "a"


    const expected = [
        ["b", {
            expiresAt: expect.any(Number),
            value: 666,
        }], ["c", {
            expiresAt: expect.any(Number),
            value: 999,
        }], ["d", {
            expiresAt: expect.any(Number),
            value: 444,
        }], ["e", {
            expiresAt: expect.any(Number),
            value: 222,
        }], ["f", {
            expiresAt: expect.any(Number),
            value: 111,
        }]
    ];

    const result = [...cache.cache];

    expect(result).toStrictEqual(expected)
})


test("LRU should mark as lru the latest accessed element", () => {

    const cache = new LRUCache<string, number>(5, 10000);
    cache.set("a", 333);
    cache.set("b", 666);
    cache.set("c", 999);
    cache.set("d", 444);
    cache.set("e", 222);
    cache.get("b");
    cache.set("f", 111);

    const keys = ["c", "d", "e", "b", "f"];
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


test("LRU should purge TTL expired element after ttlMs", async () => {

    const cache = new LRUCache<string, number>(5, 1);
    cache.set("a", 333);
    cache.set("b", 666);
    cache.set("c", 999);
    cache.set("d", 444);
    cache.set("e", 222);

    await new Promise((resolve) => setTimeout(resolve, 1000));
    cache.get("a");

    const expected: number[] = [];
    expect([...cache.cache]).toStrictEqual(expected);
})

test("LRU should return the head when calling .head()", () => {
    const cache = new LRUCache<string, number>(5, 1000);
    cache.set("a", 333);
    cache.set("b", 666);
    cache.set("c", 999);
    cache.set("d", 444);
    cache.set("e", 222);
    cache.set("f", 111);

    const head = cache.head;
    expect(head).toStrictEqual(["b", { value: 666, expiresAt: expect.any(Number) }]);
})

test("LRU should return the head when calling .tail()", () => {
    const cache = new LRUCache<string, number>(5, 1000);
    cache.set("a", 333);
    cache.set("b", 666);
    cache.set("c", 999);
    cache.set("d", 444);
    cache.set("e", 222);
    cache.set("f", 111);

    const tail = cache.tail;
    expect(tail).toStrictEqual(["f", { value: 111, expiresAt: expect.any(Number) }]);
})

test("LRU should be empty after calling cache.clear()", () => {
    const cache = new LRUCache<string, number>(5, 1000);
    cache.set("a", 333);
    cache.set("b", 666);
    cache.set("c", 999);
    cache.set("d", 444);
    cache.set("e", 222);
    cache.set("f", 111);
    cache.clear();

    const expected: number[] = [];
    expect([...cache.cache]).toStrictEqual(expected);
})