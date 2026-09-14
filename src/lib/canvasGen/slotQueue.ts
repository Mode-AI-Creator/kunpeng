/** Atomic FIFO permits; reserve before yielding so simultaneous calls cannot overbook. */
export class GenerationSlots {
  private active = new Set<string>();
  private waiting: Array<{ id: string; resolve: () => void }> = [];
  private readonly limit: number;
  constructor(limit: number) {
    this.limit = limit;
    if (!Number.isInteger(limit) || limit < 1) throw new Error('Invalid generation concurrency');
  }
  acquire(id: string): Promise<void> {
    if (this.active.has(id) || this.waiting.some(item => item.id === id)) {
      return Promise.reject(new Error('Duplicate generation task'));
    }
    if (this.active.size < this.limit) {
      this.active.add(id);
      return Promise.resolve();
    }
    return new Promise(resolve => this.waiting.push({ id, resolve }));
  }
  release(id: string): void {
    if (!this.active.delete(id)) return;
    const next = this.waiting.shift();
    if (next) {
      this.active.add(next.id);
      next.resolve();
    }
  }
}
