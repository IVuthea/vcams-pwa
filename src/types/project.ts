import type { FileModel } from './file';

export type { FileModel };

export interface ProjectModel {
  id: number | string;
  main_constructor?: string;
  full_name?: string;
  sort_name?: string;
  code?: string;
  area?: string;
  address?: string;
  start_date?: string;
  end_date?: string;
  description?: string;
  visibility?: string;
  visibility_label?: string;
  created_at?: string;
  updated_at?: string;
  profile_img_id?: number | null;
  photo?: string;
  profile?: FileModel;
}
