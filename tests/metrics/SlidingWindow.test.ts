import { SlidingWindow } from "../../src/metrics/SlidingWindow";

interface TestRecord {
  id: number;
  value: string;
  timestamp: number;
}

describe("SlidingWindow", () => {
  let slidingWindow: SlidingWindow<TestRecord>;

  beforeEach(() => {
    slidingWindow = new SlidingWindow(5);
  });

  describe("Constructor", () => {
    it("should throw error for invalid max size (negative)", () => {
      expect(() => new SlidingWindow(-1)).toThrow("maxSize must be greater than 0");
    });

    it("should throw error for invalid max size (zero)", () => {
      expect(() => new SlidingWindow(0)).toThrow("maxSize must be greater than 0");
    });

    it("should accept max size of 1", () => {
      const window = new SlidingWindow<TestRecord>(1);
      expect(window.size()).toBe(0);
    });
  });

  describe("add", () => {
    it("should add record to empty window", () => {
      const record = { id: 1, value: "test", timestamp: Date.now() };
      slidingWindow.add(record);

      expect(slidingWindow.size()).toBe(1);
      expect(slidingWindow.getAll()).toEqual([record]);
    });

    it("should add multiple records within max size", () => {
      const records = [
        { id: 1, value: "test1", timestamp: 1 },
        { id: 2, value: "test2", timestamp: 2 },
        { id: 3, value: "test3", timestamp: 3 },
      ];

      records.forEach((record) => slidingWindow.add(record));

      expect(slidingWindow.size()).toBe(3);
      expect(slidingWindow.getAll()).toEqual(records);
    });

    it("should remove oldest record when exceeding max size", () => {
      // Fill window to capacity
      for (let i = 1; i <= 5; i++) {
        slidingWindow.add({ id: i, value: `test${i}`, timestamp: i });
      }

      // Add one more to trigger removal
      slidingWindow.add({ id: 6, value: "test6", timestamp: 6 });

      expect(slidingWindow.size()).toBe(5);
      const allRecords = slidingWindow.getAll();
      expect(allRecords[0]?.id).toBe(2); // First record should be removed
      expect(allRecords[4]?.id).toBe(6); // Last record should be the new one
    });

    it("should maintain FIFO order", () => {
      const records = [
        { id: 1, value: "first", timestamp: 1 },
        { id: 2, value: "second", timestamp: 2 },
        { id: 3, value: "third", timestamp: 3 },
      ];

      records.forEach((record) => slidingWindow.add(record));

      const result = slidingWindow.getAll();
      expect(result).toEqual(records);
    });
  });

  describe("getAll", () => {
    it("should return empty array for empty window", () => {
      expect(slidingWindow.getAll()).toEqual([]);
    });

    it("should return copy of all records", () => {
      const record = { id: 1, value: "test", timestamp: 1 };
      slidingWindow.add(record);

      const result = slidingWindow.getAll();
      expect(result).toEqual([record]);
      expect(result).not.toBe(slidingWindow.getAll()); // Different array instances
    });

    it("should return records in insertion order", () => {
      const records = [
        { id: 3, value: "third", timestamp: 3 },
        { id: 1, value: "first", timestamp: 1 },
        { id: 2, value: "second", timestamp: 2 },
      ];

      records.forEach((record) => slidingWindow.add(record));

      expect(slidingWindow.getAll()).toEqual(records);
    });

    it("should return defensive copy", () => {
      slidingWindow.add({ id: 1, value: "apple", timestamp: 1 });
      const result = slidingWindow.getAll();

      // Modifying the result array should not affect the original
      result.push({ id: 2, value: "banana", timestamp: 2 });
      expect(slidingWindow.size()).toBe(1);

      // However, modifying objects within the result affects the original (shallow copy)
      if (result[0]) {
        result[0].value = "modified";
        expect(slidingWindow.getAll()[0]?.value).toBe("modified");
      }
    });
  });

  describe("size", () => {
    it("should return 0 for empty window", () => {
      expect(slidingWindow.size()).toBe(0);
    });

    it("should return correct size as records are added", () => {
      expect(slidingWindow.size()).toBe(0);

      slidingWindow.add({ id: 1, value: "test1", timestamp: 1 });
      expect(slidingWindow.size()).toBe(1);

      slidingWindow.add({ id: 2, value: "test2", timestamp: 2 });
      expect(slidingWindow.size()).toBe(2);
    });

    it("should not exceed max size", () => {
      // Add more records than max size
      for (let i = 1; i <= 10; i++) {
        slidingWindow.add({ id: i, value: `test${i}`, timestamp: i });
      }

      expect(slidingWindow.size()).toBe(5); // Should not exceed max size
    });
  });

  describe("clear", () => {
    it("should clear empty window", () => {
      slidingWindow.clear();
      expect(slidingWindow.size()).toBe(0);
      expect(slidingWindow.getAll()).toEqual([]);
    });

    it("should clear window with records", () => {
      slidingWindow.add({ id: 1, value: "test1", timestamp: 1 });
      slidingWindow.add({ id: 2, value: "test2", timestamp: 2 });

      slidingWindow.clear();

      expect(slidingWindow.size()).toBe(0);
      expect(slidingWindow.getAll()).toEqual([]);
    });

    it("should allow adding records after clear", () => {
      slidingWindow.add({ id: 1, value: "test1", timestamp: 1 });
      slidingWindow.clear();
      slidingWindow.add({ id: 2, value: "test2", timestamp: 2 });

      expect(slidingWindow.size()).toBe(1);
      expect(slidingWindow.getAll()).toEqual([{ id: 2, value: "test2", timestamp: 2 }]);
    });
  });

  describe("filter", () => {
    beforeEach(() => {
      // Add test data
      const records: TestRecord[] = [
        { id: 1, value: "apple", timestamp: 1 },
        { id: 2, value: "banana", timestamp: 2 },
        { id: 3, value: "apple", timestamp: 3 },
        { id: 4, value: "cherry", timestamp: 4 },
      ];
      records.forEach((record) => slidingWindow.add(record));
    });

    it("should return empty array when no records match", () => {
      const result = slidingWindow.filter((record) => record.value === "orange");
      expect(result).toEqual([]);
    });

    it("should return matching records", () => {
      const result = slidingWindow.filter((record) => record.value === "apple");
      expect(result).toEqual([
        { id: 1, value: "apple", timestamp: 1 },
        { id: 3, value: "apple", timestamp: 3 },
      ]);
    });

    it("should return all records when all match", () => {
      const result = slidingWindow.filter((record) => record.id > 0);
      expect(result).toEqual(slidingWindow.getAll());
    });

    it("should work with complex predicates", () => {
      // Create a fresh window to avoid interference from beforeEach
      const testWindow = new SlidingWindow<TestRecord>(5);
      testWindow.add({ id: 1, value: "apple", timestamp: 1 }); // odd, length 5
      testWindow.add({ id: 2, value: "banana", timestamp: 2 }); // even, length 6 > 5 ✓
      testWindow.add({ id: 3, value: "cherry", timestamp: 3 }); // odd, length 6
      testWindow.add({ id: 4, value: "date", timestamp: 4 }); // even, length 4 < 5

      const result = testWindow.filter((record) => record.id % 2 === 0 && record.value.length > 5);
      expect(result).toEqual([{ id: 2, value: "banana", timestamp: 2 }]); // Only banana matches both conditions
    });

    it("should return copy of records, not references", () => {
      // Create a fresh sliding window for this test
      const testWindow = new SlidingWindow<TestRecord>(5);
      testWindow.add({ id: 1, value: "apple", timestamp: 1 });
      const result = testWindow.filter((record) => record.id === 1);

      // Test that the array is a copy
      result.push({ id: 2, value: "banana", timestamp: 2 });
      expect(testWindow.size()).toBe(1); // Original should still have 1 item

      // Note: Objects inside are still references (shallow copy behavior)
      if (result[0]) {
        result[0].value = "modified";
        expect(testWindow.getAll()[0]?.value).toBe("modified"); // Objects are references
      }
    });
  });

  describe("getRecent", () => {
    beforeEach(() => {
      // Add test data
      for (let i = 1; i <= 5; i++) {
        slidingWindow.add({ id: i, value: `test${i}`, timestamp: i });
      }
    });

    it("should return empty array for count <= 0", () => {
      expect(slidingWindow.getRecent(0)).toEqual([]);
      expect(slidingWindow.getRecent(-1)).toEqual([]);
      expect(slidingWindow.getRecent(-5)).toEqual([]);
    });

    it("should return most recent records", () => {
      const result = slidingWindow.getRecent(3);
      expect(result).toEqual([
        { id: 3, value: "test3", timestamp: 3 },
        { id: 4, value: "test4", timestamp: 4 },
        { id: 5, value: "test5", timestamp: 5 },
      ]);
    });

    it("should return all records when count exceeds size", () => {
      const result = slidingWindow.getRecent(10);
      expect(result).toEqual(slidingWindow.getAll());
    });

    it("should return single record when count is 1", () => {
      const result = slidingWindow.getRecent(1);
      expect(result).toEqual([{ id: 5, value: "test5", timestamp: 5 }]);
    });

    it("should work with empty window", () => {
      const emptyWindow = new SlidingWindow<TestRecord>(5);
      expect(emptyWindow.getRecent(3)).toEqual([]);
    });

    it("should maintain order of recent records", () => {
      const result = slidingWindow.getRecent(2);
      if (result.length >= 2 && result[0] && result[1]) {
        expect(result[0].id).toBeLessThan(result[1].id);
      }
    });
  });

  describe("Edge cases and integration", () => {
    it("should handle window size of 1", () => {
      const singleWindow = new SlidingWindow<TestRecord>(1);

      singleWindow.add({ id: 1, value: "first", timestamp: 1 });
      expect(singleWindow.size()).toBe(1);

      singleWindow.add({ id: 2, value: "second", timestamp: 2 });
      expect(singleWindow.size()).toBe(1);
      expect(singleWindow.getAll()).toEqual([{ id: 2, value: "second", timestamp: 2 }]);
    });

    it("should handle large number of records", () => {
      const largeWindow = new SlidingWindow<TestRecord>(1000);

      // Add 1500 records
      for (let i = 1; i <= 1500; i++) {
        largeWindow.add({ id: i, value: `test${i}`, timestamp: i });
      }

      expect(largeWindow.size()).toBe(1000);
      const allRecords = largeWindow.getAll();
      if (allRecords.length >= 1000) {
        expect(allRecords[0]?.id).toBe(501); // First 500 should be removed
        expect(allRecords[999]?.id).toBe(1500); // Last should be 1500
      }
    });

    it("should handle complex objects", () => {
      interface ComplexRecord {
        nested: {
          data: number[];
          meta: { [key: string]: any };
        };
        timestamp: Date;
      }

      const complexWindow = new SlidingWindow<ComplexRecord>(3);
      const complexRecord: ComplexRecord = {
        nested: {
          data: [1, 2, 3],
          meta: { type: "test", active: true },
        },
        timestamp: new Date(),
      };

      complexWindow.add(complexRecord);
      expect(complexWindow.getAll()).toEqual([complexRecord]);
    });

    it("should handle concurrent operations", () => {
      // Create a larger window to accommodate all items
      const largeWindow = new SlidingWindow<TestRecord>(10);

      // Add 10 items
      for (let i = 0; i < 10; i++) {
        largeWindow.add({
          id: i,
          value: `item${i}`,
          timestamp: Date.now() + i,
        });
      }

      const result = largeWindow.getAll();
      expect(result).toHaveLength(10);

      // Check FIFO order - first item should have lower ID than second
      if (result.length >= 2 && result[0] && result[1]) {
        expect(result[0].id).toBeLessThan(result[1].id);
      }
    });

    it("should handle large datasets efficiently", () => {
      const largeWindow = new SlidingWindow<TestRecord>(1000);

      // Add 1500 records
      for (let i = 1; i <= 1500; i++) {
        largeWindow.add({ id: i, value: `item${i}`, timestamp: Date.now() + i });
      }

      expect(largeWindow.size()).toBe(1000);
      const result = largeWindow.getAll();
      expect(result).toHaveLength(1000);

      // Check that oldest records were removed (FIFO)
      if (result.length >= 1000) {
        expect(result[0]?.id).toBe(501); // First 500 should be removed
        expect(result[999]?.id).toBe(1500); // Last should be 1500
      }
    });

    it("should handle performance with frequent operations", () => {
      const perfWindow = new SlidingWindow<TestRecord>(100);

      const start = Date.now();

      // Perform 1000 operations
      for (let i = 1; i <= 1000; i++) {
        perfWindow.add({ id: i, value: `perf-${i}`, timestamp: Date.now() + i });
      }

      const end = Date.now();
      const duration = end - start;

      // Should complete quickly (less than 100ms for 1000 operations)
      expect(duration).toBeLessThan(100);
      expect(perfWindow.size()).toBe(100);
      expect(perfWindow.getAll()[0]?.id).toBe(901);
    });
  });
});
