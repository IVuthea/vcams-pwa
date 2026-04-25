import type { FileModel } from './file';

export type { FileModel };

export interface ProjectModel {
  id: number | string;
  sort_name?: string;
  code?: string;
  start_date?: string;
  end_date?: string;
  full_name?: string;
  main_constructor?: string;
  profile?: FileModel;
  visibility?: string;
  visibility_label?: string;
}
