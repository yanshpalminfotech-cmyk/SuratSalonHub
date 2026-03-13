-- Report 1 — Daily Business Summary
-- For a selected date, show:
-- Total appointments completed
-- Total revenue collected
-- Total no-shows and cancellations
-- Most booked service on that day
-- Peak hours (busiest time slots by appointment count)

WITH
base AS (
    SELECT
        a.id,
        a.appointment_status,
        a.start_time,
        p.amount,
        p.payment_status
    FROM appointments a
    LEFT JOIN payments p ON p.appointment_id = a.id
    WHERE a.date   = '2026-03-13'
      AND a.status = 1
),
summary AS (
    SELECT
        COUNT(CASE WHEN appointment_status = 'Completed' THEN 1 END)                 AS total_completed,
        COALESCE(SUM(CASE WHEN payment_status = 'Paid' THEN amount END), 0)          AS total_revenue,
        COUNT(CASE WHEN appointment_status = 'No-Show'   THEN 1 END)                 AS total_no_shows,
        COUNT(CASE WHEN appointment_status = 'Cancelled' THEN 1 END)                 AS total_cancellations
    FROM base
),
top_service AS (
    SELECT   aps.service_name
    FROM     appointment_services aps
    INNER JOIN appointments a ON a.id = aps.appointment_id
    WHERE    a.date   = '2026-03-13'
      AND    a.status = 1
    GROUP BY aps.service_name
    ORDER BY COUNT(*) DESC
    LIMIT 1
),
peak AS (
    SELECT   TIME_FORMAT(ANY_VALUE(start_time), '%h:00 %p') AS peak_hour
    FROM     base
    WHERE    appointment_status != 'Cancelled'
    GROUP BY HOUR(start_time)
    ORDER BY COUNT(*) DESC
    LIMIT 1
)
SELECT
    s.total_completed,
    s.total_revenue,
    s.total_no_shows,
    s.total_cancellations,
    ts.service_name   AS most_booked_service,
    p.peak_hour
FROM       summary     s
CROSS JOIN top_service ts
CROSS JOIN peak        p; 

CREATE INDEX idx_appointments_date_status 
ON appointments(date, status);





-- Report 2 — Service Performance Report
-- Show all services with:
-- Service name and category
-- Total bookings this month
-- Total revenue generated
-- Average duration used
-- Popularity rank — use a window function (RANK() or ROW_NUMBER()) ordered by total bookings
-- Sorted by highest revenue first

WITH monthly_stats AS (
    SELECT
        s.id                                AS service_id,
        s.name                              AS service_name,
        sc.name                             AS category_name,
        COUNT(aps.id)                       AS total_bookings,
        COALESCE(SUM(aps.price), 0)         AS total_revenue,
        COALESCE(AVG(aps.duration_mins), 0) AS avg_duration
    FROM services s
    INNER JOIN service_categories sc ON sc.id = s.category_id
    LEFT  JOIN appointment_services aps ON aps.service_id = s.id
    LEFT  JOIN appointments a
           ON a.id                 = aps.appointment_id
          AND a.status             = 1
          AND a.appointment_status = 'Completed'
          AND a.date >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
          AND a.date <  DATE_FORMAT(CURDATE() + INTERVAL 1 MONTH, '%Y-%m-01')
    WHERE s.status != 127
    GROUP BY s.id, s.name, sc.name
)
SELECT
    service_id                             AS serviceId,
    service_name                           AS serviceName,
    category_name                          AS categoryName,
    total_bookings                         AS totalBookings,
    total_revenue                          AS totalRevenue,
    ROUND(avg_duration, 0)                 AS avgDurationMins,
    dense_rank() OVER (
        ORDER BY total_bookings DESC
    )                                      AS popularityRank
FROM monthly_stats
ORDER BY total_revenue DESC;


-- Report 3 — Stylist Performance Report
-- For each stylist, show:
-- Stylist name and specialisation
-- Total appointments handled
-- Total hours worked
-- Total revenue generated
-- Commission earned (revenue × commission_rate / 100) — your SQL must calculate this
-- Utilisation rate (booked hours / available shift hours × 100) — your SQL must calculate this
-- Sorted by highest revenue first

WITH stylist_stats AS (
    SELECT
        st.id                                               AS stylist_id,
        u.name                                              AS stylist_name,
        st.specialisation,
        st.commission_rate,
        COUNT(a.id)                                         AS total_appointments,
        COALESCE(SUM(a.total_duration), 0) / 60.0          AS total_hours_worked,
        COALESCE(SUM(
            CASE WHEN p.payment_status = 'Paid'
                 THEN p.amount ELSE 0 END
        ), 0)                                               AS total_revenue
    FROM stylists st                                        
    INNER JOIN users u        ON u.id         = st.user_id 
    LEFT  JOIN appointments a ON a.stylist_id = st.id
                             AND a.status             = 1
                             AND a.appointment_status = 'Completed'  
    LEFT  JOIN payments p     ON p.appointment_id     = a.id
                             AND p.payment_status     = 'Paid'      
    WHERE st.status IN ('Active', 'On Leave')              
    GROUP BY st.id, u.name, st.specialisation, st.commission_rate
),
available_hours AS (
    SELECT
        sws.stylist_id,
        SUM(
            CASE WHEN sws.is_working = 1
                 THEN TIME_TO_SEC(TIMEDIFF(sws.end_time, sws.start_time)) / 3600.0
                 ELSE 0
            END
        ) * (DAY(LAST_DAY(CURDATE())) / 7.0)               AS available_hours_this_month
    FROM stylist_working_schedules sws                    
    WHERE sws.status = 1
    GROUP BY sws.stylist_id
)
SELECT
    ss.stylist_id                                           AS stylistId,
    ss.stylist_name                                         AS stylistName,
    ss.specialisation,
    ss.total_appointments                                   AS totalAppointments,
    ROUND(ss.total_hours_worked, 2)                         AS totalHoursWorked,
    ss.total_revenue                                        AS totalRevenue,
    ROUND(ss.total_revenue * ss.commission_rate / 100, 2)  AS commissionEarned,
    CASE
        WHEN COALESCE(ah.available_hours_this_month, 0) = 0 THEN 0
        ELSE ROUND(
            ss.total_hours_worked / ah.available_hours_this_month * 100,
            2
        )
    END                                                     AS utilisationRate
FROM stylist_stats ss
LEFT JOIN available_hours ah ON ah.stylist_id = ss.stylist_id
ORDER BY ss.total_revenue DESC;






-- Report 4 — Customer Visit Analysis
-- For each customer, show:
-- Customer name, ID, and phone
-- Total visits (completed appointments)
-- Last visit date
-- Total amount spent
-- Favourite service (most booked service for that customer) — use a subquery or window function
-- Visit frequency classification: Regular if visits >= 4 this month, Occasional if < 4 — use CASE WHEN
-- Sorted by highest spending first

WITH favourite_service AS (
    SELECT
        a.customer_id,
        aps.service_name                        AS favourite_service
    FROM appointment_services aps
    INNER JOIN appointments a ON a.id = aps.appointment_id
    WHERE a.status             = 1
      AND a.appointment_status = 'Completed'
    GROUP BY a.customer_id, aps.service_name
    HAVING COUNT(*) = (
        SELECT MAX(cnt)
        FROM (
            SELECT COUNT(*) AS cnt
            FROM appointment_services aps2
            INNER JOIN appointments a2 ON a2.id = aps2.appointment_id
            WHERE a2.status             = 1
              AND a2.appointment_status = 'Completed'
              AND a2.customer_id        = a.customer_id
            GROUP BY aps2.service_name
        ) AS max_counts
    )
)
SELECT
    c.id                                        AS customerId,
    c.name                                      AS customerName,
    c.phone,
    COUNT(a.id)                                 AS totalVisits,
    MAX(a.date)                                 AS lastVisitDate,
    COALESCE(SUM(p.amount), 0)                  AS totalAmountSpent,
    COALESCE(MIN(fs.favourite_service), 'N/A')  AS favouriteService,
    CASE
        WHEN SUM(
            CASE
                WHEN a.date >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
                 AND a.date <  DATE_FORMAT(
                         CURDATE() + INTERVAL 1 MONTH, '%Y-%m-01'
                     )
                THEN 1 ELSE 0
            END
        ) >= 4 THEN 'Regular'
        ELSE 'Occasional'
    END                                         AS visitFrequency
FROM customers c
LEFT JOIN appointments a
       ON a.customer_id        = c.id
      AND a.status             = 1
      AND a.appointment_status = 'Completed'
LEFT JOIN payments p
       ON p.appointment_id     = a.id
      AND p.payment_status     = 'Paid'
LEFT JOIN favourite_service fs ON fs.customer_id = c.id
WHERE c.status != 127
GROUP BY
    c.id,
    c.name,
    c.phone,
    fs.favourite_service
ORDER BY totalAmountSpent DESC;
