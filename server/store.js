import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { seedBooks } from './seed.js'

const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data')
const file = path.join(dataDir, 'store.json')

function load() {
  fs.mkdirSync(dataDir, { recursive: true })
  if (!fs.existsSync(file)) {
    const initial = { books: seedBooks(), orders: [], chats: [], reviews: [], customers: [], loginTokens: [], telegramOffset: 0 }
    fs.writeFileSync(file, JSON.stringify(initial, null, 2))
    return initial
  }
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
  parsed.books ??= []
  parsed.orders ??= []
  parsed.chats ??= []
  parsed.reviews ??= []
  parsed.customers ??= []
  parsed.loginTokens ??= []
  parsed.telegramOffset ??= 0
  return parsed
}

let state = load()
let chain = Promise.resolve()

export function getState() {
  return state
}

export function mutate(fn) {
  const result = fn(state)
  const snapshot = JSON.stringify(state, null, 2)
  chain = chain
    .then(() => fs.promises.writeFile(file, snapshot))
    .catch((error) => {
      console.error('store write failed', error)
    })
  return result
}
