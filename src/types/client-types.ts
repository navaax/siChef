// src/types/client-types.ts

export interface Client {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  created_at: string; // ISO Date string
  updated_at: string; // ISO Date string
}
