import { v4 as uuidv4 } from 'uuid';

interface CsvEntry {
  id: string;
  content: string;
  filename: string;
  createdAt: number;
}

export class CsvStore {
  private entries = new Map<string, CsvEntry>();
  private ttlMs: number;
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor(ttlMinutes = 30) {
    this.ttlMs = ttlMinutes * 60 * 1000;
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /** Store CSV content and return its unique ID */
  save(content: string, filename: string): string {
    const id = uuidv4();
    this.entries.set(id, { id, content, filename, createdAt: Date.now() });
    return id;
  }

  /** Retrieve a CSV entry by ID, or null if expired/not found */
  get(id: string): CsvEntry | null {
    const entry = this.entries.get(id);
    if (!entry) return null;
    if (Date.now() - entry.createdAt > this.ttlMs) {
      this.entries.delete(id);
      return null;
    }
    return entry;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [id, entry] of this.entries) {
      if (now - entry.createdAt > this.ttlMs) {
        this.entries.delete(id);
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.entries.clear();
  }
}
