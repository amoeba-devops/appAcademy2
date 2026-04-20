import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export interface DashboardKpi {
  students: { total: number; delta: number };
  revenue: { monthTotal: number; delta: number };
  consultations: { newCount: number; conversionRate: number };
  todayClasses: number;
}

@Injectable()
export class GetDashboardKpiUseCase {
  constructor(
    @InjectDataSource()
    private readonly ds: DataSource,
  ) {}

  async execute(academyId: number): Promise<DashboardKpi> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .slice(0, 10);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      .toISOString()
      .slice(0, 10);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
      .toISOString()
      .slice(0, 10);
    const today = now.toISOString().slice(0, 10);

    // Active students this month
    const [{ cnt: studentCount }] = await this.ds.query(
      `SELECT COUNT(DISTINCT std_id) as cnt FROM tac_students WHERE acd_id = ? AND std_status = 'ACTIVE'`,
      [academyId],
    );

    // Previous month active count (approximate via enrollment)
    const [{ cnt: prevStudentCount }] = await this.ds.query(
      `SELECT COUNT(DISTINCT std_id) as cnt FROM tac_enrollments WHERE acd_id = ? AND enr_status = 'ACTIVE' AND enr_applied_at < ?`,
      [academyId, monthStart],
    );

    // Revenue this month
    const [{ total: monthRevenue }] = await this.ds.query(
      `SELECT COALESCE(SUM(pod_amount), 0) as total FROM tac_pay_orders WHERE acd_id = ? AND pod_status = 'DONE' AND pod_approved_at >= ?`,
      [academyId, monthStart],
    );

    // Revenue previous month
    const [{ total: prevRevenue }] = await this.ds.query(
      `SELECT COALESCE(SUM(pod_amount), 0) as total FROM tac_pay_orders WHERE acd_id = ? AND pod_status = 'DONE' AND pod_approved_at >= ? AND pod_approved_at <= ?`,
      [academyId, prevMonthStart, prevMonthEnd],
    );

    // New consultations this month
    const [{ cnt: newConsultations }] = await this.ds.query(
      `SELECT COUNT(*) as cnt FROM tac_consultations WHERE acd_id = ? AND cst_created_at >= ?`,
      [academyId, monthStart],
    );

    // Converted consultations this month
    const [{ cnt: converted }] = await this.ds.query(
      `SELECT COUNT(*) as cnt FROM tac_consultations WHERE acd_id = ? AND cst_status = 'CONVERTED' AND cst_created_at >= ?`,
      [academyId, monthStart],
    );

    // Today's class sessions
    const [{ cnt: todayClasses }] = await this.ds.query(
      `SELECT COUNT(*) as cnt FROM tac_class_sessions csn INNER JOIN tac_classes cls ON cls.cls_id = csn.cls_id WHERE cls.acd_id = ? AND DATE(csn.csn_start_at) = ?`,
      [academyId, today],
    );

    const totalStudents = Number(studentCount) || 0;
    const prevStudents = Number(prevStudentCount) || 0;
    const totalRevenue = Number(monthRevenue) || 0;
    const prevRev = Number(prevRevenue) || 0;
    const newCons = Number(newConsultations) || 0;
    const conv = Number(converted) || 0;

    return {
      students: {
        total: totalStudents,
        delta: totalStudents - prevStudents,
      },
      revenue: {
        monthTotal: totalRevenue,
        delta: totalRevenue - prevRev,
      },
      consultations: {
        newCount: newCons,
        conversionRate: newCons > 0 ? Math.round((conv / newCons) * 1000) / 10 : 0,
      },
      todayClasses: Number(todayClasses) || 0,
    };
  }
}
