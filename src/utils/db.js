const DB_NAME = "StudyIQ";
const DB_VERSION = 2;

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

      if (!db.objectStoreNames.contains("entries")) {
        const entriesStore = db.createObjectStore("entries", {
          keyPath: "id",
          autoIncrement: true,
        });
        entriesStore.createIndex("category", "category", { unique: false });
        entriesStore.createIndex("sourceFile", "sourceFile", { unique: false });
        entriesStore.createIndex("wrongCount", "wrongCount", { unique: false });
      }

      if (!db.objectStoreNames.contains("files")) {
        const filesStore = db.createObjectStore("files", {
          keyPath: "id",
          autoIncrement: true,
        });
        filesStore.createIndex("category", "category", { unique: false });
      }

      if (!db.objectStoreNames.contains("categories")) {
        db.createObjectStore("categories", {
          keyPath: "id",
          autoIncrement: true,
        });
      }

      if (!db.objectStoreNames.contains("quizHistory")) {
        const historyStore = db.createObjectStore("quizHistory", {
          keyPath: "id",
          autoIncrement: true,
        });
        historyStore.createIndex("timestamp", "timestamp", { unique: false });
      }
    };
  });
}

async function withStore(storeName, mode, operation) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const result = operation(store);

    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function addCategory(category) {
  const db = await initDB();
  const tx = db.transaction("categories", "readwrite");
  const request = tx.objectStore("categories").add(category);
  return promisifyRequest(request);
}

export async function getAllCategories() {
  const db = await initDB();
  const request = db.transaction("categories", "readonly").objectStore("categories").getAll();
  return promisifyRequest(request);
}

export async function addFile(file) {
  const db = await initDB();
  const request = db.transaction("files", "readwrite").objectStore("files").add(file);
  return promisifyRequest(request);
}

export async function updateFile(file) {
  const db = await initDB();
  const request = db.transaction("files", "readwrite").objectStore("files").put(file);
  return promisifyRequest(request);
}

export async function getAllFiles() {
  const db = await initDB();
  const request = db.transaction("files", "readonly").objectStore("files").getAll();
  return promisifyRequest(request);
}

export async function getFileById(id) {
  const db = await initDB();
  const request = db.transaction("files", "readonly").objectStore("files").get(id);
  return promisifyRequest(request);
}

export async function getFilesByCategory(category) {
  const db = await initDB();
  const index = db.transaction("files", "readonly").objectStore("files").index("category");
  const request = index.getAll(category);
  return promisifyRequest(request);
}

export async function addEntry(entry) {
  const db = await initDB();
  const request = db.transaction("entries", "readwrite").objectStore("entries").add(entry);
  return promisifyRequest(request);
}

export async function updateEntry(entry) {
  const db = await initDB();
  const request = db.transaction("entries", "readwrite").objectStore("entries").put(entry);
  return promisifyRequest(request);
}

export async function getAllEntries() {
  const db = await initDB();
  const request = db.transaction("entries", "readonly").objectStore("entries").getAll();
  return promisifyRequest(request);
}

export async function getEntriesByFile(fileId) {
  const db = await initDB();
  const index = db.transaction("entries", "readonly").objectStore("entries").index("sourceFile");
  const request = index.getAll(fileId);
  return promisifyRequest(request);
}

export async function getEntriesByCategory(category) {
  const db = await initDB();
  const index = db.transaction("entries", "readonly").objectStore("entries").index("category");
  const request = index.getAll(category);
  return promisifyRequest(request);
}

export async function addQuizHistory(history) {
  const db = await initDB();
  const request = db.transaction("quizHistory", "readwrite").objectStore("quizHistory").add(history);
  return promisifyRequest(request);
}

export async function getAllQuizHistory() {
  const db = await initDB();
  const request = db.transaction("quizHistory", "readonly").objectStore("quizHistory").getAll();
  return promisifyRequest(request);
}

export async function clearAllData() {
  const db = await initDB();
  const stores = ["entries", "files", "categories", "quizHistory"];

  for (const name of stores) {
    await withStore(name, "readwrite", (store) => {
      store.clear();
      return null;
    });
  }
}

export async function saveFilePointer(fileId, pointer) {
  const file = await getFileById(fileId);
  if (!file) return;
  await updateFile({ ...file, sequencePointer: pointer });
}
