import React, { useState, useEffect } from 'react';
import { ArrowLeft, Save, Plus, History, Calendar, MessageSquare, Loader2 } from 'lucide-react';
import { Contact, Interaction } from '../types';
import { cn } from '../lib/utils';

interface ContactDetailProps {
  contactId: string;
  onBack: () => void;
  onUpdate: () => void;
}

export default function ContactDetail({ contactId, onBack, onUpdate }: ContactDetailProps) {
  const [contact, setContact] = useState<Contact | null>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [newInteraction, setNewInteraction] = useState({ date: new Date().toISOString().split('T')[0], description: '' });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [cRes, iRes] = await Promise.all([
        fetch(`/api/contacts/${contactId}`).then(r => r.json()),
        fetch(`/api/contacts/${contactId}/interactions`).then(r => r.json())
      ]);
      setContact(cRes);
      setInteractions(iRes);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [contactId]);

  const handleSaveContact = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!contact) return;
    try {
      await fetch(`/api/contacts/${contactId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contact)
      });
      setIsEditing(false);
      onUpdate();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddInteraction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInteraction.description) return;
    try {
      await fetch(`/api/contacts/${contactId}/interactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newInteraction)
      });
      setNewInteraction({ date: new Date().toISOString().split('T')[0], description: '' });
      const iRes = await fetch(`/api/contacts/${contactId}/interactions`).then(r => r.json());
      setInteractions(iRes);
    } catch (err) {
      console.error(err);
    }
  };

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-emerald-600" /></div>;
  if (!contact) return <div>Contact not found</div>;

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors">
        <ArrowLeft size={18} />
        Back to Contacts
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contact Info & Edit */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
              <h2 className="font-semibold text-slate-800">Contact Information</h2>
              <button 
                onClick={() => setIsEditing(!isEditing)}
                className="text-emerald-600 hover:text-emerald-700 text-sm font-medium"
              >
                {isEditing ? 'Cancel Edit' : 'Edit Info'}
              </button>
            </div>
            <div className="p-6">
              {isEditing ? (
                <form onSubmit={handleSaveContact} className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">First Name</label>
                    <input 
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      value={contact.firstName}
                      onChange={e => setContact({...contact, firstName: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Last Name</label>
                    <input 
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      value={contact.lastName}
                      onChange={e => setContact({...contact, lastName: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Email</label>
                    <input 
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      value={contact.email1}
                      onChange={e => setContact({...contact, email1: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Phone</label>
                    <input 
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      value={contact.phone1}
                      onChange={e => setContact({...contact, phone1: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Company</label>
                    <input 
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      value={contact.companyName}
                      onChange={e => setContact({...contact, companyName: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <div className="flex justify-between">
                      <label className="text-xs font-bold text-slate-500 uppercase">Tags</label>
                      <span className="text-[10px] text-slate-400">Separate with commas</span>
                    </div>
                    <input 
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      value={contact.tag || ''}
                      onChange={e => setContact({...contact, tag: e.target.value})}
                      placeholder="e.g. investor, tech, vip"
                    />
                  </div>
                  <button type="submit" className="col-span-2 bg-emerald-600 text-white py-2 rounded-lg hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 mt-2">
                    <Save size={18} />
                    Save Changes
                  </button>
                </form>
              ) : (
                <div className="grid grid-cols-2 gap-y-6">
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Full Name</p>
                    <p className="text-slate-800 font-medium text-lg">{contact.firstName} {contact.lastName}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Company</p>
                    <p className="text-slate-800">{contact.companyName || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Email</p>
                    <p className="text-emerald-600 hover:underline cursor-pointer">{contact.email1}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Phone</p>
                    <p className="text-slate-800">{contact.phone1 || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Tags</p>
                    <div className="flex flex-wrap gap-1">
                      {contact.tag ? contact.tag.split(',').map((t, idx) => (
                        <span key={idx} className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-md text-[10px] font-bold">
                          {t.trim()}
                        </span>
                      )) : (
                        <span className="text-slate-400 italic text-sm">No tags</span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Interaction Form */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="bg-emerald-50 px-6 py-4 border-b border-slate-200 flex items-center gap-2">
              <Plus size={18} className="text-emerald-600" />
              <h2 className="font-semibold text-emerald-800">Log New Interaction</h2>
            </div>
            <form onSubmit={handleAddInteraction} className="p-6 space-y-4">
              <div className="grid grid-cols-4 gap-4">
                <div className="col-span-1 space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Date</label>
                  <input 
                    type="date"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                    value={newInteraction.date}
                    onChange={e => setNewInteraction({...newInteraction, date: e.target.value})}
                  />
                </div>
                <div className="col-span-3 space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Discussion Summary</label>
                  <input 
                    placeholder="Briefly describe what was discussed..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                    value={newInteraction.description}
                    onChange={e => setNewInteraction({...newInteraction, description: e.target.value})}
                  />
                </div>
              </div>
              <button type="submit" className="w-full bg-emerald-600 text-white py-2 rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium">
                Log Interaction
              </button>
            </form>
          </div>
        </div>

        {/* History Timeline */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col h-full">
          <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center gap-2">
            <History size={18} className="text-slate-500" />
            <h2 className="font-semibold text-slate-800">History</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            {interactions.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <MessageSquare className="mx-auto mb-2 opacity-20" size={48} />
                <p>No history logged yet</p>
              </div>
            ) : (
              <div className="space-y-6 relative before:absolute before:left-3 before:top-0 before:bottom-0 before:w-px before:bg-slate-100">
                {interactions.map((i) => (
                  <div key={i.id} className="relative pl-8">
                    <div className="absolute left-1.5 top-1.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white"></div>
                    <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                      <Calendar size={12} />
                      {new Date(i.date).toLocaleDateString()}
                    </div>
                    <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-100">
                      {i.description}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
