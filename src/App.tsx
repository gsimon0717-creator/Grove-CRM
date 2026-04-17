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
import firebaseConfig from '../firebase-applet-config.json';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  doc, 
  serverTimestamp, 
  getDoc,
  getDocFromServer,
  getCountFromServer,
  setDoc,
  orderBy,
  limit,
  writeBatch
} from 'firebase/firestore';
import Papa from 'papaparse';
import { auth, db } from './firebase';
import { Lead, Contact, Deal, Task, UserProfile } from './types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Utility ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Error Handling ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  // Display a user-friendly alert for issues
  if (errInfo.error.includes('insufficient permissions')) {
    alert("Permission Denied: You don't have the required role to perform this action. If you just signed in, please refresh or wait for your admin role to be assigned.");
  } else {
    alert(`Error: ${errInfo.error}`);
  }
  throw new Error(JSON.stringify(errInfo));
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
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [totalContactCount, setTotalContactCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
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

  useEffect(() => {
    console.log('Profile updated:', profile);
  }, [profile]);

  // Auth Listener
  useEffect(() => {
    // Test Connection
    const testConnection = async () => {
      try {
        console.log("Testing Firestore connection...");
        await getDocFromServer(doc(db, 'test', 'connection'));
        console.log("Firestore connection successful.");
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. The client appears to be offline.");
          alert("Connection Error: The application is unable to connect to Firestore. Please check your internet connection or Firebase configuration.");
        } else {
          console.log("Firestore connection test completed (ignoring non-connection errors).");
        }
      }
    };
    testConnection();

    // Safety timeout for loading state
    const loadingTimeout = setTimeout(() => {
      setLoading(current => {
        if (current) {
          console.warn('Loading state timed out. Forcing loading to false. This may indicate a Firebase initialization issue.');
          return false;
        }
        return false;
      });
    }, 10000); // 10 seconds

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      console.log('Auth state changed:', u?.uid);
      clearTimeout(loadingTimeout);
      setUser(u);
      
      try {
        if (u) {
          console.log('Fetching user profile for:', u.uid);
          const userDoc = await getDoc(doc(db, 'users', u.uid));
          if (userDoc.exists()) {
            console.log('Profile found:', userDoc.data());
            setProfile(userDoc.data() as UserProfile);
          } else {
            console.log('No profile found, creating one...');
            const newProfile: UserProfile = {
              uid: u.uid,
              email: u.email!,
              displayName: u.displayName || '',
              role: u.email === 'gsimon0717@gmail.com' ? 'admin' : 'user',
              createdAt: serverTimestamp()
            };
            await setDoc(doc(db, 'users', u.uid), newProfile);
            setProfile(newProfile);
          }
        } else {
          setProfile(null);
        }
      } catch (error) {
        console.error('Profile fetch/create failed:', error);
        // We don't throw here to avoid skipping setLoading(false)
        try {
          handleFirestoreError(error, OperationType.GET, u ? `users/${u.uid}` : 'users/null');
        } catch (e) {
          // Ignore the throw from handleFirestoreError to continue logic
        }
      } finally {
        setLoading(false);
        console.log('Loading state set to false');
      }
    });
    return () => unsubscribe();
  }, []);

  // Data Listeners
  useEffect(() => {
    if (!user) return;

    const qLeads = query(collection(db, 'leads'), limit(100));
    const unsubLeads = onSnapshot(qLeads, (snapshot) => {
      setLeads(snapshot.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          name: data.name || '',
          email: data.email || '',
          phone: data.phone || '',
          company: data.company || data.company_name || '',
          status: data.status || 'new',
          source: data.source || '',
          assignedTo: data.assignedTo || '',
          createdAt: data.createdAt || data.created_at || null,
          updatedAt: data.updatedAt || data.updated_at || null
        } as Lead;
      }));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'leads'));

    const qDeals = query(collection(db, 'deals'), limit(100));
    const unsubDeals = onSnapshot(qDeals, (snapshot) => {
      setDeals(snapshot.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          title: data.title || '',
          value: data.value || 0,
          stage: data.stage || 'discovery',
          contactId: data.contactId || '',
          expectedCloseDate: data.expectedCloseDate || null,
          assignedTo: data.assignedTo || '',
          createdAt: data.createdAt || data.created_at || null
        } as Deal;
      }));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'deals'));

    const qTasks = query(collection(db, 'tasks'), limit(100));
    const unsubTasks = onSnapshot(qTasks, (snapshot) => {
      setTasks(snapshot.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          title: data.title || '',
          description: data.description || '',
          dueDate: data.dueDate || data.due_date || null,
          status: data.status || 'todo',
          priority: data.priority || 'medium',
          assignedTo: data.assignedTo || '',
          relatedTo: data.relatedTo || '',
          createdAt: data.createdAt || data.created_at || null
        } as Task;
      }));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'tasks'));

    const fetchContacts = async () => {
      const collectionsToTry = ['contacts', 'Contacts', 'people'];
      const unsubscribes: (() => void)[] = [];

      // Fetch accurate total count across all collections
      for (const collName of collectionsToTry) {
        getCountFromServer(collection(db, collName)).then(snap => {
          const count = snap.data().count;
          if (count > 0) {
            setTotalContactCount(prev => prev + count);
          }
        }).catch(err => console.warn(`Count failed for ${collName}:`, err));
      }

      collectionsToTry.forEach(collName => {
        const q = query(collection(db, collName), limit(1000)); // Increased limit to 1000 for better view depth
        const unsub = onSnapshot(q, (snapshot) => {
          if (snapshot.empty) return;
          console.log(`Found data in collection [${collName}]:`, snapshot.docs.length, 'docs');
          
          setContacts(prev => {
            const newContacts = snapshot.docs.map(d => {
              const data = d.data();
              return {
                id: d.id,
                firstName: data.firstName || data.first_name || data.First_Name || data.name || '',
                lastName: data.lastName || data.last_name || data.Last_Name || '',
                email1: data.email1 || data.email || data.Email || '',
                email2: data.email2 || '',
                phone1: data.phone1 || data.phone || data.Phone || '',
                phone2: data.phone2 || '',
                companyName: data.companyName || data.company_name || data.Business_Name || '',
                jobDescription: data.jobDescription || '',
                tag: data.tag || (data.tags ? (Array.isArray(data.tags) ? data.tags.join(', ') : data.tags) : ''),
                otherInfo: data.otherInfo || data.Notes || data.comments || '',
                createdAt: data.createdAt || data.created_at || null
              } as Contact;
            });

            // Merge by ID to avoid duplicates if same data exists in multiple spots or on updates
            const map = new Map(prev.map(c => [c.id, c]));
            newContacts.forEach(c => map.set(c.id, c));
            return Array.from(map.values());
          });
        }, (error) => {
          console.warn(`Snapshot failed for [${collName}]:`, error.message);
        });
        unsubscribes.push(unsub);
      });

      return () => unsubscribes.forEach(u => u());
    };

    const contactsUnsubscribePromise = fetchContacts();
    
    return () => {
      unsubLeads();
      unsubDeals();
      unsubTasks();
      contactsUnsubscribePromise.then(u => u());
    };
  }, [user]);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      // Force select account to ensure the popup stays open for interaction
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error("Login failed", error);
      if (error.code === 'auth/unauthorized-domain') {
        alert(`Login failed: This domain (${window.location.hostname}) is not authorized in your Firebase project.\n\nPlease add it to the "Authorized domains" list in the Firebase Console (Authentication > Settings > Authorized domains).`);
      } else if (error.code === 'auth/popup-blocked') {
        alert("Login failed: The popup was blocked by your browser. Please allow popups for this site and try again.");
      } else {
        alert(`Login failed: ${error.message}\nCode: ${error.code}`);
      }
    }
  };

  const handleLogout = () => signOut(auth);

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
      await deleteDoc(doc(db, 'contacts', id));
      console.log('Contact deleted successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `contacts/${id}`);
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
        const batch = writeBatch(db);
        let count = 0;
        const errors: string[] = [];

        for (const row of results.data as any[]) {
          // Map CSV headers to contact fields
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
            otherInfo: row.otherInfo || row.OtherInfo || row.Notes || '',
            createdAt: serverTimestamp()
          };

          // Basic validation
          if (!contactData.firstName || !contactData.lastName || !contactData.email1) {
            errors.push(`Row ${count + 1}: Missing required fields (First Name, Last Name, Email)`);
            continue;
          }

          const newDocRef = doc(collection(db, 'contacts'));
          batch.set(newDocRef, contactData);
          count++;

          // Firestore batch limit is 500
          if (count % 500 === 0) {
            try {
              await batch.commit();
            } catch (e) {
              console.error('Batch commit error:', e);
            }
          }
        }

        try {
          await batch.commit();
          alert(`Successfully uploaded ${count} contacts!`);
          if (errors.length > 0) {
            console.warn('Upload errors:', errors);
            alert(`Some rows were skipped:\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? '\n...' : ''}`);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, 'contacts/bulk');
        } finally {
          setUploading(false);
          // Clear input
          event.target.value = '';
        }
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
            <code className="block p-3 bg-slate-50 rounded-lg text-xs text-slate-600 text-left overflow-x-auto">
              GET /api/v1/leads
            </code>
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

            {/* Database Status Indicator */}
            <div className="mt-4 px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="flex items-center gap-2 mb-1.5">
                <Database size={12} className="text-slate-400" />
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Storage Engine</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-slate-700 truncate max-w-[120px]">
                  {firebaseConfig.firestoreDatabaseId || '(default)'}
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
                placeholder="Search anything..." 
                className="pl-10 pr-4 py-2 text-sm bg-slate-100 border-transparent focus:bg-white focus:border-emerald-500 rounded-lg transition-all outline-none w-64"
              />
            </div>
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
                  if (type === 'leads') {
                    await addDoc(collection(db, 'leads'), {
                      name: 'Quick Lead',
                      company: 'New Prospect',
                      status: 'new',
                      createdAt: serverTimestamp()
                    });
                  } else if (type === 'deals') {
                    await addDoc(collection(db, 'deals'), {
                      title: 'New Opportunity',
                      value: 5000,
                      stage: 'discovery',
                      createdAt: serverTimestamp()
                    });
                  } else if (type === 'tasks') {
                    await addDoc(collection(db, 'tasks'), {
                      title: 'New Task',
                      status: 'todo',
                      priority: 'medium',
                      createdAt: serverTimestamp()
                    });
                  }
                } catch (error) {
                  handleFirestoreError(error, OperationType.CREATE, type);
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
              <Card>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">First Name</th>
                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Last Name</th>
                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Emails</th>
                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Phones</th>
                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Company</th>
                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Other Info</th>
                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Tag</th>
                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {contacts.length > 0 ? contacts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((contact) => (
                        <tr key={contact.id} className="hover:bg-slate-50 transition-colors group">
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
                          <td className="px-6 py-4">
                            {contact.tag && <Badge variant="info">{contact.tag}</Badge>}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => handleEditContact(contact)}
                                className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors"
                                title="Edit Contact"
                              >
                                <Edit2 size={16} />
                              </button>
                              {profile?.role === 'admin' && (
                                <button 
                                  onClick={() => contact.id && handleDeleteContact(contact.id)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                                  title="Delete Contact"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">
                            No contacts found. Click "New Contact" to add one.
                          </td>
                        </tr>
                      )}
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
                  <label className="text-xs font-bold text-slate-500 uppercase">Tag</label>
                  <input 
                    type="text" 
                    value={newContact.tag}
                    onChange={(e) => setNewContact({...newContact, tag: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-emerald-500 outline-none transition-all"
                    placeholder="VIP, Partner, etc."
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
                    // Filter out empty strings for optional fields
                    const contactToSave = Object.fromEntries(
                      Object.entries(newContact).filter(([_, v]) => v !== '' && v !== null && v !== undefined)
                    );
                    
                    console.log('Attempting to save contact:', contactToSave);
                    
                    if (editingContactId) {
                      await updateDoc(doc(db, 'contacts', editingContactId), {
                        ...contactToSave,
                        updatedAt: serverTimestamp()
                      });
                      console.log('Contact updated successfully');
                    } else {
                      await addDoc(collection(db, 'contacts'), {
                        ...contactToSave,
                        createdAt: serverTimestamp()
                      });
                      console.log('Contact saved successfully');
                    }
                    
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
                  } catch (error) {
                    handleFirestoreError(error, editingContactId ? OperationType.UPDATE : OperationType.CREATE, 'contacts');
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
    </div>
  );
}
