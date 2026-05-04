import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  UserPlus, 
  Briefcase, 
  CheckSquare, 
  Settings, 
  LogOut, 
  Plus, 
  Search,
  Filter,
  MoreVertical,
  TrendingUp,
  DollarSign,
  Target,
  Clock,
  ChevronRight,
  ChevronLeft,
  Menu,
  X,
  Bell,
  Edit2,
  Trash2,
  Database,
  Upload
} from 'lucide-react';
import Papa from 'papaparse';
import AIAssistant from './components/AIAssistant';
import ContactDetail from './components/ContactDetail';
import { Lead, Contact, Deal, Task, UserProfile } from './types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Utility ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

const SidebarItem = ({ icon: Icon, label, active, onClick }: { icon: any, label: string, active?: boolean, onClick: () => void }) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-center w-full gap-3 px-4 py-3 text-sm font-medium transition-colors rounded-lg",
      active 
        ? "bg-emerald-50 text-emerald-700" 
        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
    )}
  >
    <Icon size={20} />
    <span>{label}</span>
  </button>
);

const Card = ({ children, className }: { children: React.ReactNode, className?: string }) => (
  <div className={cn("bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden", className)}>
    {children}
  </div>
);

const Badge = ({ children, variant = 'default' }: { children: React.ReactNode, variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' }) => {
  const variants = {
    default: "bg-slate-100 text-slate-700",
    success: "bg-emerald-100 text-emerald-700",
    warning: "bg-amber-100 text-amber-700",
    danger: "bg-rose-100 text-rose-700",
    info: "bg-sky-100 text-sky-700",
  };
  return (
    <span className={cn("px-2 py-0.5 text-xs font-medium rounded-full", variants[variant])}>
      {children}
    </span>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<any>({
    uid: 'local-admin',
    displayName: 'Local Admin',
    email: 'admin@local.host',
    photoURL: ''
  });
  const [profile, setProfile] = useState<UserProfile | null>({
    uid: 'local-admin',
    email: 'admin@local.host',
    displayName: 'Local Admin',
    role: 'admin',
    createdAt: new Date().toISOString()
  });
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [totalContactCount, setTotalContactCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'createdAt', direction: 'desc' });
  const [tagFilter, setTagFilter] = useState('');

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Clear selection on search or filter
  useEffect(() => {
    if (activeTab === 'contacts') {
      setSelectedContactId(null);
    }
  }, [debouncedSearchQuery, tagFilter]);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [newContact, setNewContact] = useState<Partial<Contact>>({
    firstName: '',
    lastName: '',
    email1: '',
    email2: '',
    phone1: '',
    phone2: '',
    companyName: '',
    jobDescription: '',
    tag: '',
    otherInfo: ''
  });

  // Data Fetching
  const refreshData = async (query = debouncedSearchQuery, sort = sortConfig, tag = tagFilter) => {
    try {
      let contactsUrl = `/api/contacts?sortBy=${sort.key}&order=${sort.direction}`;
      if (query) contactsUrl += `&q=${encodeURIComponent(query)}`;
      if (tag) contactsUrl += `&tag=${encodeURIComponent(tag)}`;
      
      const [leadsRes, dealsRes, tasksRes, contactsRes, tagsRes] = await Promise.all([
        fetch('/api/leads').then(r => r.json()),
        fetch('/api/deals').then(r => r.json()),
        fetch('/api/tasks').then(r => r.json()),
        fetch(contactsUrl).then(r => r.json()),
        fetch('/api/tags').then(r => r.json())
      ]);

      setLeads(leadsRes);
      setDeals(dealsRes);
      setTasks(tasksRes);
      setContacts(contactsRes);
      setAvailableTags(tagsRes);
      setTotalContactCount(contactsRes.length);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch local data:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, [debouncedSearchQuery, sortConfig, tagFilter]);

  const toggleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleLogin = () => {
    // In local mode, we just stay "logged in" as admin
    alert("Local mode: You are already logged in as Local Admin.");
  };

  const handleLogout = () => {
    alert("In local mode, logout is disabled.");
  };

  const handleEditContact = (contact: Contact) => {
    setNewContact({
      firstName: contact.firstName,
      lastName: contact.lastName,
      email1: contact.email1,
      email2: contact.email2 || '',
      phone1: contact.phone1 || '',
      phone2: contact.phone2 || '',
      companyName: contact.companyName || '',
      jobDescription: contact.jobDescription || '',
      tag: contact.tag || '',
      otherInfo: contact.otherInfo || ''
    });
    setEditingContactId(contact.id || null);
    setShowContactModal(true);
  };

  const handleDeleteContact = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this contact?')) return;
    try {
      await fetch(`/api/contacts/${id}`, { method: 'DELETE' });
      setContacts(prev => prev.filter(c => c.id !== id));
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  const handleBulkUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        let count = 0;
        for (const row of results.data as any[]) {
          const contactData = {
            firstName: row.firstName || row.FirstName || row['First Name'] || '',
            lastName: row.lastName || row.LastName || row['Last Name'] || '',
            email1: row.email1 || row.Email1 || row.email || row.Email || '',
            email2: row.email2 || row.Email2 || '',
            phone1: row.phone1 || row.Phone1 || row.phone || row.Phone || '',
            phone2: row.phone2 || row.Phone2 || '',
            companyName: row.companyName || row.CompanyName || row.company || row.Company || '',
            jobDescription: row.jobDescription || row.JobDescription || row.job || row.Job || '',
            tag: row.tag || row.Tag || 'bulk-upload',
            otherInfo: row.otherInfo || row.OtherInfo || row.Notes || ''
          };

          if (!contactData.firstName || !contactData.lastName) continue;

          await fetch('/api/contacts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(contactData)
          });
          count++;
        }

        alert(`Successfully uploaded ${count} contacts!`);
        refreshData();
        setUploading(false);
        event.target.value = '';
      },
      error: (error) => {
        alert(`Error parsing CSV: ${error.message}`);
        setUploading(false);
      }
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-4">
        <div className="w-full max-w-md p-8 bg-white border border-slate-200 rounded-2xl shadow-xl text-center">
          <div className="flex justify-center mb-6">
            <div className="p-3 bg-emerald-100 text-emerald-600 rounded-2xl">
              <Briefcase size={40} />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Grove CRM</h1>
          <p className="text-slate-600 mb-8">Professional relationship management for you and your agent.</p>
          <button
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 px-6 py-3 text-white bg-emerald-600 hover:bg-emerald-700 font-semibold rounded-xl transition-all shadow-lg shadow-emerald-200"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
            Sign in with Google
          </button>
          <div className="mt-8 pt-8 border-t border-slate-100">
            <p className="text-xs text-slate-400 uppercase tracking-widest font-bold mb-4">API Access for Agents</p>
            <div className="space-y-4 text-left">
              <div>
                <p className="text-[10px] font-bold text-slate-400 mb-1">EXECUTE COMMAND (NLP)</p>
                <code className="block p-3 bg-slate-50 rounded-lg text-[10px] text-slate-600 overflow-x-auto">
                  POST /api/ai/command {"{ \"prompt\": \"Log a call with John Doe...\" }"}
                </code>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 mb-1">LOG INTERACTION</p>
                <code className="block p-3 bg-slate-50 rounded-lg text-[10px] text-slate-600 overflow-x-auto">
                  POST /api/contacts/:id/interactions {"{ \"description\": \"...\" }"}
                </code>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 transition-transform lg:relative lg:translate-x-0",
        !isSidebarOpen && "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          <div className="flex items-center gap-3 px-6 py-8">
            <div className="p-2 bg-emerald-600 text-white rounded-lg">
              <Briefcase size={24} />
            </div>
            <span className="text-xl font-bold tracking-tight">Grove</span>
          </div>

          <nav className="flex-1 px-4 space-y-1">
            <SidebarItem 
              icon={LayoutDashboard} 
              label="Dashboard" 
              active={activeTab === 'dashboard'} 
              onClick={() => setActiveTab('dashboard')} 
            />
            <SidebarItem 
              icon={UserPlus} 
              label="Leads" 
              active={activeTab === 'leads'} 
              onClick={() => setActiveTab('leads')} 
            />
            <SidebarItem 
              icon={Users} 
              label="Contacts" 
              active={activeTab === 'contacts'} 
              onClick={() => setActiveTab('contacts')} 
            />
            <SidebarItem 
              icon={TrendingUp} 
              label="Deals" 
              active={activeTab === 'deals'} 
              onClick={() => setActiveTab('deals')} 
            />
            <SidebarItem 
              icon={CheckSquare} 
              label="Tasks" 
              active={activeTab === 'tasks'} 
              onClick={() => setActiveTab('tasks')} 
            />
          </nav>

          <div className="p-4 border-t border-slate-100">
            <div className="flex items-center gap-3 px-4 py-3 mb-4">
              <img 
                src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} 
                className="w-10 h-10 rounded-full border border-slate-200"
                alt="Profile"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{user.displayName}</p>
                <p className="text-xs text-slate-500 truncate capitalize">{profile?.role}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center w-full gap-3 px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
            >
              <LogOut size={18} />
              <span>Sign Out</span>
            </button>

                <div className="mt-4 px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Database size={12} className="text-slate-400" />
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Storage Engine</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-slate-700 truncate max-w-[120px]">
                      Local SQLite
                    </span>
                    <div className="flex h-1.5 w-1.5 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                    </div>
                  </div>
                </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 overflow-auto">
        {/* Header */}
        <header className="sticky top-0 z-30 flex items-center justify-between px-6 py-4 bg-white/80 backdrop-blur-md border-bottom border-slate-200">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg lg:hidden"
            >
              {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold capitalize">{activeTab}</h2>
              {activeTab === 'contacts' && (totalContactCount > 0 || contacts.length > 0) && (
                <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-full font-mono shadow-sm">
                  {(totalContactCount || contacts.length).toLocaleString()}
                </span>
              )}
              {activeTab === 'leads' && leads.length > 0 && (
                <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 rounded-full font-mono shadow-sm">
                  {leads.length.toLocaleString()}
                </span>
              )}
              {activeTab === 'deals' && deals.length > 0 && (
                <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200 rounded-full font-mono shadow-sm">
                  {deals.length.toLocaleString()}
                </span>
              )}
              {activeTab === 'tasks' && tasks.length > 0 && (
                <span className="px-2 py-0.5 text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200 rounded-full font-mono shadow-sm">
                  {tasks.length.toLocaleString()}
                </span>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* User Profile Info */}
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg text-[10px] font-mono text-slate-500 border border-slate-200">
              <span>{user.email}</span>
              <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
              <span className="capitalize font-bold text-emerald-600">{profile?.role || '...'}</span>
            </div>

            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Search contacts by name, email, or tag..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-10 py-2 text-sm bg-slate-100 border-transparent focus:bg-white focus:border-emerald-500 rounded-lg transition-all outline-none w-80 shadow-inner"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200 transition-colors"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {activeTab === 'contacts' && (
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <select
                  value={tagFilter}
                  onChange={(e) => setTagFilter(e.target.value)}
                  className="pl-9 pr-8 py-2 text-sm bg-slate-100 border-transparent focus:bg-white focus:border-emerald-500 rounded-lg transition-all outline-none appearance-none cursor-pointer"
                >
                  <option value="">All Tags</option>
                  {availableTags.map(tag => (
                    <option key={tag} value={tag}>{tag}</option>
                  ))}
                </select>
              </div>
            )}
            <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg relative">
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white"></span>
            </button>
            
            {activeTab === 'contacts' && (
              <div className="relative">
                <input 
                  type="file" 
                  accept=".csv" 
                  onChange={handleBulkUpload}
                  className="hidden" 
                  id="csv-upload"
                  disabled={uploading}
                />
                <label 
                  htmlFor="csv-upload"
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-all shadow-sm cursor-pointer",
                    uploading && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {uploading ? (
                    <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Upload size={18} />
                  )}
                  <span className="hidden sm:inline">{uploading ? 'Uploading...' : 'Bulk Upload'}</span>
                </label>
              </div>
            )}

            <button 
              onClick={async () => {
                if (activeTab === 'contacts') {
                  setShowContactModal(true);
                  return;
                }
                const type = activeTab === 'dashboard' ? 'leads' : activeTab;
                try {
                  const endpoint = `/api/${type}`;
                  const body = type === 'leads' ? { name: 'Quick Lead', status: 'new' } :
                               type === 'deals' ? { name: 'New Deal', value: 5000, stage: 'discovery' } :
                               { title: 'New Task', status: 'todo', priority: 'medium' };

                  await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                  });
                  refreshData();
                } catch (error) {
                  console.error('Create failed:', error);
                }
              }}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-all shadow-sm"
            >
              <Plus size={18} />
              <span className="hidden sm:inline">New {activeTab === 'dashboard' ? 'Lead' : activeTab.slice(0, -1)}</span>
            </button>
          </div>
        </header>

        <div className="p-6">
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Stats Grid */}
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                      <DollarSign size={24} />
                    </div>
                    <Badge variant="success">+12%</Badge>
                  </div>
                  <p className="text-sm font-medium text-slate-500">Total Revenue</p>
                  <h3 className="text-2xl font-bold">$128,430</h3>
                </Card>
                <Card className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2 bg-sky-100 text-sky-600 rounded-lg">
                      <TrendingUp size={24} />
                    </div>
                    <Badge variant="info">+5%</Badge>
                  </div>
                  <p className="text-sm font-medium text-slate-500">Active Deals</p>
                  <h3 className="text-2xl font-bold">{deals.length}</h3>
                </Card>
                <Card className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
                      <UserPlus size={24} />
                    </div>
                    <Badge variant="warning">+18%</Badge>
                  </div>
                  <p className="text-sm font-medium text-slate-500">New Leads</p>
                  <h3 className="text-2xl font-bold">{leads.length}</h3>
                </Card>
                <Card className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2 bg-rose-100 text-rose-600 rounded-lg">
                      <CheckSquare size={24} />
                    </div>
                    <Badge variant="danger">-2%</Badge>
                  </div>
                  <p className="text-sm font-medium text-slate-500">Open Tasks</p>
                  <h3 className="text-2xl font-bold">{tasks.filter(t => t.status !== 'done').length}</h3>
                </Card>
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Recent Leads */}
                <Card>
                  <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                    <h3 className="font-bold">Recent Leads</h3>
                    <button onClick={() => setActiveTab('leads')} className="text-sm text-emerald-600 font-medium hover:underline">View all</button>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {leads.length > 0 ? leads.slice(0, 5).map((lead) => (
                      <div key={lead.id} className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 font-bold">
                            {lead.name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-semibold">{lead.name}</p>
                            <p className="text-xs text-slate-500">{lead.company || 'Private'}</p>
                          </div>
                        </div>
                        <Badge variant={lead.status === 'new' ? 'info' : 'success'}>
                          {lead.status}
                        </Badge>
                      </div>
                    )) : (
                      <div className="p-12 text-center text-slate-400 italic">No leads found.</div>
                    )}
                  </div>
                </Card>

                {/* Upcoming Tasks */}
                <Card>
                  <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                    <h3 className="font-bold">Upcoming Tasks</h3>
                    <button onClick={() => setActiveTab('tasks')} className="text-sm text-emerald-600 font-medium hover:underline">View all</button>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {tasks.length > 0 ? tasks.slice(0, 5).map((task) => (
                      <div key={task.id} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors">
                        <div className={cn(
                          "w-2 h-2 rounded-full mt-1.5",
                          task.priority === 'high' ? 'bg-rose-500' : task.priority === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'
                        )} />
                        <div className="flex-1">
                          <p className="text-sm font-semibold">{task.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Clock size={12} className="text-slate-400" />
                            <span className="text-xs text-slate-500">Due tomorrow</span>
                          </div>
                        </div>
                        <button className="p-1 text-slate-400 hover:text-slate-600">
                          <ChevronRight size={18} />
                        </button>
                      </div>
                    )) : (
                      <div className="p-12 text-center text-slate-400 italic">No tasks found.</div>
                    )}
                  </div>
                </Card>
              </div>
            </div>
          )}

          {activeTab === 'leads' && (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Name</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Company</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Status</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {leads.length > 0 ? leads.map((lead) => (
                      <tr key={lead.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-semibold">{lead.name}</div>
                          <div className="text-xs text-slate-500">{lead.email || 'No email'}</div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">{lead.company || '-'}</td>
                        <td className="px-6 py-4">
                          <Badge variant={lead.status === 'new' ? 'info' : 'success'}>{lead.status}</Badge>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500">
                          {lead.createdAt?.toDate ? lead.createdAt.toDate().toLocaleDateString() : 'Just now'}
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">
                          No leads found. Click "New Lead" to add one.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {activeTab === 'contacts' && (
            <div className="space-y-4">
              {selectedContactId ? (
                <ContactDetail 
                  contactId={selectedContactId} 
                  onBack={() => setSelectedContactId(null)}
                  onUpdate={refreshData}
                />
              ) : (
                <>
                  <Card>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            {['firstName', 'lastName', 'email1', 'phones', 'companyName', 'otherInfo', 'createdAt', 'tag'].map((key) => {
                              const labels: Record<string, string> = {
                                firstName: 'First Name',
                                lastName: 'Last Name',
                                email1: 'Emails',
                                phones: 'Phones',
                                companyName: 'Company',
                                otherInfo: 'Other Info',
                                createdAt: 'Date Created',
                                tag: 'Tag'
                              };
                              const isSortable = ['firstName', 'lastName', 'email1', 'companyName', 'tag', 'createdAt'].includes(key);
                              
                              return (
                                <th 
                                  key={key}
                                  className={cn(
                                    "px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500",
                                    isSortable && "cursor-pointer hover:text-slate-900 transition-colors"
                                  )}
                                  onClick={() => isSortable && toggleSort(key)}
                                >
                                  <div className="flex items-center gap-1">
                                    {labels[key]}
                                    {isSortable && sortConfig.key === key && (
                                      <TrendingUp size={12} className={cn("transition-transform", sortConfig.direction === 'desc' ? "rotate-180" : "")} />
                                    )}
                                  </div>
                                </th>
                              );
                            })}
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {contacts.length === 0 && !loading ? (
                            <tr>
                              <td colSpan={9} className="px-6 py-20 text-center">
                                <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                                  <div className="p-4 bg-slate-100 text-slate-400 rounded-full mb-4">
                                    <Search size={32} />
                                  </div>
                                  <h3 className="text-lg font-bold text-slate-900 mb-1">
                                    {debouncedSearchQuery || tagFilter ? "No matches found" : "No contacts yet"}
                                  </h3>
                                  <p className="text-slate-500 text-sm mb-6">
                                    {debouncedSearchQuery || tagFilter 
                                      ? `We couldn't find anyone matching your current filters. Try broadening your search.`
                                      : "Start building your network by adding your first contact record."}
                                  </p>
                                  <div className="flex gap-2">
                                    {(debouncedSearchQuery || tagFilter) && (
                                      <button 
                                        onClick={() => {
                                          setSearchQuery('');
                                          setTagFilter('');
                                        }}
                                        className="px-4 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-all shadow-sm"
                                      >
                                        Clear search
                                      </button>
                                    )}
                                    <button 
                                      onClick={() => setShowContactModal(true)}
                                      className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-all shadow-sm"
                                    >
                                      Create contact
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          ) : contacts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((contact) => (
                            <tr 
                              key={contact.id} 
                              className={cn(
                                "hover:bg-slate-50 transition-colors group cursor-pointer",
                                selectedContactId === contact.id && "bg-emerald-50"
                              )}
                              onClick={() => contact.id && setSelectedContactId(contact.id)}
                            >
                              <td className="px-6 py-4">
                                <div className="font-semibold text-sm">{contact.firstName}</div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="font-semibold text-sm">{contact.lastName}</div>
                              </td>
                              <td className="px-6 py-4 text-sm text-slate-600">
                                <div>{contact.email1}</div>
                                {contact.email2 && <div className="text-xs text-slate-400">{contact.email2}</div>}
                              </td>
                              <td className="px-6 py-4 text-sm text-slate-600">
                                <div>{contact.phone1 || '-'}</div>
                                {contact.phone2 && <div className="text-xs text-slate-400">{contact.phone2}</div>}
                              </td>
                              <td className="px-6 py-4 text-sm text-slate-600">
                                <div>{contact.companyName || '-'}</div>
                                <div className="text-xs text-slate-400 truncate max-w-[150px]">{contact.jobDescription}</div>
                              </td>
                              <td className="px-6 py-4 text-xs text-slate-500 italic max-w-[150px] truncate">
                                {contact.otherInfo || '-'}
                              </td>
                              <td className="px-6 py-4 text-sm text-slate-500 whitespace-nowrap">
                                {contact.createdAt?.toDate ? contact.createdAt.toDate().toLocaleDateString() : (contact.createdAt ? new Date(contact.createdAt).toLocaleDateString() : 'Unknown')}
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex flex-wrap gap-1">
                                  {contact.tag && contact.tag.split(',').map((t, idx) => (
                                    <span key={idx}>
                                      <Badge variant="info">
                                        <button 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setTagFilter(t.trim());
                                          }}
                                          className="hover:underline"
                                        >
                                          {t.trim()}
                                        </button>
                                      </Badge>
                                    </span>
                                  ))}
                                  {!contact.tag && <span className="text-slate-300">-</span>}
                                </div>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEditContact(contact);
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors"
                                    title="Edit Contact"
                                  >
                                    <Edit2 size={16} />
                                  </button>
                                  {profile?.role === 'admin' && (
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        contact.id && handleDeleteContact(contact.id);
                                      }}
                                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                                      title="Delete Contact"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>

                  {/* Pagination Controls */}
                  {(totalContactCount > itemsPerPage || contacts.length > itemsPerPage) && (
                    <div className="flex items-center justify-between px-2 py-4">
                      <div className="text-sm text-slate-500 font-medium">
                        Showing <span className="text-slate-900">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="text-slate-900">{Math.min(currentPage * itemsPerPage, totalContactCount || contacts.length)}</span> of <span className="text-slate-900">{(totalContactCount || contacts.length).toLocaleString()}</span> contacts
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          className="p-2 text-slate-500 hover:bg-white border border-slate-200 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                        >
                          <ChevronLeft size={18} />
                        </button>
                        
                        {/* Page Numbers - Limited view */}
                        <div className="flex items-center gap-1">
                          {Array.from({ length: Math.min(5, Math.ceil((totalContactCount || contacts.length) / itemsPerPage)) }, (_, i) => {
                            const pageNum = i + 1;
                            return (
                              <button
                                key={pageNum}
                                onClick={() => setCurrentPage(pageNum)}
                                className={cn(
                                  "w-9 h-9 flex items-center justify-center text-sm font-bold rounded-lg transition-all",
                                  currentPage === pageNum 
                                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-200" 
                                    : "text-slate-600 hover:bg-white border border-transparent hover:border-slate-200"
                                )}
                              >
                                {pageNum}
                              </button>
                            );
                          })}
                          {Math.ceil((totalContactCount || contacts.length) / itemsPerPage) > 5 && (
                            <span className="px-2 text-slate-400">...</span>
                          )}
                        </div>

                        <button 
                          onClick={() => setCurrentPage(p => Math.min(Math.ceil((totalContactCount || contacts.length) / itemsPerPage), p + 1))}
                          disabled={currentPage >= Math.ceil((totalContactCount || contacts.length) / itemsPerPage)}
                          className="p-2 text-slate-500 hover:bg-white border border-slate-200 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                        >
                          <ChevronRight size={18} />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === 'deals' && (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Deal Title</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Value</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Stage</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {deals.length > 0 ? deals.map((deal) => (
                      <tr key={deal.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-semibold">{deal.title}</td>
                        <td className="px-6 py-4 text-sm font-bold text-emerald-600">${deal.value.toLocaleString()}</td>
                        <td className="px-6 py-4">
                          <Badge variant={deal.stage === 'closed-won' ? 'success' : deal.stage === 'closed-lost' ? 'danger' : 'warning'}>
                            {deal.stage}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500">
                          {deal.createdAt?.toDate ? deal.createdAt.toDate().toLocaleDateString() : 'Just now'}
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">
                          No deals found. Click "New Deal" to add one.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {activeTab === 'tasks' && (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Task</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Priority</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Status</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {tasks.length > 0 ? tasks.map((task) => (
                      <tr key={task.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-semibold">{task.title}</td>
                        <td className="px-6 py-4">
                          <Badge variant={task.priority === 'high' ? 'danger' : task.priority === 'medium' ? 'warning' : 'info'}>
                            {task.priority}
                          </Badge>
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant={task.status === 'done' ? 'success' : 'default'}>{task.status}</Badge>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500">
                          {task.createdAt?.toDate ? task.createdAt.toDate().toLocaleDateString() : 'Just now'}
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">
                          No tasks found. Click "New Task" to add one.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      </main>

      {/* Contact Modal */}
      {showContactModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-xl font-bold">{editingContactId ? 'Edit Contact' : 'Add New Contact'}</h3>
              <button 
                onClick={() => {
                  setShowContactModal(false);
                  setEditingContactId(null);
                  setNewContact({
                    firstName: '',
                    lastName: '',
                    email1: '',
                    email2: '',
                    phone1: '',
                    phone2: '',
                    companyName: '',
                    jobDescription: '',
                    tag: '',
                    otherInfo: ''
                  });
                }} 
                className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[70vh]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">First Name *</label>
                  <input 
                    type="text" 
                    value={newContact.firstName}
                    onChange={(e) => setNewContact({...newContact, firstName: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-emerald-500 outline-none transition-all"
                    placeholder="John"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Last Name *</label>
                  <input 
                    type="text" 
                    value={newContact.lastName}
                    onChange={(e) => setNewContact({...newContact, lastName: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-emerald-500 outline-none transition-all"
                    placeholder="Doe"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Email 1 *</label>
                  <input 
                    type="email" 
                    value={newContact.email1}
                    onChange={(e) => setNewContact({...newContact, email1: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-emerald-500 outline-none transition-all"
                    placeholder="john@example.com"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Email 2</label>
                  <input 
                    type="email" 
                    value={newContact.email2}
                    onChange={(e) => setNewContact({...newContact, email2: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-emerald-500 outline-none transition-all"
                    placeholder="secondary@example.com"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Phone 1</label>
                  <input 
                    type="tel" 
                    value={newContact.phone1}
                    onChange={(e) => setNewContact({...newContact, phone1: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-emerald-500 outline-none transition-all"
                    placeholder="+1 (555) 000-0000"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Phone 2</label>
                  <input 
                    type="tel" 
                    value={newContact.phone2}
                    onChange={(e) => setNewContact({...newContact, phone2: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-emerald-500 outline-none transition-all"
                    placeholder="+1 (555) 111-1111"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Company Name</label>
                  <input 
                    type="text" 
                    value={newContact.companyName}
                    onChange={(e) => setNewContact({...newContact, companyName: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-emerald-500 outline-none transition-all"
                    placeholder="Acme Corp"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <label className="text-xs font-bold text-slate-500 uppercase">Tags</label>
                    <span className="text-[10px] text-slate-400">Comma-separated</span>
                  </div>
                  <input 
                    type="text" 
                    value={newContact.tag}
                    onChange={(e) => setNewContact({...newContact, tag: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-emerald-500 outline-none transition-all"
                    placeholder="VIP, Partner, Lead"
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Other Info / Notes</label>
                  <textarea 
                    value={newContact.otherInfo}
                    onChange={(e) => setNewContact({...newContact, otherInfo: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-emerald-500 outline-none transition-all min-h-[60px]"
                    placeholder="Any additional details..."
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Job Description</label>
                  <textarea 
                    value={newContact.jobDescription}
                    onChange={(e) => setNewContact({...newContact, jobDescription: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-emerald-500 outline-none transition-all min-h-[100px]"
                    placeholder="Describe their role or responsibilities..."
                  />
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 flex items-center justify-end gap-3">
              <button 
                onClick={() => {
                  setShowContactModal(false);
                  setEditingContactId(null);
                  setNewContact({
                    firstName: '',
                    lastName: '',
                    email1: '',
                    email2: '',
                    phone1: '',
                    phone2: '',
                    companyName: '',
                    jobDescription: '',
                    tag: '',
                    otherInfo: ''
                  });
                }}
                className="px-6 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 rounded-lg transition-all"
              >
                Cancel
              </button>
              <button 
                disabled={saving}
                onClick={async () => {
                  if (!newContact.firstName || !newContact.lastName || !newContact.email1) {
                    alert("Please fill in all required fields (First Name, Last Name, Email 1)");
                    return;
                  }
                  setSaving(true);
                  try {
                    const endpoint = editingContactId ? `/api/contacts/${editingContactId}` : '/api/contacts';
                    const method = editingContactId ? 'PUT' : 'POST';
                    
                    const response = await fetch(endpoint, {
                      method,
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(newContact)
                    });
                    
                    if (!response.ok) throw new Error('Failed to save contact');
                    
                    setShowContactModal(false);
                    setEditingContactId(null);
                    setNewContact({
                      firstName: '',
                      lastName: '',
                      email1: '',
                      email2: '',
                      phone1: '',
                      phone2: '',
                      companyName: '',
                      jobDescription: '',
                      tag: '',
                      otherInfo: ''
                    });
                    refreshData();
                  } catch (error) {
                    console.error('Save failed:', error);
                    alert('Failed to save contact locally.');
                  } finally {
                    setSaving(false);
                  }
                }}
                className="px-6 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 disabled:cursor-not-allowed rounded-lg transition-all shadow-lg shadow-emerald-100 flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {editingContactId ? 'Updating...' : 'Saving...'}
                  </>
                ) : (
                  editingContactId ? 'Update Contact' : 'Save Contact'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      <AIAssistant />
    </div>
  );
}
