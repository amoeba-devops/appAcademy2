export interface Bill {
  id: string;
  studentId: string;
  studentName: string;
  grade: string | null;
  school: string | null;
  studentStatus: string;
  site: string | null;
  classId: string | null;
  className: string | null;
  month: string;
  due: string;
  kind: string;
  title: string;
  amount: number;
  discount: number;
  adjustment: number;
  net: number;
  paid: number;
  refunded: number;
  received: number;
  unpaid: number;
  state: string;
  status: string;
  version: number;
  memo: string;
  methods: string[];
  paidDate: string | null;
  periodReceived: number;
}
export interface BillInput {
  studentId: string;
  classId?: string;
  month: string;
  due: string;
  kind: string;
  title: string;
  amount: number;
  discount: number;
  memo?: string;
}
export interface Edit {
  id: string;
  version: number;
  amount: number;
  discount: number;
  due: string;
  title: string;
  memo: string;
}
export interface Option {
  id: string;
  name: string;
  status?: string;
  site?: string;
}
export interface Options {
  students: Option[];
  hasMore: boolean;
  classes: Option[];
  teachers: Option[];
}
export interface Page {
  items: Bill[];
  summary: Record<string, number>;
  page: number;
  today: string;
}
export interface Preview {
  items: (BillInput & {
    studentName: string;
    existingId: string | null;
    reason: string | null;
  })[];
  eligible: number;
}
export interface Detail {
  bill: Bill;
  collections: {
    id: string;
    type: string;
    amount: number;
    date: string;
    method: string;
    reason: string;
    actor: string;
    remaining: number;
  }[];
  audit: {
    id: string;
    action: string;
    reason: string;
    actor: string;
    createdAt: string;
    before: unknown;
    after: unknown;
  }[];
  consultation: {
    id: string;
    tuition: string | null;
    paid: string | null;
    date: string | null;
    approved: boolean | null;
  }[];
}
