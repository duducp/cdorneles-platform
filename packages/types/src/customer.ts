export interface Customer {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  phone?: string | null;
  document?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}
