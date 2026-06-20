import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import TopicBadge from '../components/TopicBadge';

describe('TopicBadge', () => {
  it('zeigt den Topic-Namen an', () => {
    render(<TopicBadge name="Kindheit" color="#f87171" />);
    expect(screen.getByText('Kindheit')).toBeInTheDocument();
  });

  it('rendert nichts wenn name null ist', () => {
    const { container } = render(<TopicBadge name={null} color="#f87171" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('rendert nichts wenn name undefined ist', () => {
    const { container } = render(<TopicBadge color="#f87171" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('setzt die Farbe als Inline-Style', () => {
    render(<TopicBadge name="Reisen" color="#60a5fa" />);
    const badge = screen.getByText('Reisen');
    expect(badge).toHaveStyle({ color: '#60a5fa' });
  });

  it('setzt den Hintergrund als transparente Variante der Farbe', () => {
    render(<TopicBadge name="Kindheit" color="#f87171" />);
    const badge = screen.getByText('Kindheit');
    expect(badge).toHaveStyle({ backgroundColor: '#f8717122' });
  });
});
