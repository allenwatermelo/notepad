import type { BloomData } from './types'

const DB_NAME = 'little-bloom-local'
const STORE = 'workspace'
export const defaultData: BloomData = {
  notes: [], tasks: [], events: [], theme: 'rose',
  categories: [
    { id: 'personal', name: 'Personal', color: '#f6dfe7' },
    { id: 'work', name: 'Work', color: '#e9e3f5' },
    { id: 'ideas', name: 'Ideas', color: '#f8e9c9' },
    { id: 'learning', name: 'Learning', color: '#dfe9f5' },
    { id: 'projects', name: 'Projects', color: '#dfeBDD' },
    { id: 'important', name: 'Important', color: '#f5d5d1' },
  ],
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function loadData(): Promise<BloomData> {
  try {
    const db = await openDb()
    const value = await new Promise<BloomData | undefined>((resolve, reject) => {
      const request = db.transaction(STORE, 'readonly').objectStore(STORE).get('data')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    db.close()
    return value ? { ...defaultData, ...value } : defaultData
  } catch {
    const saved = localStorage.getItem('little-bloom-fallback')
    return saved ? { ...defaultData, ...JSON.parse(saved) as BloomData } : defaultData
  }
}

export async function saveData(data: BloomData): Promise<void> {
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const request = db.transaction(STORE, 'readwrite').objectStore(STORE).put(data, 'data')
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
    db.close()
  } catch {
    localStorage.setItem('little-bloom-fallback', JSON.stringify(data))
  }
}
