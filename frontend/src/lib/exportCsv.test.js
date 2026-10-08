import { describe, it, expect, vi, afterEach } from 'vitest';
import { exportCsv } from './exportCsv';

const readBytes = (blob) => new Promise((resolve) => {
  const reader = new FileReader();
  reader.onload = () => resolve(new Uint8Array(reader.result));
  reader.readAsArrayBuffer(blob);
});

describe('exportCsv', () => {
  afterEach(() => vi.restoreAllMocks());

  it('downloads the given columns as a BOM-prefixed CSV with escaping', async () => {
    let blob;
    URL.createObjectURL = vi.fn((b) => { blob = b; return 'blob:x'; });
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
      expect(this.download).toBe('campaigns.csv');
      expect(this.href).toBe('blob:x');
    });

    exportCsv('campaigns', [
      { header: 'Name', value: r => r.name },
      { header: 'Owner', value: r => r.owner },
      { header: 'Calls', value: r => r.calls },
    ], [
      { name: 'Q4, "Sales"', owner: null, calls: 3 },
      { name: '₹ Recovery', owner: 'Asha', calls: 0 },
    ]);

    expect(click).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:x');
    const bytes = await readBytes(blob);
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const text = new TextDecoder().decode(bytes.slice(3));
    expect(text.split(/\r?\n/)).toEqual([
      'Name,Owner,Calls',
      '"Q4, ""Sales""",,3',
      '₹ Recovery,Asha,0',
    ]);
  });

  it('does not double the .csv extension', () => {
    URL.createObjectURL = vi.fn(() => 'blob:y');
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
      expect(this.download).toBe('team.csv');
    });
    exportCsv('team.csv', [{ header: 'A', value: r => r.a }], [{ a: 1 }]);
    expect(click).toHaveBeenCalledOnce();
  });
});
