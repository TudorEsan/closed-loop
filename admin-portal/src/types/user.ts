export type UserRole = 'super_admin' | 'admin' | 'operator' | 'vendor' | 'attendee';

export type User = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  phone?: string;
  isActive: boolean;
  image?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UserQuery = {
  role?: UserRole;
  search?: string;
  limit?: number;
  cursor?: string;
};

export type PaginatedUsers = {
  users: User[];
  nextCursor: string | null;
};
