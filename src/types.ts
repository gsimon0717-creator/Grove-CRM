export type UserRole = 'admin' | 'agent' | 'user';

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  role: UserRole;
  createdAt?: any;
}

export interface Lead {
  id?: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  status: 'new' | 'contacted' | 'qualified' | 'lost';
  source?: string;
  assignedTo?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface Contact {
  id?: string;
  firstName: string;
  lastName: string;
  email1: string;
  email2?: string;
  phone1?: string;
  phone2?: string;
  companyName?: string;
  jobDescription?: string;
  tag?: string;
  otherInfo?: string;
  createdAt?: any;
}

export interface Deal {
  id?: string;
  title: string;
  value: number;
  stage: 'discovery' | 'proposal' | 'negotiation' | 'closed-won' | 'closed-lost';
  contactId?: string;
  expectedCloseDate?: any;
  assignedTo?: string;
  createdAt?: any;
}

export interface Task {
  id?: string;
  title: string;
  description?: string;
  dueDate?: any;
  status: 'todo' | 'in-progress' | 'done';
  priority: 'low' | 'medium' | 'high';
  assignedTo?: string;
  relatedTo?: string;
  createdAt?: any;
}
