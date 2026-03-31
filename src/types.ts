export type Unit = 'KDC' | 'Udhana' | 'VAU' | 'DPU/DPN' | 'EMB' | 'TLU' | 'All';
export type Role = 'Unit Head' | 'Master';

export interface UserProfile {
  id: string;
  first_name: string;
  last_name: string;
  unit: Unit;
  email: string;
  role: Role;
  created_at?: string;
}

export interface CatalogueEntry {
  id: string;
  unit: Unit;
  design_no: string;
  content: string;
  gsm: string;
  color: string;
  application: string;
  image_url?: string;
  img_creation_checked?: boolean;
  timestamp?: string;
  checked_by_name?: string;
  additional_images?: string[];
  upload_link?: string;
  author_id: string;
  created_at: string;
}

export const UNITS: Unit[] = ['KDC', 'Udhana', 'VAU', 'DPU/DPN', 'EMB','TLU',];
export const ROLES: Role[] = ['Unit Head', 'Master'];
export const APPLICATIONS = [
  'Shirt', 'Pant', 'Dress Top', 'Bra', 'Underwear', 'Jacket', 
  'Track Pant', 'Cord-Set', 'Shorts', 'Jogger', 'Polo T-shirt', 'Round neck T-shirt'
];
