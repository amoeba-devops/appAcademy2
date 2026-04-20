export interface Student {
  id: number;
  primaryParentId: number;
  name: string;
  birthDate: string | null;
  gender: string | null;
  school: string | null;
  grade: string | null;
  status: string;
  lifecycleStatus: string;
  parentName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStudentRequest {
  primaryParentId: number;
  name: string;
  birthDate?: string;
  gender?: string;
  school?: string;
  grade?: string;
}

export interface UpdateStudentRequest {
  name?: string;
  birthDate?: string;
  gender?: string;
  school?: string;
  grade?: string;
  status?: string;
  lifecycleStatus?: string;
}

export interface Parent {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  preferredChannel: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateParentRequest {
  name: string;
  phone?: string;
  email?: string;
  preferredChannel?: string;
}

export interface UpdateParentRequest {
  name?: string;
  phone?: string;
  email?: string;
  preferredChannel?: string;
}
