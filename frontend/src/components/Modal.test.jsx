import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Modal from './Modal.jsx';

function renderModal(props = {}) {
  const onClose = vi.fn();
  render(
    <Modal isOpen onClose={onClose} title="Invite member" description="Send an invite link" {...props}>
      <input aria-label="Email" />
    </Modal>
  );
  return { onClose };
}

describe('Modal', () => {
  it('renders nothing when closed', () => {
    render(<Modal isOpen={false} onClose={() => {}} title="Hidden" />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('portals into <body> under its own theme scope and labels itself', () => {
    renderModal();
    const dialog = screen.getByRole('dialog', { name: 'Invite member' });
    expect(dialog).toHaveAccessibleDescription('Send an invite link');
    expect(dialog.closest('.web3-dashboard')).not.toBeNull();
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('closes on Escape, backdrop click and the close button', async () => {
    const { onClose } = renderModal();
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
    await userEvent.click(document.querySelector('[aria-hidden="true"].absolute'));
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('ignores Escape and backdrop and hides the close button when not dismissible', async () => {
    const { onClose } = renderModal({ dismissible: false });
    await userEvent.keyboard('{Escape}');
    await userEvent.click(document.querySelector('[aria-hidden="true"].absolute'));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Close dialog' })).toBeNull();
  });

  it('uses alertdialog for the danger tone', () => {
    renderModal({ tone: 'danger' });
    expect(screen.getByRole('alertdialog', { name: 'Invite member' })).toBeInTheDocument();
  });

  it('only the top-most dialog answers Escape', async () => {
    const outer = vi.fn();
    const inner = vi.fn();
    render(<>
      <Modal isOpen onClose={outer} title="Outer" />
      <Modal isOpen onClose={inner} title="Inner" />
    </>);
    await userEvent.keyboard('{Escape}');
    expect(inner).toHaveBeenCalledOnce();
    expect(outer).not.toHaveBeenCalled();
  });

  it('restores page scroll once the last dialog closes, in any close order', () => {
    const { rerender } = render(<>
      <Modal isOpen onClose={() => {}} title="A" />
      <Modal isOpen onClose={() => {}} title="B" />
    </>);
    rerender(<>
      <Modal isOpen={false} onClose={() => {}} title="A" />
      <Modal isOpen onClose={() => {}} title="B" />
    </>);
    expect(document.body.style.overflow).toBe('hidden');
    rerender(<>
      <Modal isOpen={false} onClose={() => {}} title="A" />
      <Modal isOpen={false} onClose={() => {}} title="B" />
    </>);
    expect(document.body.style.overflow).toBe('');
  });

  it('restores page scroll when it closes', () => {
    const { rerender } = render(<Modal isOpen onClose={() => {}} title="T" />);
    expect(document.body.style.overflow).toBe('hidden');
    rerender(<Modal isOpen={false} onClose={() => {}} title="T" />);
    expect(document.body.style.overflow).toBe('');
  });
});
