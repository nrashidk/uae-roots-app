export interface User {
  id: string;
  email: string | null;
  displayName: string | null;
  phoneNumber: string | null;
  provider: 'google.com' | 'microsoft.com' | 'phone' | 'email' | 'password' | 'unknown';
  createdAt: Date;
  lastLoginAt: Date;
}

export interface Tree {
  id: number;
  name: string;
  description: string | null;
  createdBy: string;
  createdAt: Date;
}

export interface Person {
  id: number;
  treeId: number;
  firstName: string;
  lastName: string | null;
  gender: 'male' | 'female';
  birthDate: string | null;
  deathDate: string | null;
  isLiving: boolean;
  isBreastfed: boolean;
  phone: string | null;
  email: string | null;
  identificationNumber: string | null;
  birthOrder: number | null;
  photoUrl: string | null;
  createdAt: Date;
}

export interface Relationship {
  id: number;
  treeId: number;
  type: 'partner' | 'parent-child' | 'sibling';
  person1Id: number | null;
  person2Id: number | null;
  childId: number | null;
  parentId: number | null;
  isBreastfeeding: boolean;
  isDotted: boolean;
  createdAt: Date;
}

export interface AuditLog {
  id: number;
  userId: string;
  action: 'login' | 'logout' | 'create' | 'update' | 'delete' | 'export' | 'upload' | 'undo';
  resourceType: 'user' | 'tree' | 'person' | 'relationship' | 'auth' | 'photo';
  resourceId: string | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export interface EditHistory {
  id: number;
  userId: string;
  treeId: number;
  action: 'create' | 'update' | 'delete';
  resourceType: 'person' | 'relationship';
  resourceId: number;
  previousData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  createdAt: Date;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export type ExportFormat = 'json' | 'gedcom' | 'csv' | 'html' | 'text';
