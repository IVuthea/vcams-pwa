import type { FileModel } from './file';

export interface RoleModel {
  id?: number | string;
  name?: string;
  code?: string;
}

export interface EmployeeModel {
  id: number | string;
  name?: string;
  phone?: string;
  code?: string;
  wage_type?: string;
  working_status?: string;
  nfc?: string;
  role?: RoleModel;
  profile?: FileModel;
}
