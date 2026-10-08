import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Table, { THead, Th, TBody, Tr, Td } from './Table.jsx';

function renderTable({ onRowClick, sort = null, onSort } = {}) {
  return render(
    <Table>
      <THead>
        <Th sort={sort} onSort={onSort}>Name</Th>
        <Th>Plain</Th>
      </THead>
      <TBody>
        <Tr onClick={onRowClick}>
          <Td>Row one</Td>
          <Td><button type="button" onClick={(e) => e.stopPropagation()}>Inner</button></Td>
        </Tr>
      </TBody>
    </Table>
  );
}

describe('Table primitives', () => {
  it('a clickable row is focusable and activates on Enter and Space', async () => {
    const onRowClick = vi.fn();
    renderTable({ onRowClick });
    const row = screen.getByText('Row one').closest('tr');
    expect(row).toHaveAttribute('tabindex', '0');
    row.focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    expect(onRowClick).toHaveBeenCalledTimes(2);
  });

  it('keys pressed on a control inside the row do not activate the row', async () => {
    const onRowClick = vi.fn();
    renderTable({ onRowClick });
    screen.getByText('Inner').focus();
    await userEvent.keyboard('{Enter}');
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it('a row without onClick is not made focusable', () => {
    renderTable();
    expect(screen.getByText('Row one').closest('tr')).not.toHaveAttribute('tabindex');
  });

  it('a sortable header is a button and reports its direction via aria-sort', async () => {
    const onSort = vi.fn();
    const { rerender } = renderTable({ onSort });
    const th = screen.getByRole('columnheader', { name: /Name/ });
    expect(th).not.toHaveAttribute('aria-sort');
    await userEvent.click(screen.getByRole('button', { name: /Name/ }));
    expect(onSort).toHaveBeenCalledOnce();

    rerender(
      <Table><THead><Th sort="desc" onSort={onSort}>Name</Th></THead></Table>
    );
    expect(screen.getByRole('columnheader', { name: /Name/ })).toHaveAttribute('aria-sort', 'descending');
  });

  it('a header without onSort renders plain text, not a button', () => {
    renderTable({ onSort: vi.fn() });
    expect(screen.queryByRole('button', { name: 'Plain' })).toBeNull();
  });
});
