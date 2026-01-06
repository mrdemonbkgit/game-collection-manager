# Subscription Catalog Import - Research

Research conducted: January 2026

This document outlines available options for importing game catalogs from subscription services (Xbox Game Pass, EA Play, Ubisoft+) into the Game Collection Manager.

---

## Overview

| Service | Best Option | Data Quality | Effort |
|---------|-------------|--------------|--------|
| Xbox Game Pass | NikkelM/Game-Pass-API | Excellent | Low |
| EA Play | IsThereAnyDeal or PCGamingWiki | Good | Medium |
| Ubisoft+ | IsThereAnyDeal | Good | Medium |

---

## Xbox Game Pass

### Option 1: NikkelM/Game-Pass-API (Recommended)

**Repository**: https://github.com/NikkelM/Game-Pass-API

A Node.js tool that fetches all Game Pass games from Microsoft's public catalog API.

**Platforms supported:**
- `pc` - PC Game Pass
- `console` - Xbox Console Game Pass
- `eaPlay` - EA Play (included with Game Pass)

**Output format:** Configurable JSON

**Available properties:**
| Property | Description |
|----------|-------------|
| title | Game title |
| productId | Microsoft Store product ID |
| developer | Developer name |
| publisher | Publisher name |
| categories | Game categories |
| description | Full or short description |
| images | BoxArt, Hero, Screenshots, Logo, Poster, etc. |
| prices | Store prices (optional) |

**Usage:**
```bash
git clone https://github.com/NikkelM/Game-Pass-API
cd Game-Pass-API
npm install
# Create config.json from config.default.json
npm start
# Output appears in /output folder
```

**Example config.json:**
```json
{
  "markets": ["US"],
  "language": "en-US",
  "platforms": ["pc"],
  "outputFormat": "array",
  "properties": {
    "title": true,
    "productId": true,
    "developer": true,
    "publisher": true,
    "description": true,
    "images": ["BoxArt", "Hero"]
  }
}
```

**Pros:**
- Active maintenance
- Uses official Microsoft endpoints
- Highly configurable output
- Includes EA Play games

**Cons:**
- Requires running locally (not a hosted API)
- No automatic updates (must re-run manually)

---

### Option 2: lucasromerodb/xbox-store-api

**Repository**: https://github.com/lucasromerodb/xbox-store-api

An Express.js API wrapper around Microsoft's Game Pass endpoints.

**Endpoints:**
- Current games
- New additions
- Upcoming games
- Games leaving soon

**Data sources used:**
- `https://catalog.gamepass.com` - Game Pass catalog
- `https://displaycatalog.mp.microsoft.com` - Microsoft Store metadata
- `https://reco-public.rec.mp.microsoft.com` - Recommendations

**Output fields:**
- id, title, EAPlay status, imageTile, dateAdded, platforms

**Pros:**
- Self-hostable REST API
- Includes "leaving soon" data

**Cons:**
- Less actively maintained than NikkelM option

---

### Option 3: OpenXBL

**Website**: https://xbl.io/

Third-party Xbox Live API with free tier.

**Better for:** User-specific data (achievements, friends, game history)
**Not ideal for:** Catalog listings

---

## EA Play / EA Play Pro

### Option 1: IsThereAnyDeal API (Recommended)

**Website**: https://isthereanydeal.com/subscriptions/
**API Docs**: https://docs.isthereanydeal.com/

Tracks subscription services including:
- EA Play (~144 games)
- EA Play Pro (~151 games)

**API endpoint:** `POST /games/subscriptions/v1`

**To get access:**
1. Register an app at IsThereAnyDeal
2. Contact api@isthereanydeal.com for subscription endpoint access

**Pros:**
- Single API for multiple services
- Maintained database
- Also tracks Game Pass, Ubisoft+

**Cons:**
- May require approval for subscription endpoints
- Rate limits on free tier

---

### Option 2: PCGamingWiki

**URL**: https://www.pcgamingwiki.com/wiki/List_of_EA_Play_games

Community-maintained list, regularly updated.

**Separates:**
- EA Play (Steam)
- EA Play (Epic Games Store)
- EA Play (EA app)

**Data extraction options:**

1. **MediaWiki API** - Query structured data
   ```
   https://www.pcgamingwiki.com/w/api.php?action=query&list=categorymembers&cmtitle=Category:EA_Play&format=json
   ```

2. **Cargo API** - PCGamingWiki uses Cargo extension for tables
   ```
   https://www.pcgamingwiki.com/w/api.php?action=cargoquery&tables=...
   ```

3. **HTML scraping** - Last resort, parse the wiki tables

**Pros:**
- Free, no API key needed
- Community keeps it updated
- Detailed per-platform breakdown

**Cons:**
- Requires parsing/scraping
- No push notifications for changes

---

### Option 3: gg.deals

**Website**: https://gg.deals/api/
**EA Play Pro list**: https://gg.deals/games/ea-play-pro-pc-games-list/

Has a Prices API (free for personal use).

**Can query by Steam App ID:**
```
GET /api/prices?steamAppIds=123,456,789
```

**Pros:**
- Free for personal use
- Also provides pricing data

**Cons:**
- Requires Steam App ID (not ideal for non-Steam games)
- More focused on prices than catalog membership

---

### Option 4: TCNOco/TcNo-EAPlay-Adder

**Repository**: https://github.com/TCNOco/TcNo-EAPlay-Adder

Tool that adds EA Play games to Steam library. May contain structured game data internally.

**Worth investigating:** Check if it maintains a games list JSON file.

---

## Ubisoft+ / Ubisoft+ Classics

### Option 1: IsThereAnyDeal API (Recommended)

Same as EA Play section above.

**Tracks:**
- Ubisoft+ Classics (~60 games)
- Ubisoft+ Premium (~148 games)

---

### Option 2: UplayDB (Technical)

**GitHub Organization**: https://github.com/UplayDB

Reverse-engineering project for Ubisoft services. Goal is to create a SteamDB-like tracker.

**Repositories:**

| Repo | Purpose |
|------|---------|
| UplayManifests | Game manifest files, `productconfig.json` |
| UbiServices | Scrapes public-ubiservices.ubi, store.ubi |
| UplayKit | C# SDK for Ubisoft APIs |
| Ubi-Parser | Parse Ubisoft Connect cache files |

**Pros:**
- Deep access to Ubisoft data
- Active development

**Cons:**
- Requires C# knowledge
- More complex to integrate
- Data format not optimized for our use case

---

### Option 3: Haoose/UPLAY_GAME_ID

**Repository**: https://github.com/Haoose/UPLAY_GAME_ID

Simple list of Ubisoft game IDs.

**Format:** Game name + numerical Ubisoft ID

**Useful for:** ID mapping, not catalog membership

---

## Multi-Platform Solutions

### GameScriptions

**Website**: https://gamescriptions.com

Tracks all major subscriptions:
- Xbox Game Pass Ultimate (606 games)
- PlayStation Plus Premium (936 games)
- Ubisoft+ (143 games)
- EA Play (144 games)
- Meta Horizon+ (54 games)

**API availability:** None (consumer-focused website only)

**Potential approach:** Web scraping (check terms of service)

---

### Playnite

**Website**: https://playnite.link/
**Repository**: https://github.com/JosefNemec/Playnite

Open-source desktop game library manager with plugins for all major platforms.

**Has integrations for:**
- Xbox/MS Store
- Ubisoft Connect
- EA app
- Steam, GOG, Epic, etc.

**Useful for:** Studying how they authenticate and fetch library data from each service.

---

## Metadata Enrichment

For games without Steam IDs, enrich metadata from:

### RAWG.io

**Website**: https://rawg.io/apidocs
**Free tier:** Yes, with rate limits

Large game database with:
- Titles, descriptions, release dates
- Platforms, genres, tags
- Screenshots, ratings

### IGDB (Twitch)

**Website**: https://api-docs.igdb.com/
**Free tier:** Yes (requires Twitch developer account)

Comprehensive game database, good for:
- Cross-platform game matching
- Detailed metadata
- Cover art

---

## Recommended Implementation Plan

### Step 1: Xbox Game Pass (Week 1)

1. Clone NikkelM/Game-Pass-API
2. Configure for PC platform, US market
3. Run and capture JSON output
4. Create import script: `POST /api/sync/gamepass`
5. Map fields to our database schema
6. Handle duplicates (games already in Steam library)

### Step 2: EA Play (Week 2)

1. Apply for IsThereAnyDeal API access
2. If approved: use subscription endpoint
3. If not: scrape PCGamingWiki via MediaWiki API
4. Create import script: `POST /api/sync/eaplay`
5. Match games to existing library by title

### Step 3: Ubisoft+ (Week 3)

1. Use IsThereAnyDeal API (same as EA Play)
2. Fallback: manual JSON curation from official site
3. Create import script: `POST /api/sync/ubisoft`

### Step 4: Metadata Enrichment

1. For games without full metadata, query RAWG or IGDB
2. Match by title (fuzzy matching for edge cases)
3. Fill in: description, genres, tags, screenshots, ratings

---

## Data Matching Strategy

Since subscription games may not have Steam App IDs:

1. **Exact title match** - Direct string comparison
2. **Normalized title match** - Lowercase, remove punctuation/special chars
3. **Fuzzy match** - Levenshtein distance for typos/variations
4. **Manual mapping** - Maintain a `title_aliases.json` for known mismatches

**Store in database:**
- `steam_app_id` - For Steam games
- `gamepass_product_id` - Microsoft product ID
- `ea_content_id` - EA's internal ID
- `ubisoft_space_id` - Ubisoft's game identifier

---

## API Endpoints to Implement

```
POST /api/sync/gamepass      - Import Game Pass catalog
POST /api/sync/eaplay        - Import EA Play catalog
POST /api/sync/ubisoft       - Import Ubisoft+ catalog
POST /api/sync/catalogs      - Refresh all subscription catalogs
GET  /api/sync/catalog-status - Check last sync times per service
```

---

## Resources & Links

### Primary Sources
- [NikkelM/Game-Pass-API](https://github.com/NikkelM/Game-Pass-API)
- [IsThereAnyDeal API](https://docs.isthereanydeal.com/)
- [PCGamingWiki EA Play List](https://www.pcgamingwiki.com/wiki/List_of_EA_Play_games)
- [gg.deals API](https://gg.deals/api/)

### Secondary Sources
- [lucasromerodb/xbox-store-api](https://github.com/lucasromerodb/xbox-store-api)
- [UplayDB GitHub](https://github.com/UplayDB)
- [OpenXBL](https://xbl.io/)
- [GameScriptions](https://gamescriptions.com)

### Metadata APIs
- [RAWG API](https://rawg.io/apidocs)
- [IGDB API](https://api-docs.igdb.com/)

---

## Notes

- Xbox Game Pass is the easiest to implement due to NikkelM's excellent tool
- EA Play and Ubisoft+ are trickier - IsThereAnyDeal is the best unified option
- All subscription catalogs change frequently - plan for regular re-syncs
- Consider storing "date_added" and "leaving_soon" flags for subscription awareness
