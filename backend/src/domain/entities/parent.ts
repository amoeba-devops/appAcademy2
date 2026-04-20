/**
 * Parent Domain Entity
 */
export class Parent {
  id: number;
  academyId: number;
  name: string;
  phone: string | null;
  email: string | null;
  preferredChannel: string | null;
  createdAt: Date;
  updatedAt: Date;
}
