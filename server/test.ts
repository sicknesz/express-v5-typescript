
import { describe, it } from "node:test";
import assert from "node:assert"

function transformUsers(users) {
  // Return only active users,
  // sorted by their score (highest first).
  // Add a "rank" property to each user.
const newUsers = users.filter(u => u.active).sort((a, b) => b.score - a.score).map((u, i) => ({ ...u, rank: i + 1 }));

  return newUsers
}

const users = [
  { name: "Avery", score: 92, active: true },
  { name: "Sam", score: 68, active: false },
  { name: "Jordan", score: 87, active: true },
]


        
describe("testing filtering function", () => {
    it('returns ranked active users', () => {
        assert.deepEqual(transformUsers(users), [
            { name: 'Avery', score: 92, active: true, rank: 1 },
            { name: 'Jordan', score: 87, active: true, rank: 2 },
        ])
    })
})