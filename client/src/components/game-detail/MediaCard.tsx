interface MediaCardProps {
  gameTitle: string;
}

export function MediaCard({ gameTitle }: MediaCardProps) {
  const encodedTitle = encodeURIComponent(gameTitle);

  return (
    <div className="bg-steam-bg-card rounded-lg p-4">
      <h3 className="text-steam-text-muted text-sm font-medium mb-3 uppercase tracking-wide">
        Media
      </h3>

      <div className="space-y-2">
        {/* YouTube - Trailer Search */}
        <a
          href={`https://www.youtube.com/results?search_query=${encodedTitle}+official+trailer`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 p-2 bg-steam-bg/50 rounded hover:bg-steam-bg transition-colors group"
        >
          <div className="w-8 h-8 bg-[#FF0000] rounded flex items-center justify-center">
            <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M10 15l5.19-3L10 9v6m11.56-7.83c.13.47.22 1.1.28 1.9.07.8.1 1.49.1 2.09L22 12c0 2.19-.16 3.8-.44 4.83-.25.9-.83 1.48-1.73 1.73-.47.13-1.33.22-2.65.28-1.3.07-2.49.1-3.59.1L12 19c-4.19 0-6.8-.16-7.83-.44-.9-.25-1.48-.83-1.73-1.73-.13-.47-.22-1.1-.28-1.9-.07-.8-.1-1.49-.1-2.09L2 12c0-2.19.16-3.8.44-4.83.25-.9.83-1.48 1.73-1.73.47-.13 1.33-.22 2.65-.28 1.3-.07 2.49-.1 3.59-.1L12 5c4.19 0 6.8.16 7.83.44.9.25 1.48.83 1.73 1.73z"/>
            </svg>
          </div>
          <span className="text-steam-text text-sm group-hover:text-white transition-colors">
            Watch Trailer
          </span>
        </a>

        {/* Twitch */}
        <a
          href={`https://www.twitch.tv/directory/game/${encodedTitle}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 p-2 bg-steam-bg/50 rounded hover:bg-steam-bg transition-colors group"
        >
          <div className="w-8 h-8 bg-[#9146FF] rounded flex items-center justify-center">
            <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.64 5.93h1.43v4.28h-1.43m3.93-4.28H17v4.28h-1.43M7 2L3.43 5.57v12.86h4.28V22l3.58-3.57h2.85L20.57 12V2m-1.43 9.29l-2.85 2.85h-2.86l-2.5 2.5v-2.5H7.71V3.43h11.43Z"/>
            </svg>
          </div>
          <span className="text-steam-text text-sm group-hover:text-white transition-colors">
            Watch on Twitch
          </span>
        </a>
      </div>
    </div>
  );
}
