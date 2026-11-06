import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CallCostsCard from './CallCostsCard';

const services = (scale) => [
  ['plivo', 'Phone line (Plivo)', 0.46], ['geminiAudioIn', 'Gemini Live — caller audio in', 0.3],
  ['geminiAudioOut', 'Gemini Live — bot audio out', 0.8], ['geminiText', 'Gemini Live — instructions, history & text', 0.5],
  ['sarvam', 'Sarvam speech-to-text', 0.2], ['openai', 'OpenAI checks during the call', 0.05], ['evaluation', 'Scoring after the call (Gemini)', 0.1],
].map(([key, label, perMinuteInr]) => ({ key, label, perMinuteInr: perMinuteInr * scale, totalInr: perMinuteInr * scale * 10 }));

const costs = {
  days: 30, usdToInr: 85, geminiUsageCountedAs: 'per turn (every report)',
  modes: {
    questions: { calls: 7, meteredCalls: 5, minutes: 10, totalInr: 24.1, perMinuteInr: 2.41, perCallInr: 3.44, services: services(1) },
    conversation: { calls: 4, meteredCalls: 4, minutes: 10, totalInr: 62, perMinuteInr: 6.2, perCallInr: 15.5, services: services(2.5) },
  },
  fixed: { items: [{ item: 'AWS EC2 t3.small', inr: 1390 }, { item: 'MongoDB Atlas', inr: null, note: 'check the bill' }], knownMonthlyInr: 1390, perMinuteInr: 69.5 },
};

describe('CallCostsCard', () => {
  it('shows per-minute cost, margin and every service for both kinds of call', () => {
    render(<CallCostsCard costs={costs} />);
    expect(screen.getByText('What calls cost us')).toBeInTheDocument();
    expect(screen.getByText(/Margin ₹2.59 \/ min/)).toBeInTheDocument();
    expect(screen.getByText(/Loss ₹1.20 \/ min/)).toBeInTheDocument();
    expect(screen.getByText('Sarvam speech-to-text')).toBeInTheDocument();
    expect(screen.getByText(/MongoDB Atlas — check the bill/)).toBeInTheDocument();
    expect(screen.getByText('not known')).toBeInTheDocument();
  });

  it('renders nothing for workspace users, who get no cost data', () => {
    const { container } = render(<CallCostsCard costs={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });
});
