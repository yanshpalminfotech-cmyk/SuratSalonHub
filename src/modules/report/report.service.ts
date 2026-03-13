import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { DailyRevenueReport } from './interfaces/daily-revenue-report.interface';

@Injectable()
export class ReportService {
  private readonly logger = new Logger(ReportService.name);

  constructor(private readonly dataSource: DataSource) { }

  private formatDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  @Cron('30 11 * * *')
  async generateDailyRevenueReport(): Promise<void> {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const start = this.formatDate(today);
    const end = this.formatDate(tomorrow);

    const QUERY_1 = `
      SELECT
        COUNT(a.id) AS totalAppointments,
        COUNT(CASE WHEN a.status = 'Completed' THEN 1 END) AS completedAppointments,
        COUNT(CASE WHEN a.status = 'No-Show'   THEN 1 END) AS totalNoShows,
        COUNT(CASE WHEN a.status = 'Cancelled' THEN 1 END) AS totalCancellations,
        COALESCE(SUM(CASE WHEN p.payment_status = 'Paid'    THEN p.amount ELSE 0 END), 0) AS totalRevenue,
        COALESCE(SUM(CASE WHEN p.payment_status = 'Pending' THEN p.amount ELSE 0 END), 0) AS pendingRevenue
      FROM appointments a
      LEFT JOIN payments p ON p.appointment_id = a.id
      WHERE a.date >= ? AND a.date < ?
    `;

    const QUERY_2 = `
      SELECT
        as_.service_name AS serviceName,
        COUNT(*)         AS bookingCount
      FROM appointment_services as_
      INNER JOIN appointments a ON a.id = as_.appointment_id
      WHERE a.date >= ? AND a.date < ?
        AND a.status = 'Completed'
      GROUP BY as_.service_name
      ORDER BY bookingCount DESC, as_.service_name ASC
      LIMIT 1
    `;

    const QUERY_3 = `
      SELECT
        u.name     AS stylistName,
        COUNT(a.id) AS appointmentCount,
        COALESCE(SUM(p.amount), 0) AS revenue
      FROM appointments a
      INNER JOIN stylists st ON st.id = a.stylist_id
      INNER JOIN users    u  ON u.id  = st.user_id
      LEFT  JOIN payments p  ON p.appointment_id = a.id
                            AND p.payment_status = 'Paid'
      WHERE a.date >= ? AND a.date < ?
        AND a.status = 'Completed'
      GROUP BY st.id, u.name
      ORDER BY revenue DESC
      LIMIT 1
    `;

    try {
      const [s, svc, st] = await Promise.allSettled([
        this.dataSource.query(QUERY_1, [start, end]),
        this.dataSource.query(QUERY_2, [start, end]),
        this.dataSource.query(QUERY_3, [start, end]),
      ]);

      const summary = s.status === 'fulfilled' && s.value.length ? s.value[0] : null;
      const service = svc.status === 'fulfilled' && svc.value.length ? svc.value[0] : null;
      const stylist = st.status === 'fulfilled' && st.value.length ? st.value[0] : null;

      const report: DailyRevenueReport = {
        date: start,
        totalAppointments: Number(summary?.totalAppointments ?? 0),
        completedAppointments: Number(summary?.completedAppointments ?? 0),
        totalNoShows: Number(summary?.totalNoShows ?? 0),
        totalCancellations: Number(summary?.totalCancellations ?? 0),
        totalRevenue: Number(summary?.totalRevenue ?? 0),
        pendingRevenue: Number(summary?.pendingRevenue ?? 0),
        mostBookedService: service?.serviceName ?? null,
        topStylist: stylist
          ? {
            name: stylist.stylistName,
            appointmentCount: Number(stylist.appointmentCount),
            revenue: Number(stylist.revenue),
          }
          : null,
      };

      this.logger.log('─────────────────────────────────────────');
      this.logger.log(`DAILY REVENUE REPORT — ${report.date}`);
      this.logger.log(`Total Appointments  : ${report.totalAppointments}`);
      this.logger.log(`Completed           : ${report.completedAppointments}`);
      this.logger.log(`No-Shows            : ${report.totalNoShows}`);
      this.logger.log(`Cancellations       : ${report.totalCancellations}`);
      this.logger.log(`Total Revenue       : ₹${report.totalRevenue}`);
      this.logger.log(`Pending Revenue     : ₹${report.pendingRevenue}`);
      this.logger.log(`Most Booked Service : ${report.mostBookedService ?? 'N/A'}`);
      this.logger.log(`Top Stylist         : ${report.topStylist?.name ?? 'N/A'} (₹${report.topStylist?.revenue ?? 0})`);
      this.logger.log('─────────────────────────────────────────');
    } catch (err) {
      this.logger.error(`Daily revenue report failed for ${start}`, err);
    }
  }
}
