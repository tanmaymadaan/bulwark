/**
 * Efficient sliding window implementation for tracking call records
 * Provides O(1) insertion and automatic cleanup of old records
 */
export class SlidingWindow<T> {
  private records: T[] = [];
  private readonly maxSize: number;

  /**
   * Creates a new sliding window
   * @param {number} maxSize - Maximum number of records to keep
   */
  constructor(maxSize: number) {
    if (maxSize <= 0) {
      throw new Error("maxSize must be greater than 0");
    }
    this.maxSize = maxSize;
  }

  /**
   * Adds a new record to the window
   * @param {T} record - Record to add
   * @returns {void}
   */
  public add(record: T): void {
    this.records.push(record);

    // Remove oldest records if we exceed max size
    if (this.records.length > this.maxSize) {
      this.records.shift();
    }
  }

  /**
   * Gets all records in the window
   * @returns {T[]} Array of all records
   */
  public getAll(): T[] {
    return [...this.records];
  }

  /**
   * Gets the number of records in the window
   * @returns {number} Number of records
   */
  public size(): number {
    return this.records.length;
  }

  /**
   * Gets the maximum size of the window
   * @returns {number} Maximum number of records the window can hold
   */
  public getMaxSize(): number {
    return this.maxSize;
  }

  /**
   * Clears all records from the window
   * @returns {void}
   */
  public clear(): void {
    this.records = [];
  }

  /**
   * Gets records that match a predicate
   * @param {function} predicate - Function to test each record
   * @returns {T[]} Array of matching records
   */
  public filter(predicate: (record: T) => boolean): T[] {
    return this.records.filter(predicate);
  }

  /**
   * Gets the most recent N records
   * @param {number} count - Number of recent records to get
   * @returns {T[]} Array of most recent records
   */
  public getRecent(count: number): T[] {
    if (count <= 0) return [];
    return this.records.slice(-count);
  }
}
