import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import WaveLoader from './WaveLoader.jsx';
import Spinner from '../Spinner.jsx';
import PageLoader from '../PageLoader.jsx';
import Button from './Button.jsx';

const bars = (el) => el.querySelectorAll('.voice-wave-bar');

describe('WaveLoader', () => {
  it('announces itself as a status with its label', () => {
    render(<WaveLoader label="Loading calls" />);
    expect(screen.getByRole('status', { name: 'Loading calls' })).toBeInTheDocument();
  });

  it('renders staggered bars sized to the requested step', () => {
    render(<WaveLoader size="xl" />);
    const el = screen.getByRole('status');
    expect(bars(el)).toHaveLength(7);
    expect(el).toHaveStyle({ height: '64px' });
    const delays = [...bars(el)].map((b) => b.style.animationDelay);
    expect(new Set(delays).size).toBe(7);
  });

  it('accepts a pixel size, as the legacy Spinner API passes', () => {
    render(<Spinner size={14} />);
    const el = screen.getByRole('status');
    expect(el).toHaveStyle({ height: '14px' });
    expect(bars(el)).toHaveLength(4);
  });

  it('PageLoader shows the wave with its text', () => {
    render(<PageLoader text="Loading usage…" />);
    expect(screen.getByRole('status', { name: 'Loading usage…' })).toBeInTheDocument();
    expect(screen.getByText('Loading usage…')).toBeInTheDocument();
  });

  it('a loading Button shows the wave and is disabled', () => {
    render(<Button loading>Save</Button>);
    const button = screen.getByRole('button', { name: /Save/ });
    expect(button).toBeDisabled();
    expect(button.querySelector('.voice-wave')).not.toBeNull();
  });
});
