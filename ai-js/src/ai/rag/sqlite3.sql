CREATE TABLE IF NOT EXISTS documents
(
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  content    TEXT NOT NULL,
  metadata   TEXT,
  embedding  TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents (created_at);

SELECT COUNT(*) as count
FROM documents;

CREATE TABLE documents
(
  id         INTEGER PRIMARY KEY
    AUTOINCREMENT,
  content    TEXT NOT NULL,
  metadata   TEXT,
  embedding  TEXT NOT NULL,
  created_at DATETIME DEFAULT
                        CURRENT_TIMESTAMP
)
