/**
 * Database Utility - PEAK VERSION
 * Uses IndexedDB for high-speed, offline-first study data management.
 */

const DB_NAME = "StudyIQ";
const DB_VERSION = 4;

function promisifyRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Entries Store: Primary store for term-meaning pairs
      if (!db.objectStoreNames.contains("entries")) {
        const entriesStore = db.createObjectStore("entries", { keyPath: "id", autoIncrement: true });
        entriesStore.createIndex("category", "category", { unique: false });
        entriesStore.createIndex("sourceFile", "sourceFile", { unique: false });
        entriesStore.createIndex("wrongCount", "wrongCount", { unique: false });
      }

      // Files Store: Metadata for uploaded documents
      if (!db.objectStoreNames.contains("files")) {
        const filesStore = db.createObjectStore("files", { keyPath: "id", autoIncrement: true });
        filesStore.createIndex("category", "category", { unique: false });
      }

      // Categories Store: Simple names for categorization
      if (!db.objectStoreNames.contains("categories")) {
        db.createObjectStore("categories", { keyPath: "id", autoIncrement: true });
      }

      // Quiz History: Performance tracking
      if (!db.objectStoreNames.contains("quizHistory")) {
        const historyStore = db.createObjectStore("quizHistory", { keyPath: "id", autoIncrement: true });
        historyStore.createIndex("timestamp", "timestamp", { unique: false });
      }

      // AI Chat History: Persistent chat sessions
      if (!db.objectStoreNames.contains("chatHistory")) {
        const chatStore = db.createObjectStore("chatHistory", { keyPath: "id", autoIncrement: true });
        chatStore.createIndex("timestamp", "timestamp", { unique: false });
      }

      // Review Entries: low-confidence/noisy extraction output kept out of quiz pool.
      if (!db.objectStoreNames.contains("reviewEntries")) {
        const reviewStore = db.createObjectStore("reviewEntries", { keyPath: "id", autoIncrement: true });
        reviewStore.createIndex("category", "category", { unique: false });
        reviewStore.createIndex("sourceFile", "sourceFile", { unique: false });
        reviewStore.createIndex("reviewed", "reviewed", { unique: false });
      }
    };
  });
}

// RESTORED: Sequence Pointer Logic
export async function saveFilePointer(fileId, pointer) {
  const db = await initDB();
  const tx = db.transaction("files", "readwrite");
  const store = tx.objectStore("files");
  const file = await promisifyRequest(store.get(fileId));
  if (file) {
    file.sequencePointer = pointer;
    await promisifyRequest(store.put(file));
  }
}

// RESTORED: Multi-provider data fetching
export async function getAllCategories() {
  const db = await initDB();
  return promisifyRequest(db.transaction("categories", "readonly").objectStore("categories").getAll());
}

export async function addCategory(category) {
  const db = await initDB();
  return promisifyRequest(db.transaction("categories", "readwrite").objectStore("categories").add(category));
}

export async function getFilesByCategory(category) {
  const db = await initDB();
  const index = db.transaction("files", "readonly").objectStore("files").index("category");
  return promisifyRequest(index.getAll(category));
}

export async function addFile(file) {
  const db = await initDB();
  return promisifyRequest(db.transaction("files", "readwrite").objectStore("files").add(file));
}

export async function getFileById(id) {
  const db = await initDB();
  return promisifyRequest(db.transaction("files", "readonly").objectStore("files").get(id));
}

export async function addEntry(entry) {
  const db = await initDB();
  return promisifyRequest(db.transaction("entries", "readwrite").objectStore("entries").add(entry));
}

export async function addReviewEntry(entry) {
  const db = await initDB();
  return promisifyRequest(db.transaction("reviewEntries", "readwrite").objectStore("reviewEntries").add(entry));
}

export async function updateEntry(entry) {
  const db = await initDB();
  return promisifyRequest(db.transaction("entries", "readwrite").objectStore("entries").put(entry));
}

export async function getEntriesByFile(fileId) {
  const db = await initDB();
  const index = db.transaction("entries", "readonly").objectStore("entries").index("sourceFile");
  return promisifyRequest(index.getAll(fileId));
}

export async function getAllEntries() {
  const db = await initDB();
  return promisifyRequest(db.transaction("entries", "readonly").objectStore("entries").getAll());
}

export async function getReviewEntriesByFile(fileId) {
  const db = await initDB();
  const index = db.transaction("reviewEntries", "readonly").objectStore("reviewEntries").index("sourceFile");
  return promisifyRequest(index.getAll(fileId));
}

export async function getAllReviewEntries() {
  const db = await initDB();
  if (!db.objectStoreNames.contains("reviewEntries")) return [];
  return promisifyRequest(db.transaction("reviewEntries", "readonly").objectStore("reviewEntries").getAll());
}

export async function getAllFiles() {
  const db = await initDB();
  return promisifyRequest(db.transaction("files", "readonly").objectStore("files").getAll());
}

export async function addQuizHistory(history) {
  const db = await initDB();
  return promisifyRequest(db.transaction("quizHistory", "readwrite").objectStore("quizHistory").add(history));
}

export async function getAllQuizHistory() {
  const db = await initDB();
  return promisifyRequest(db.transaction("quizHistory", "readonly").objectStore("quizHistory").getAll());
}

export async function deleteFileAndContent(fileId) {
  const db = await initDB();
  const stores = db.objectStoreNames.contains("reviewEntries")
    ? ["files", "entries", "reviewEntries"]
    : ["files", "entries"];
  const tx = db.transaction(stores, "readwrite");
  const entriesStore = tx.objectStore("entries");
  const entriesIndex = entriesStore.index("sourceFile");
  const entriesRequest = entriesIndex.openKeyCursor(IDBKeyRange.only(fileId));

  entriesRequest.onsuccess = () => {
    const cursor = entriesRequest.result;
    if (cursor) {
      entriesStore.delete(cursor.primaryKey);
      cursor.continue();
    }
  };

  if (db.objectStoreNames.contains("reviewEntries")) {
    const reviewStore = tx.objectStore("reviewEntries");
    const reviewIndex = reviewStore.index("sourceFile");
    const reviewRequest = reviewIndex.openKeyCursor(IDBKeyRange.only(fileId));
    reviewRequest.onsuccess = () => {
      const cursor = reviewRequest.result;
      if (cursor) {
        reviewStore.delete(cursor.primaryKey);
        cursor.continue();
      }
    };
  }

  return promisifyRequest(tx.objectStore("files").delete(fileId));
}

export async function deleteCategory(categoryId) {
  const db = await initDB();
  return promisifyRequest(db.transaction("categories", "readwrite").objectStore("categories").delete(categoryId));
}

export async function clearAllData() {
  const db = await initDB();
  const stores = ["entries", "reviewEntries", "files", "categories", "quizHistory"];
  for (const storeName of stores) {
    if (db.objectStoreNames.contains(storeName)) {
      const tx = db.transaction(storeName, "readwrite");
      tx.objectStore(storeName).clear();
    }
  }
}

// AI Chat History functions for persistent chat sessions
export async function saveChatHistory(messages) {
  const db = await initDB();
  return promisifyRequest(db.transaction("chatHistory", "readwrite").objectStore("chatHistory").add({
    timestamp: Date.now(),
    messages,
  }));
}

export async function getAllChatHistory() {
  const db = await initDB();
  return promisifyRequest(db.transaction("chatHistory", "readonly").objectStore("chatHistory").getAll());
}

export async function getLatestChatHistory() {
  const db = await initDB();
  const all = await promisifyRequest(db.transaction("chatHistory", "readonly").objectStore("chatHistory").getAll());
  if (!all || all.length === 0) return null;
  // Sort by timestamp descending and return most recent
  return all.sort((a, b) => b.timestamp - a.timestamp)[0];
}

export async function clearChatHistory() {
  const db = await initDB();
  if (db.objectStoreNames.contains("chatHistory")) {
    const tx = db.transaction("chatHistory", "readwrite");
    tx.objectStore("chatHistory").clear();
    return promisifyRequest(tx);
  }
}
