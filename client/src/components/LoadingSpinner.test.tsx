import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LoadingSpinner from './LoadingSpinner';

describe('LoadingSpinner', () => {
  it('should render spinner element', () => {
    render(<LoadingSpinner />);

    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('should have animation class on inner spinner', () => {
    render(<LoadingSpinner />);

    const container = screen.getByTestId('loading-spinner');
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('should be centered', () => {
    render(<LoadingSpinner />);

    const spinner = screen.getByTestId('loading-spinner');
    expect(spinner).toHaveClass('flex', 'items-center', 'justify-center');
  });

  it('should have border styling for visibility', () => {
    render(<LoadingSpinner />);

    const container = screen.getByTestId('loading-spinner');
    const spinner = container.querySelector('.border-2');
    expect(spinner).toBeInTheDocument();
  });
});
