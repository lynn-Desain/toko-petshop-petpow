import fs from 'fs';
import path from 'path';
import { createSeedDatabase } from '../src/lib/seedData';
import type { StoreDatabase } from '../src/lib/types';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'petshop-db.json');

let cachedDb: StoreDatabase | null = null;

export function loadDatabase(): StoreDatabase {
  if (cachedDb) return cachedDb;

  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as StoreDatabase;
      if (parsed && Array.isArray(parsed.products) && Array.isArray(parsed.orders)) {
        cachedDb = parsed;
        return cachedDb;
      }
    }
  } catch (err) {
    console.error('Failed to read persisted database, initializing seed data:', err);
  }

  cachedDb = createSeedDatabase();
  saveDatabase(cachedDb);
  return cachedDb;
}

export function saveDatabase(db: StoreDatabase): void {
  cachedDb = db;
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tmpFile = `${DB_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(db, null, 2), 'utf-8');
  fs.renameSync(tmpFile, DB_FILE);
}
