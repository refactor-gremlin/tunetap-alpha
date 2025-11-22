-- CreateTable
CREATE TABLE "ReleaseDateCache" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "trackName" TEXT NOT NULL,
    "artistName" TEXT NOT NULL,
    "releaseDate" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SpotifyPlaylistCache" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tracksJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AudioSourceCache" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "trackName" TEXT NOT NULL,
    "artistName" TEXT NOT NULL,
    "audioUrl" TEXT,
    "spotifyPreviewUrl" TEXT,
    "youtubeUrl" TEXT,
    "coverImage" TEXT,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "ReleaseDateCache_trackName_idx" ON "ReleaseDateCache"("trackName");

-- CreateIndex
CREATE INDEX "ReleaseDateCache_artistName_idx" ON "ReleaseDateCache"("artistName");

-- CreateIndex
CREATE UNIQUE INDEX "ReleaseDateCache_trackName_artistName_key" ON "ReleaseDateCache"("trackName", "artistName");

-- CreateIndex
CREATE INDEX "AudioSourceCache_trackName_idx" ON "AudioSourceCache"("trackName");

-- CreateIndex
CREATE INDEX "AudioSourceCache_artistName_idx" ON "AudioSourceCache"("artistName");

-- CreateIndex
CREATE UNIQUE INDEX "AudioSourceCache_trackName_artistName_key" ON "AudioSourceCache"("trackName", "artistName");
