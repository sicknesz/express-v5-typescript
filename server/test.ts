import { describe, it } from "node:test";

function transformUsers(users: any) {
  const newUsers = [...users].filter((u: any) => u.active).sort((a: any, b: any) => b.score - a.score).map((u: any, i: number) => ({ ...u, rank: i + 1 }));
  return newUsers
}

const users = [
  { name: "Avery", score: 92, active: true },
  { name: "Sam", score: 68, active: false },
  { name: "Jordan", score: 87, active: true },
]

describe("testing filtering function", () => {
  it('returns ranked active users', (t) => {
    t.assert.deepEqual(transformUsers(users), [
      { name: 'Avery', score: 92, active: true, rank: 1 },
      { name: 'Jordan', score: 87, active: true, rank: 2 },
    ])
  })
})

describe("a failing test", () => {
  it('should fail to return ranked active users', (t) => {
    t.assert.deepEqual(transformUsers(users), [
      { name: 'Avery', score: 99, active: true, rank: 2 },
      { name: 'Jordan', score: 87, active: true, rank: 3 },
    ])
  })
})

