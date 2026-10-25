import { describe, it } from "node:test";

type User = { name: string, score: number, active: boolean, rank?: number };

function transformUsers(users: User[]) {
  const newUsers = [...users]
    .filter((u: any) => u.active)
    .sort((a: any, b: any) => b.score - a.score)
    .map((u: any, i: number) => ({ ...u, rank: i + 1 }));

  return newUsers
}

describe("testing filtering function", () => {
  it('returns 3 ranked active users', (t) => {
    const users: User[] = [
      { name: "Avery", score: 92, active: true },
      { name: "Sam", score: 68, active: true },
      { name: "Jordan", score: 87, active: true },
    ]
    t.assert.deepEqual(transformUsers(users), [
      { name: 'Avery', score: 92, active: true, rank: 1 },
      { name: 'Jordan', score: 87, active: true, rank: 2 },
      { name: "Sam", score: 68, active: true, rank: 3 },
    ])
  })
  it('returns 2 ranked active users', (t) => {
    const users: User[] = [
      { name: "Avery", score: 92, active: true },
      { name: "Sam", score: 68, active: false },
      { name: "Jordan", score: 87, active: true },
    ]
    t.assert.deepEqual(transformUsers(users), [
      { name: 'Avery', score: 92, active: true, rank: 1 },
      { name: 'Jordan', score: 87, active: true, rank: 2 },
    ])
  })
  it.expectFailure('should fail to return ranked active users', (t) => {
    const users: User[] = [
      { name: "Avery", score: 92, active: true },
      { name: "Sam", score: 68, active: false },
      { name: "Jordan", score: 87, active: true },
    ]
    t.assert.deepEqual(transformUsers(users), [
      { name: 'Avery', score: 99, active: true, rank: 2 },
      { name: 'Jordan', score: 87, active: true, rank: 3 },
    ])
  })
})

