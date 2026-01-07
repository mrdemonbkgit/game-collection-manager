import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CollectionModal from './CollectionModal';
import { Collection } from '../types/collection';
import { FilterState } from '../hooks/useFilterParams';

describe('CollectionModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onSave: vi.fn(),
  };

  const mockCollection: Collection = {
    id: 1,
    name: 'Favorites',
    description: 'My favorite games',
    isSmartFilter: false,
    filterCriteria: null,
    gameCount: 10,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };

  const mockFiltersWithActive: FilterState = {
    search: 'portal',
    platforms: ['Steam'],
    genres: ['Puzzle'],
    collectionIds: [],
    sortBy: 'metacritic_score',
    sortOrder: 'desc',
  };

  const mockFiltersDefault: FilterState = {
    search: '',
    platforms: [],
    genres: [],
    collectionIds: [],
    sortBy: 'title',
    sortOrder: 'asc',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should not render when isOpen is false', () => {
      render(<CollectionModal {...defaultProps} isOpen={false} />);
      expect(screen.queryByTestId('collection-modal')).not.toBeInTheDocument();
    });

    it('should render modal when isOpen is true', () => {
      render(<CollectionModal {...defaultProps} />);
      expect(screen.getByTestId('collection-modal')).toBeInTheDocument();
      expect(screen.getByText('Create Collection')).toBeInTheDocument();
    });

    it('should show Edit Collection title in edit mode', () => {
      render(<CollectionModal {...defaultProps} collection={mockCollection} />);
      expect(screen.getByText('Edit Collection')).toBeInTheDocument();
    });

    it('should populate form with collection data in edit mode', () => {
      render(<CollectionModal {...defaultProps} collection={mockCollection} />);
      expect(screen.getByTestId('collection-name-input')).toHaveValue('Favorites');
      expect(screen.getByTestId('collection-description-input')).toHaveValue(
        'My favorite games'
      );
    });

    it('should have empty form in create mode', () => {
      render(<CollectionModal {...defaultProps} />);
      expect(screen.getByTestId('collection-name-input')).toHaveValue('');
      expect(screen.getByTestId('collection-description-input')).toHaveValue('');
    });
  });

  describe('smart filter checkbox', () => {
    it('should not show smart filter checkbox when no active filters', () => {
      render(
        <CollectionModal {...defaultProps} currentFilters={mockFiltersDefault} />
      );
      expect(
        screen.queryByTestId('smart-filter-checkbox')
      ).not.toBeInTheDocument();
    });

    it('should show smart filter checkbox when active filters exist', () => {
      render(
        <CollectionModal
          {...defaultProps}
          currentFilters={mockFiltersWithActive}
        />
      );
      expect(screen.getByTestId('smart-filter-checkbox')).toBeInTheDocument();
    });

    it('should not show smart filter checkbox in edit mode even with active filters', () => {
      render(
        <CollectionModal
          {...defaultProps}
          collection={mockCollection}
          currentFilters={mockFiltersWithActive}
        />
      );
      expect(
        screen.queryByTestId('smart-filter-checkbox')
      ).not.toBeInTheDocument();
    });

    it('should show when search filter is active', () => {
      const filters: FilterState = {
        ...mockFiltersDefault,
        search: 'test',
      };
      render(<CollectionModal {...defaultProps} currentFilters={filters} />);
      expect(screen.getByTestId('smart-filter-checkbox')).toBeInTheDocument();
    });

    it('should show when sort is changed from default', () => {
      const filters: FilterState = {
        ...mockFiltersDefault,
        sortBy: 'release_date',
      };
      render(<CollectionModal {...defaultProps} currentFilters={filters} />);
      expect(screen.getByTestId('smart-filter-checkbox')).toBeInTheDocument();
    });
  });

  describe('form submission', () => {
    it('should show error when name is empty', async () => {
      const user = userEvent.setup();
      render(<CollectionModal {...defaultProps} />);

      await user.click(screen.getByTestId('collection-save'));

      expect(screen.getByTestId('collection-error')).toHaveTextContent(
        'Collection name is required'
      );
      expect(defaultProps.onSave).not.toHaveBeenCalled();
    });

    it('should show error when name is only whitespace', async () => {
      const user = userEvent.setup();
      render(<CollectionModal {...defaultProps} />);

      await user.type(screen.getByTestId('collection-name-input'), '   ');
      await user.click(screen.getByTestId('collection-save'));

      expect(screen.getByTestId('collection-error')).toHaveTextContent(
        'Collection name is required'
      );
    });

    it('should clear error when user types', async () => {
      const user = userEvent.setup();
      render(<CollectionModal {...defaultProps} />);

      // Trigger error first
      await user.click(screen.getByTestId('collection-save'));
      expect(screen.getByTestId('collection-error')).toBeInTheDocument();

      // Type to clear error
      await user.type(screen.getByTestId('collection-name-input'), 'F');
      expect(screen.queryByTestId('collection-error')).not.toBeInTheDocument();
    });

    it('should call onSave with trimmed name and description', async () => {
      const user = userEvent.setup();
      render(<CollectionModal {...defaultProps} />);

      await user.type(
        screen.getByTestId('collection-name-input'),
        '  My Games  '
      );
      await user.type(
        screen.getByTestId('collection-description-input'),
        '  A description  '
      );
      await user.click(screen.getByTestId('collection-save'));

      expect(defaultProps.onSave).toHaveBeenCalledWith({
        name: 'My Games',
        description: 'A description',
        isSmartFilter: false,
      });
    });

    it('should not include description if empty', async () => {
      const user = userEvent.setup();
      render(<CollectionModal {...defaultProps} />);

      await user.type(screen.getByTestId('collection-name-input'), 'My Games');
      await user.click(screen.getByTestId('collection-save'));

      expect(defaultProps.onSave).toHaveBeenCalledWith({
        name: 'My Games',
        description: undefined,
        isSmartFilter: false,
      });
    });

    it('should include filter criteria when smart filter is checked', async () => {
      const user = userEvent.setup();
      render(
        <CollectionModal
          {...defaultProps}
          currentFilters={mockFiltersWithActive}
        />
      );

      await user.type(
        screen.getByTestId('collection-name-input'),
        'Portal Puzzle'
      );
      await user.click(screen.getByTestId('smart-filter-checkbox'));
      await user.click(screen.getByTestId('collection-save'));

      expect(defaultProps.onSave).toHaveBeenCalledWith({
        name: 'Portal Puzzle',
        description: undefined,
        isSmartFilter: true,
        filterCriteria: {
          search: 'portal',
          platforms: ['Steam'],
          genres: ['Puzzle'],
          sortBy: 'metacritic_score',
          sortOrder: 'desc',
        },
      });
    });

    it('should only include non-default filter values in criteria', async () => {
      const user = userEvent.setup();
      const partialFilters: FilterState = {
        ...mockFiltersDefault,
        genres: ['Action'],
        sortOrder: 'desc', // Changed but sortBy still default
      };
      render(
        <CollectionModal {...defaultProps} currentFilters={partialFilters} />
      );

      await user.type(
        screen.getByTestId('collection-name-input'),
        'Action Games'
      );
      await user.click(screen.getByTestId('smart-filter-checkbox'));
      await user.click(screen.getByTestId('collection-save'));

      expect(defaultProps.onSave).toHaveBeenCalledWith({
        name: 'Action Games',
        description: undefined,
        isSmartFilter: true,
        filterCriteria: {
          genres: ['Action'],
          sortOrder: 'desc',
        },
      });
    });
  });

  describe('closing modal', () => {
    it('should call onClose when Cancel button is clicked', async () => {
      const user = userEvent.setup();
      render(<CollectionModal {...defaultProps} />);

      await user.click(screen.getByTestId('collection-cancel'));
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('should call onClose when clicking overlay', () => {
      render(<CollectionModal {...defaultProps} />);

      fireEvent.click(screen.getByTestId('collection-modal-overlay'));
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('should not close when clicking inside modal', () => {
      render(<CollectionModal {...defaultProps} />);

      fireEvent.click(screen.getByTestId('collection-modal'));
      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });
  });

  describe('form reset on reopen', () => {
    it('should reset form when modal reopens', () => {
      const { rerender } = render(
        <CollectionModal {...defaultProps} isOpen={false} />
      );

      // Open modal
      rerender(<CollectionModal {...defaultProps} isOpen={true} />);
      expect(screen.getByTestId('collection-name-input')).toHaveValue('');

      // Type something
      fireEvent.change(screen.getByTestId('collection-name-input'), {
        target: { value: 'Test' },
      });
      expect(screen.getByTestId('collection-name-input')).toHaveValue('Test');

      // Close and reopen
      rerender(<CollectionModal {...defaultProps} isOpen={false} />);
      rerender(<CollectionModal {...defaultProps} isOpen={true} />);

      // Should be reset
      expect(screen.getByTestId('collection-name-input')).toHaveValue('');
    });

    it('should populate with collection data when switching to edit mode', () => {
      const { rerender } = render(<CollectionModal {...defaultProps} />);

      expect(screen.getByTestId('collection-name-input')).toHaveValue('');

      rerender(
        <CollectionModal {...defaultProps} collection={mockCollection} />
      );

      expect(screen.getByTestId('collection-name-input')).toHaveValue(
        'Favorites'
      );
    });
  });

  describe('button labels', () => {
    it('should show Create button in create mode', () => {
      render(<CollectionModal {...defaultProps} />);
      expect(screen.getByTestId('collection-save')).toHaveTextContent('Create');
    });

    it('should show Save Changes button in edit mode', () => {
      render(<CollectionModal {...defaultProps} collection={mockCollection} />);
      expect(screen.getByTestId('collection-save')).toHaveTextContent(
        'Save Changes'
      );
    });
  });
});
