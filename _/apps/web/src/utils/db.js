// IndexedDB setup for StudyIQ
const DB_NAME = "StudyIQ";
const DB_VERSION = 1;

export const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Entries store
      if (!db.objectStoreNames.contains("entries")) {
        const entriesStore = db.createObjectStore("entries", {
          keyPath: "id",
          autoIncrement: true,
        });
        entriesStore.createIndex("category", "category", { unique: false });
        entriesStore.createIndex("sourceFile", "sourceFile", { unique: false });
        entriesStore.createIndex("wrongCount", "wrongCount", { unique: false });
      }

      // Files store
      if (!db.objectStoreNames.contains("files")) {
        const filesStore = db.createObjectStore("files", {
          keyPath: "id",
          autoIncrement: true,
        });
        filesStore.createIndex("category", "category", { unique: false });
      }

      // Categories store
      if (!db.objectStoreNames.contains("categories")) {
        db.createObjectStore("categories", {
          keyPath: "id",
          autoIncrement: true,
        });
      }

      // Quiz history
      if (!db.objectStoreNames.contains("quizHistory")) {
        const historyStore = db.createObjectStore("quizHistory", {
          keyPath: "id",
          autoIncrement: true,
        });
        historyStore.createIndex("timestamp", "timestamp", { unique: false });
      }
    };
  });
};

// Generic DB operations
export const dbOperation = async (storeName, mode, operation) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const request = operation(store);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// Add entry
export const addEntry = (entry) => {
  return dbOperation("entries", "readwrite", (store) => store.add(entry));
};

// Get all entries
export const getAllEntries = () => {
  return dbOperation("entries", "readonly", (store) => store.getAll());
};

// Get entries by category
export const getEntriesByCategory = async (category) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("entries", "readonly");
    const store = transaction.objectStore("entries");
    const index = store.index("category");
    const request = index.getAll(category);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// Get entries by file
export const getEntriesByFile = async (fileId) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("entries", "readonly");
    const store = transaction.objectStore("entries");
    const index = store.index("sourceFile");
    const request = index.getAll(fileId);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// Update entry
export const updateEntry = (entry) => {
  return dbOperation("entries", "readwrite", (store) => store.put(entry));
};

// Categories
export const addCategory = (category) => {
  return dbOperation("categories", "readwrite", (store) => store.add(category));
};

export const getAllCategories = () => {
  return dbOperation("categories", "readonly", (store) => store.getAll());
};

// Files
export const addFile = (file) => {
  return dbOperation("files", "readwrite", (store) => store.add(file));
};

export const getAllFiles = () => {
  return dbOperation("files", "readonly", (store) => store.getAll());
};

export const getFilesByCategory = async (category) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("files", "readonly");
    const store = transaction.objectStore("files");
    const index = store.index("category");
    const request = index.getAll(category);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// Quiz history
export const addQuizHistory = (history) => {
  return dbOperation("quizHistory", "readwrite", (store) => store.add(history));
};

export const getAllQuizHistory = () => {
  return dbOperation("quizHistory", "readonly", (store) => store.getAll());
};

// Clear all data
export const clearAllData = async () => {
  const db = await initDB();
  const stores = ["entries", "files", "categories", "quizHistory"];

  for (const storeName of stores) {
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, "readwrite");
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
};
