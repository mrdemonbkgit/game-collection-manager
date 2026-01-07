import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Header from './Header';
import { SortOption } from '../services/gamesService';

const mockSortOptions: SortOption[] = [
  { id: 'title-asc', label: 'Title A-Z', sortBy: 'title', sortOrder: 'asc' },
  { id: 'title-desc', label: 'Title Z-A', sortBy: 'title', sortOrder: 'desc' },
];

const defaultProps = {
  totalCount: 2420,
  filteredCount: 2420,
  searchValue: '',
  onSearchChange: vi.fn(),
  sortOptions: mockSortOptions,
  currentSortId: 'title-asc',
  onSortChange: vi.fn(),
};

describe('Header', () => {
  it('should render header element', () => {
    render(<Header {...defaultProps} />);

    expect(screen.getByTestId('header')).toBeInTheDocument();
  });

  it('should display title', () => {
    render(<Header {...defaultProps} />);

    expect(screen.getByRole('heading', { name: /game collection/i })).toBeInTheDocument();
  });

  it('should display total count when not filtered', () => {
    render(<Header {...defaultProps} totalCount={2420} filteredCount={2420} />);

    expect(screen.getByTestId('game-count')).toHaveTextContent('2,420 games');
  });

  it('should display filtered count when different from total', () => {
    render(<Header {...defaultProps} totalCount={2420} filteredCount={42} />);

    expect(screen.getByTestId('game-count')).toHaveTextContent('Showing 42 of 2,420 games');
  });

  it('should format large numbers with commas', () => {
    render(<Header {...defaultProps} totalCount={12345} filteredCount={12345} />);

    expect(screen.getByTestId('game-count')).toHaveTextContent('12,345 games');
  });

  it('should handle zero games', () => {
    render(<Header {...defaultProps} totalCount={0} filteredCount={0} />);

    expect(screen.getByTestId('game-count')).toHaveTextContent('0 games');
  });

  it('should have sticky positioning class', () => {
    render(<Header {...defaultProps} />);

    const header = screen.getByTestId('header');
    expect(header).toHaveClass('sticky');
  });

  it('should have dark background', () => {
    render(<Header {...defaultProps} />);

    const header = screen.getByTestId('header');
    expect(header).toHaveClass('bg-steam-bg-dark');
  });

  it('should render search input', () => {
    render(<Header {...defaultProps} />);

    expect(screen.getByTestId('search-input')).toBeInTheDocument();
  });

  it('should call onSearchChange when typing in search', () => {
    const onSearchChange = vi.fn();
    render(<Header {...defaultProps} onSearchChange={onSearchChange} />);

    const searchInput = screen.getByTestId('search-input');
    fireEvent.change(searchInput, { target: { value: 'test' } });

    expect(onSearchChange).toHaveBeenCalledWith('test');
  });

  it('should render sort dropdown', () => {
    render(<Header {...defaultProps} />);

    expect(screen.getByTestId('sort-dropdown')).toBeInTheDocument();
  });

  it('should call onSortChange when selecting a sort option', () => {
    const onSortChange = vi.fn();
    render(<Header {...defaultProps} onSortChange={onSortChange} />);

    const sortDropdown = screen.getByTestId('sort-dropdown');
    fireEvent.change(sortDropdown, { target: { value: 'title-desc' } });

    expect(onSortChange).toHaveBeenCalledWith('title-desc');
  });
});
