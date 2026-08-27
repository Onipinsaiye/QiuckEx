import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getOfflineQueue,
  saveOfflineQueue,
  enqueueAction,
  dequeueAction,
  clearOfflineQueue,
  updateQueueItem,
  retryQueuedAction,
  processOfflineQueue,
  registerActionHandler,
} from "../services/offline-queue";

jest.mock("@react-native-async-storage/async-storage", () => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn(async (key) => store[key] ?? null),
    setItem: jest.fn(async (key, value) => {
      store[key] = value;
    }),
    removeItem: jest.fn(async (key) => {
      delete store[key];
    }),
    clear: jest.fn(async () => {
      store = {};
    }),
  };
});

describe("Offline Action Queue Service", () => {
  const SUCCESS_ACTION = "test.success";
  const FAILURE_ACTION = "test.failure";

  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    registerActionHandler(SUCCESS_ACTION, async () => undefined);
    registerActionHandler(FAILURE_ACTION, async () => {
      throw new Error("Test handler failure");
    });
  });

  it("should start with an empty queue", async () => {
    const queue = await getOfflineQueue();
    expect(queue).toEqual([]);
  });

  it("should enqueue a new action and mark it as pending", async () => {
    const action = await enqueueAction(SUCCESS_ACTION, { key: "value" });
    expect(action.id).toBeDefined();
    expect(action.type).toBe(SUCCESS_ACTION);
    expect(action.payload).toEqual({ key: "value" });
    expect(action.status).toBe("pending");
    expect(action.attempts).toBe(0);
    expect(action.failureReason).toBeNull();
    expect(action.timestamp).toBeLessThanOrEqual(Date.now());

    const queue = await getOfflineQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0]).toEqual(action);
  });

  it("should dequeue an action by ID", async () => {
    const action1 = await enqueueAction(SUCCESS_ACTION, { id: 1 });
    const action2 = await enqueueAction(FAILURE_ACTION, { id: 2 });

    let queue = await getOfflineQueue();
    expect(queue).toHaveLength(2);

    await dequeueAction(action1.id);
    queue = await getOfflineQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].id).toBe(action2.id);
  });

  it("should clear the entire queue", async () => {
    await enqueueAction(SUCCESS_ACTION, { id: 1 });
    await enqueueAction(FAILURE_ACTION, { id: 2 });

    let queue = await getOfflineQueue();
    expect(queue).toHaveLength(2);

    await clearOfflineQueue();
    queue = await getOfflineQueue();
    expect(queue).toHaveLength(0);
  });

  it("should update metadata fields on a queue item", async () => {
    const action = await enqueueAction(SUCCESS_ACTION, { foo: "bar" });
    const updated = await updateQueueItem(action.id, {
      status: "failed",
      attempts: 3,
      failureReason: "Timed out",
    });

    expect(updated).not.toBeNull();
    expect(updated?.status).toBe("failed");
    expect(updated?.attempts).toBe(3);
    expect(updated?.failureReason).toBe("Timed out");

    const queue = await getOfflineQueue();
    expect(queue[0].status).toBe("failed");
  });

  it("should process a registered action successfully", async () => {
    const action = await enqueueAction(SUCCESS_ACTION, { foo: "bar" });
    const result = await retryQueuedAction(action.id);

    expect(result?.status).toBe("completed");
    expect(result?.attempts).toBe(1);
    expect(result?.failureReason).toBeNull();
  });

  it("should record failure reasons when a registered action fails", async () => {
    const action = await enqueueAction(FAILURE_ACTION, { foo: "bar" });
    const result = await retryQueuedAction(action.id);

    expect(result?.status).toBe("failed");
    expect(result?.attempts).toBe(1);
    expect(result?.failureReason).toBe("Test handler failure");
  });

  it("should process all pending and failed actions sequentially", async () => {
    const act1 = await enqueueAction(SUCCESS_ACTION, { number: 1 });
    const act2 = await enqueueAction(FAILURE_ACTION, { number: 2 });
    const act3 = await enqueueAction(SUCCESS_ACTION, { number: 3 });

    // Mark act3 as completed manually first so it's skipped
    await updateQueueItem(act3.id, { status: "completed" });

    await processOfflineQueue();

    const queue = await getOfflineQueue();
    const statusMap = new Map(queue.map((item) => [item.id, item]));

    expect(statusMap.get(act1.id)?.status).toBe("completed");
    expect(statusMap.get(act2.id)?.status).toBe("failed");
    expect(statusMap.get(act3.id)?.status).toBe("completed"); // Unaffected by retry run because it was completed
    expect(statusMap.get(act1.id)?.attempts).toBe(1);
    expect(statusMap.get(act2.id)?.attempts).toBe(1);
    expect(statusMap.get(act3.id)?.attempts).toBe(0);
  });
});
