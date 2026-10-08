import React, { useState } from 'react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import { Button, CopyField, Modal, Tabs } from './ui';

const VALIDITY_OPTIONS = [3, 7, 14, 30].map((d) => ({ value: d, label: `${d} days` }));

// Public share link for a campaign's call reports. Opened from both the
// campaign details and campaign report screens.
export default function ShareCampaignModal({ campaignId, isOpen, onClose }) {
  const [days, setDays] = useState(7);
  const [link, setLink] = useState(null);
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();

  const generate = async () => {
    setLoading(true);
    try {
      const res = await api.post(`/api/share/campaigns/${campaignId}`, { validityDays: days });
      setLink({ url: `${window.location.origin}/share/${res.data.token}`, expiresAt: res.data.expiresAt });
    } catch {
      addToast('Failed to generate link', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Share campaign report"
      description="A public link to every call report in this campaign. No login required."
      footer={link
        ? <Button variant="secondary" onClick={() => setLink(null)}>Generate another</Button>
        : <Button icon="link" loading={loading} onClick={generate}>Generate link</Button>}
    >
      {!link ? (
        <div>
          <p className="block text-[13px] font-medium text-foreground mb-2">Link valid for</p>
          <Tabs items={VALIDITY_OPTIONS} value={days} onChange={setDays} />
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground mb-3">
            Expires on <strong className="text-foreground">{new Date(link.expiresAt).toLocaleDateString()}</strong>
          </p>
          <CopyField value={link.url} />
        </>
      )}
    </Modal>
  );
}
