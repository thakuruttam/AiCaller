import React, { useState } from 'react';
import axios from 'axios';
import { Upload, PlayCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const CreateCampaign = () => {
  const [campaignName, setCampaignName] = useState('');
  const [csvText, setCsvText] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    // Parse simulated CSV Name,Phone
    const contacts = csvText.split('\\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => {
        const [name, phone] = line.split(',');
        return { name: name?.trim(), phone: phone?.trim() };
      }).filter(c => c.name && c.phone);

    if (contacts.length === 0) {
      alert("Please provide at least 1 contact in Name,Phone format.");
      setLoading(false);
      return;
    }

    try {
      // Create campaign
      const campRes = await axios.post('http://localhost:3000/api/campaigns', {
        name: campaignName
      });
      
      const campaignId = campRes.data.id;

      // Upload contacts
      await axios.post(`http://localhost:3000/api/campaigns/${campaignId}/contacts`, {
        contacts
      });

      navigate('/');
    } catch (error) {
      console.error(error);
      alert('Error creating campaign. See console.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
        <h2>Create Campaign</h2>
        <p>Trigger a new automated call campaign using pre-recorded audio.</p>
      </div>

      <form onSubmit={handleSubmit} className="glass-panel">
        <div className="form-group">
          <label className="form-label">Campaign Name</label>
          <input 
            type="text" 
            className="form-input" 
            placeholder="e.g. Loan Follow-up September"
            value={campaignName}
            onChange={(e) => setCampaignName(e.target.value)}
            required
          />
        </div>

        <div className="form-group" style={{ marginBottom: '2rem' }}>
          <label className="form-label">Contacts (CSV Format: Name,Phone)</label>
          <textarea 
            className="form-input" 
            rows={5}
            placeholder="John Doe, +1234567890&#10;Alice Smith, +1987654321"
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            required
            style={{ resize: 'vertical' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={loading}>
            {loading ? 'Processing...' : (
              <>
                <PlayCircle size={18} />
                Launch Campaign
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateCampaign;
