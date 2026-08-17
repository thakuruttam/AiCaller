import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const simulateCallMock = vi.fn();
const makeAsteriskCallMock = vi.fn();
const makePlivoCallMock = vi.fn();

vi.mock('../src/telephony/mockTelephony.js', () => ({ simulateCall: simulateCallMock }));
vi.mock('../src/telephony/asteriskAdapter.js', () => ({ makeAsteriskCall: makeAsteriskCallMock }));
vi.mock('../src/telephony/plivoAdapter.js', () => ({ makePlivoCall: makePlivoCallMock }));

const { processOutboundCall } = await import('../src/telephony/telephonyFactory.js');

const originalProvider = process.env.TELEPHONY_PROVIDER;

beforeEach(() => {
  simulateCallMock.mockReset().mockResolvedValue({ status: 'mock' });
  makeAsteriskCallMock.mockReset().mockResolvedValue({ status: 'asterisk' });
  makePlivoCallMock.mockReset().mockResolvedValue({ status: 'plivo' });
});

afterEach(() => {
  if (originalProvider === undefined) delete process.env.TELEPHONY_PROVIDER;
  else process.env.TELEPHONY_PROVIDER = originalProvider;
});

describe('processOutboundCall', () => {
  it('routes to simulateCall when TELEPHONY_PROVIDER is unset', async () => {
    delete process.env.TELEPHONY_PROVIDER;
    const callData = { to: '+1234567890' };
    await processOutboundCall(callData);
    expect(simulateCallMock).toHaveBeenCalledWith(callData);
    expect(makeAsteriskCallMock).not.toHaveBeenCalled();
    expect(makePlivoCallMock).not.toHaveBeenCalled();
  });

  it('routes to simulateCall when TELEPHONY_PROVIDER=mock', async () => {
    process.env.TELEPHONY_PROVIDER = 'mock';
    await processOutboundCall({ to: '+1' });
    expect(simulateCallMock).toHaveBeenCalled();
  });

  it('routes to makePlivoCall when TELEPHONY_PROVIDER=plivo, and only that adapter', async () => {
    process.env.TELEPHONY_PROVIDER = 'plivo';
    const callData = { to: '+1234567890' };
    await processOutboundCall(callData);
    expect(makePlivoCallMock).toHaveBeenCalledWith(callData);
    expect(makeAsteriskCallMock).not.toHaveBeenCalled();
    expect(simulateCallMock).not.toHaveBeenCalled();
  });

  it('routes to makeAsteriskCall when TELEPHONY_PROVIDER=asterisk, and only that adapter', async () => {
    process.env.TELEPHONY_PROVIDER = 'asterisk';
    const callData = { to: '+1234567890' };
    await processOutboundCall(callData);
    expect(makeAsteriskCallMock).toHaveBeenCalledWith(callData);
    expect(makePlivoCallMock).not.toHaveBeenCalled();
    expect(simulateCallMock).not.toHaveBeenCalled();
  });

  it('falls back to simulateCall for an unrecognized provider value (documents current behavior)', async () => {
    // .env.example has a stale TELEPHONY_PROVIDER=twilio — anything not plivo/asterisk falls back to mock
    process.env.TELEPHONY_PROVIDER = 'twilio';
    await processOutboundCall({ to: '+1' });
    expect(simulateCallMock).toHaveBeenCalled();
    expect(makeAsteriskCallMock).not.toHaveBeenCalled();
    expect(makePlivoCallMock).not.toHaveBeenCalled();
  });

  it('returns exactly what the selected adapter resolved to', async () => {
    process.env.TELEPHONY_PROVIDER = 'plivo';
    makePlivoCallMock.mockResolvedValue({ status: 'ringing', callUuid: 'abc-123' });
    const result = await processOutboundCall({ to: '+1' });
    expect(result).toEqual({ status: 'ringing', callUuid: 'abc-123' });
  });
});
