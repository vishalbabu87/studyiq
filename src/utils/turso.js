const ENV_TURSO_URL =
  import.meta.env?.VITE_TURSO_DB_URL ||
  import.meta.env?.TURSO_DB_URL ||
  process.env.TURSO_DB_URL ||
  "";

const ENV_TURSO_TOKEN =
  import.meta.env?.VITE_TURSO_AUTH_TOKEN ||
  import.meta.env?.TURSO_AUTH_TOKEN ||
  process.env.TURSO_AUTH_TOKEN ||
  "";

function hasTursoConfig() {
  return Boolean(ENV_TURSO_URL && ENV_TURSO_TOKEN);
}

async function execStatements(statements) {
  const res = await fetch(`${ENV_TURSO_URL}/v2/pExecute`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ENV_TURSO_TOKEN}`,
    },
    body: JSON.stringify({ statements }),
  });
  return res.ok;
}

export async function initTursoTables() {
  if (!hasTursoConfig()) return false;

  try {
    return await execStatements([
      {
        sql: `CREATE TABLE IF NOT EXISTS vocabulary (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          term TEXT,
          meaning TEXT,
          category TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
      },
    ]);
  } catch {
    return false;
  }
}

export async function backupVocabulary(items) {
  if (!hasTursoConfig()) return false;
  if (!Array.isArray(items) || items.length === 0) return true;

  try {
    const chunkSize = 100;
    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);
      const statements = chunk.map((item) => ({
        sql: "INSERT INTO vocabulary (term, meaning, category) VALUES (?, ?, ?)",
        args: [item.term || "", item.meaning || "", item.category || "general"],
      }));
      const ok = await execStatements(statements);
      if (!ok) return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function backupQuizHistory(history) {
  if (!hasTursoConfig()) return false;
  if (!history || typeof history !== "object") return false;

  try {
    const ok = await execStatements([
      {
        sql: `CREATE TABLE IF NOT EXISTS quiz_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          topic TEXT,
          difficulty TEXT,
          score INTEGER,
          total INTEGER,
          time_taken INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
      },
      {
        sql: "INSERT INTO quiz_history (topic, difficulty, score, total, time_taken) VALUES (?, ?, ?, ?, ?)",
        args: [
          history.topic || "Quiz",
          history.difficulty || "medium",
          Number.isFinite(history.score) ? history.score : 0,
          Number.isFinite(history.total) ? history.total : 0,
          Number.isFinite(history.timeTaken) ? history.timeTaken : 0,
        ],
      },
    ]);
    return ok;
  } catch {
    return false;
  }
}
