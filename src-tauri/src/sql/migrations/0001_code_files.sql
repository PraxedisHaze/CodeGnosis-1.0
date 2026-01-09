-- CodeGnosis Code Files Storage
-- Stores analyzed code chunks for AI context retrieval
-- v1.1 Foundation for future vector search integration

PRAGMA foreign_keys=ON;

-- Schema versioning
CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER NOT NULL PRIMARY KEY,
    applied_at TEXT NOT NULL
);

-- Projects table - one record per analyzed project
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    root_path TEXT NOT NULL,
    analyzed_at TEXT NOT NULL DEFAULT (datetime('now')),
    file_count INTEGER DEFAULT 0,
    total_chunks INTEGER DEFAULT 0,
    metadata_json TEXT DEFAULT '{}'
);

-- Code files/chunks table
CREATE TABLE IF NOT EXISTS code_files (
    id TEXT PRIMARY KEY NOT NULL,
    project_id TEXT NOT NULL,
    rel_path TEXT NOT NULL,
    chunk_index INTEGER DEFAULT 0,
    chunk_total INTEGER DEFAULT 1,
    chunk_context TEXT,
    category TEXT,
    content TEXT,
    content_hash TEXT,
    size_bytes INTEGER,
    line_count INTEGER,
    analyzed_at TEXT NOT NULL DEFAULT (datetime('now')),
    metadata_json TEXT DEFAULT '{}',
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Full-text search for code content
CREATE VIRTUAL TABLE IF NOT EXISTS code_files_fts USING fts5(
    rel_path,
    content,
    category,
    chunk_context,
    content='code_files',
    content_rowid=rowid
);

-- Triggers to keep FTS in sync
CREATE TRIGGER IF NOT EXISTS code_files_ai AFTER INSERT ON code_files BEGIN
    INSERT INTO code_files_fts(rowid, rel_path, content, category, chunk_context)
    VALUES (new.rowid, new.rel_path, new.content, new.category, new.chunk_context);
END;

CREATE TRIGGER IF NOT EXISTS code_files_ad AFTER DELETE ON code_files BEGIN
    DELETE FROM code_files_fts WHERE rowid = old.rowid;
END;

CREATE TRIGGER IF NOT EXISTS code_files_au AFTER UPDATE ON code_files BEGIN
    UPDATE code_files_fts
    SET rel_path = new.rel_path,
        content = new.content,
        category = new.category,
        chunk_context = new.chunk_context
    WHERE rowid = new.rowid;
END;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_code_files_project ON code_files(project_id);
CREATE INDEX IF NOT EXISTS idx_code_files_path ON code_files(rel_path);
CREATE INDEX IF NOT EXISTS idx_code_files_category ON code_files(category);
CREATE INDEX IF NOT EXISTS idx_code_files_hash ON code_files(content_hash);

-- Record this migration
INSERT OR IGNORE INTO schema_version (version, applied_at)
VALUES (1, datetime('now'));
