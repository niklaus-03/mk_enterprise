/**
 * A simple asynchronous Mutex lock to serialize critical inventory operations.
 * Because Node.js is single-threaded, this perfectly prevents race conditions
 * (like lost updates) across multiple asynchronous API requests modifying stock
 * without requiring MongoDB Multi-Document Transactions.
 */
class Mutex {
  constructor() {
    this.queue = [];
    this.locked = false;
  }

  /**
   * Acquire the lock.
   * Returns a promise that resolves to a release function.
   * Usage:
   *   const release = await globalStockLock.acquire();
   *   try { ... } finally { release(); }
   */
  async acquire() {
    if (!this.locked) {
      this.locked = true;
      return () => { this.release(); };
    }
    return new Promise(resolve => {
      this.queue.push(resolve);
    });
  }

  release() {
    if (this.queue.length > 0) {
      const nextResolve = this.queue.shift();
      nextResolve(() => { this.release(); });
    } else {
      this.locked = false;
    }
  }
}

const globalStockLock = new Mutex();
module.exports = globalStockLock;
