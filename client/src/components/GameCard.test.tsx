import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GameCard from './GameCard';
import { Game } from '../types/game';

const createMockGame = (overrides: Partial<Game> = {}): Game => ({
  id: 1,
  title: 'Test Game',
  slug: 'test-game',
  coverImageUrl: 'https://example.com/cover.jpg',
  screenshots: [],
  description: null,
  shortDescription: null,
  developer: null,
  publisher: null,
  releaseDate: null,
  genres: [],
  tags: [],
  metacriticScore: null,
  metacriticUrl: null,
  steamRating: null,
  steamRatingCount: null,
  steamAppId: 12345,
  playtimeMinutes: 0,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  platforms: [],
  ...overrides,
});

// Wrapper for components that use react-router hooks
const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('GameCard', () => {
  it('should render game card', () => {
    renderWithRouter(<GameCard game={createMockGame()} />);

    expect(screen.getByTestId('game-card')).toBeInTheDocument();
  });

  it('should display game title', () => {
    renderWithRouter(<GameCard game={createMockGame({ title: 'The Witcher 3' })} />);

    expect(screen.getByRole('heading', { name: 'The Witcher 3' })).toBeInTheDocument();
  });

  it('should render cover image', () => {
    renderWithRouter(<GameCard game={createMockGame({ coverImageUrl: 'https://example.com/witcher.jpg' })} />);

    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://example.com/witcher.jpg');
  });

  it('should have lazy loading on image', () => {
    renderWithRouter(<GameCard game={createMockGame()} />);

    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('loading', 'lazy');
  });

  it('should have async decoding on image', () => {
    renderWithRouter(<GameCard game={createMockGame()} />);

    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('decoding', 'async');
  });

  it('should show Steam badge for Steam games', () => {
    renderWithRouter(<GameCard game={createMockGame({ steamAppId: 12345 })} />);

    // Should have the Steam icon SVG
    const svg = screen.getByRole('img', { hidden: true }).closest('div')?.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('should not show Steam badge for non-Steam games', () => {
    renderWithRouter(<GameCard game={createMockGame({ steamAppId: null })} />);

    // Should not have the badge container
    const card = screen.getByTestId('game-card');
    const badge = card.querySelector('.absolute.top-1\\.5');
    expect(badge).toBeNull();
  });

  it('should fallback to Steam library cover on primary image error', async () => {
    const game = createMockGame({
      coverImageUrl: 'https://invalid.com/broken.jpg',
      steamAppId: 12345,
    });

    renderWithRouter(<GameCard game={game} />);

    const img = screen.getByRole('img');
    fireEvent.error(img);

    await waitFor(() => {
      expect(img).toHaveAttribute(
        'src',
        'https://steamcdn-a.akamaihd.net/steam/apps/12345/library_600x900.jpg'
      );
    });
  });

  it('should fallback to Steam header on library cover error', async () => {
    const game = createMockGame({
      coverImageUrl: 'https://invalid.com/broken.jpg',
      steamAppId: 12345,
    });

    renderWithRouter(<GameCard game={game} />);

    const img = screen.getByRole('img');

    // First error - fallback to library cover
    fireEvent.error(img);

    await waitFor(() => {
      expect(img).toHaveAttribute(
        'src',
        expect.stringContaining('library_600x900.jpg')
      );
    });

    // Second error - fallback to header
    fireEvent.error(img);

    await waitFor(() => {
      expect(img).toHaveAttribute(
        'src',
        'https://steamcdn-a.akamaihd.net/steam/apps/12345/header.jpg'
      );
    });
  });

  it('should show text placeholder after all image fallbacks fail', async () => {
    const game = createMockGame({
      title: 'Fallback Title',
      coverImageUrl: 'https://invalid.com/broken.jpg',
      steamAppId: 12345,
    });

    renderWithRouter(<GameCard game={game} />);

    const img = screen.getByRole('img');

    // Trigger 3 errors to exhaust fallbacks
    fireEvent.error(img);
    fireEvent.error(img);
    fireEvent.error(img);

    await waitFor(() => {
      // Image should be gone, text placeholder should show
      const card = screen.getByTestId('game-card');
      expect(card).toHaveTextContent('Fallback Title');
    });
  });

  it('should show text placeholder when no coverImageUrl and no steamAppId', () => {
    const game = createMockGame({
      title: 'No Cover Game',
      coverImageUrl: null,
      steamAppId: null,
    });

    renderWithRouter(<GameCard game={game} />);

    const card = screen.getByTestId('game-card');
    // Should show text fallback
    expect(card.querySelector('.flex.items-center.justify-center')).toBeInTheDocument();
  });

  it('should have hover effects class', () => {
    renderWithRouter(<GameCard game={createMockGame()} />);

    const card = screen.getByTestId('game-card');
    expect(card).toHaveClass('group');
  });

  it('should link to game detail page', () => {
    renderWithRouter(<GameCard game={createMockGame({ slug: 'my-game' })} />);

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/game/my-game');
  });

  it('should show skeleton while image is loading', () => {
    renderWithRouter(<GameCard game={createMockGame()} />);

    // Before image loads, skeleton should be visible
    const skeleton = screen.getByTestId('game-card').querySelector('.animate-pulse');
    expect(skeleton).toBeInTheDocument();
  });

  it('should hide skeleton after image loads', async () => {
    renderWithRouter(<GameCard game={createMockGame()} />);

    const img = screen.getByRole('img');
    fireEvent.load(img);

    await waitFor(() => {
      expect(img).toHaveClass('opacity-100');
    });
  });

  it('should truncate long titles', () => {
    const longTitle = 'This Is A Very Long Game Title That Should Be Truncated';
    renderWithRouter(<GameCard game={createMockGame({ title: longTitle })} />);

    const heading = screen.getByRole('heading');
    expect(heading).toHaveClass('truncate');
  });
});
