// Database schema definitions

export const SCHEMA = `
-- Games table
CREATE TABLE IF NOT EXISTS games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  cover_image_url TEXT,
  screenshots TEXT DEFAULT '[]', -- JSON array
  description TEXT,
  short_description TEXT,
  developer TEXT,
  publisher TEXT,
  release_date TEXT,
  genres TEXT DEFAULT '[]', -- JSON array
  tags TEXT DEFAULT '[]', -- JSON array
  metacritic_score INTEGER,
  metacritic_url TEXT,
  steam_rating REAL,
  steam_rating_count INTEGER,
  steam_app_id INTEGER UNIQUE,
  playtime_minutes INTEGER DEFAULT 0,
  steamgrid_id INTEGER,
  hero_url TEXT,
  logo_url TEXT,
  assets_checked_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Game platforms (tracks which services have this game)
CREATE TABLE IF NOT EXISTS game_platforms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id INTEGER NOT NULL,
  platform_type TEXT NOT NULL CHECK(platform_type IN ('steam', 'gamepass', 'eaplay', 'ubisoftplus')),
  platform_game_id TEXT NOT NULL,
  is_primary INTEGER DEFAULT 0,
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
  UNIQUE(game_id, platform_type)
);

-- Collections
CREATE TABLE IF NOT EXISTS collections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  is_smart_filter INTEGER DEFAULT 0,
  filter_criteria TEXT, -- JSON
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Collection games (many-to-many)
CREATE TABLE IF NOT EXISTS collection_games (
  collection_id INTEGER NOT NULL,
  game_id INTEGER NOT NULL,
  PRIMARY KEY (collection_id, game_id),
  FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
);

-- AI conversations
CREATE TABLE IF NOT EXISTS ai_conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- AI messages
CREATE TABLE IF NOT EXISTS ai_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (conversation_id) REFERENCES ai_conversations(id) ON DELETE CASCADE
);

-- User preferences
CREATE TABLE IF NOT EXISTS user_preferences (
  key TEXT PRIMARY KEY,
  value TEXT -- JSON
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_games_title ON games(title);
CREATE INDEX IF NOT EXISTS idx_games_steam_app_id ON games(steam_app_id);
CREATE INDEX IF NOT EXISTS idx_games_metacritic ON games(metacritic_score);
CREATE INDEX IF NOT EXISTS idx_games_release_date ON games(release_date);
CREATE INDEX IF NOT EXISTS idx_game_platforms_game_id ON game_platforms(game_id);
CREATE INDEX IF NOT EXISTS idx_game_platforms_type ON game_platforms(platform_type);
CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation ON ai_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_collection_games_collection ON collection_games(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_games_game ON collection_games(game_id);
CREATE INDEX IF NOT EXISTS idx_games_steamgrid_id ON games(steamgrid_id);
`;

// Migration for existing databases - add new columns if they don't exist
export const MIGRATIONS = `
-- Add steamgrid_id column if it doesn't exist
ALTER TABLE games ADD COLUMN steamgrid_id INTEGER;
-- Add hero_url column if it doesn't exist
ALTER TABLE games ADD COLUMN hero_url TEXT;
-- Add logo_url column if it doesn't exist
ALTER TABLE games ADD COLUMN logo_url TEXT;
-- Add assets_checked_at column if it doesn't exist
ALTER TABLE games ADD COLUMN assets_checked_at TEXT;
`;
