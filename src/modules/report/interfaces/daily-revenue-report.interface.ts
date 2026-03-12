export interface DailyRevenueReport {
    date:                  string;
    totalAppointments:     number;
    completedAppointments: number;
    totalNoShows:          number;
    totalCancellations:    number;
    totalRevenue:          number;
    pendingRevenue:        number;
    mostBookedService:     string | null;
    topStylist: {
        name:             string;
        appointmentCount: number;
        revenue:          number;
    } | null;
}
