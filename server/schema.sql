PRAGMA foreign_keys=ON;
PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
 password TEXT, name TEXT NOT NULL, surname TEXT NOT NULL, patronymic TEXT NOT NULL DEFAULT '',
 birth_date TEXT NOT NULL, phone TEXT NOT NULL UNIQUE, address TEXT NOT NULL DEFAULT '',
 category TEXT NOT NULL DEFAULT 'Adult' CHECK(category IN ('Adult','Student','Schoolboy','Pensioner')),
 role TEXT NOT NULL DEFAULT 'reader' CHECK(role IN ('reader','librarian','admin')),
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 csrf TEXT NOT NULL, expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS refs (
 id INTEGER PRIMARY KEY, kind TEXT NOT NULL, name TEXT NOT NULL COLLATE NOCASE,
 extra TEXT NOT NULL DEFAULT '{}', UNIQUE(kind,name)
);
CREATE TABLE IF NOT EXISTS books (
 id INTEGER PRIMARY KEY, title TEXT NOT NULL, annotation TEXT NOT NULL DEFAULT '',
 pages INTEGER NOT NULL CHECK(pages>0), age_limit INTEGER NOT NULL DEFAULT 0 CHECK(age_limit BETWEEN 0 AND 22),
 publisher_id INTEGER REFERENCES refs(id), isbn TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS book_refs (
 book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
 ref_id INTEGER NOT NULL REFERENCES refs(id), role TEXT NOT NULL DEFAULT '', PRIMARY KEY(book_id,ref_id,role)
);
CREATE TABLE IF NOT EXISTS copies (
 id INTEGER PRIMARY KEY, book_id INTEGER NOT NULL REFERENCES books(id), inventory TEXT NOT NULL UNIQUE,
 status TEXT NOT NULL DEFAULT 'Available' CHECK(status IN ('Available','Issued','Reserved','Debited')),
 location TEXT NOT NULL DEFAULT '', received_at TEXT NOT NULL, publication_year INTEGER NOT NULL,
 condition TEXT NOT NULL DEFAULT 'Normal' CHECK(condition IN ('Excellent','Normal','Bad')),
 notes TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS loans (
 id INTEGER PRIMARY KEY, copy_id INTEGER NOT NULL REFERENCES copies(id), reader_id INTEGER NOT NULL REFERENCES users(id),
 issued_at TEXT NOT NULL, due_at TEXT NOT NULL, returned_at TEXT, condition_on_return TEXT, notes TEXT NOT NULL DEFAULT '',
 renewals INTEGER NOT NULL DEFAULT 0, CHECK(due_at>=issued_at)
);
CREATE UNIQUE INDEX IF NOT EXISTS one_active_loan ON loans(copy_id) WHERE returned_at IS NULL;
CREATE INDEX IF NOT EXISTS loans_reader ON loans(reader_id,returned_at);
CREATE TABLE IF NOT EXISTS reservations (
 id INTEGER PRIMARY KEY, copy_id INTEGER NOT NULL REFERENCES copies(id), reader_id INTEGER NOT NULL REFERENCES users(id),
 created_at TEXT NOT NULL, expires_at TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','cancelled','expired','fulfilled'))
);
CREATE UNIQUE INDEX IF NOT EXISTS one_active_reservation ON reservations(copy_id) WHERE status='active';
CREATE TABLE IF NOT EXISTS documents (
 id INTEGER PRIMARY KEY, title TEXT NOT NULL, annotation TEXT NOT NULL DEFAULT '', age_limit INTEGER NOT NULL DEFAULT 0,
 language_id INTEGER REFERENCES refs(id)
);
CREATE TABLE IF NOT EXISTS document_books (
 document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
 book_id INTEGER NOT NULL REFERENCES books(id), PRIMARY KEY(document_id,book_id)
);
CREATE TABLE IF NOT EXISTS document_refs (
 document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
 ref_id INTEGER NOT NULL REFERENCES refs(id), role TEXT NOT NULL DEFAULT '', PRIMARY KEY(document_id,ref_id,role)
);
CREATE TABLE IF NOT EXISTS audit (
 id INTEGER PRIMARY KEY, actor_id INTEGER REFERENCES users(id), action TEXT NOT NULL, entity TEXT NOT NULL,
 entity_id INTEGER, detail TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS notifications (
 id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), message TEXT NOT NULL,
 read_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, dedupe TEXT UNIQUE
);
