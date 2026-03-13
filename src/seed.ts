import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { User } from './modules/user/entities/user.entity';
import { Stylist } from './modules/stylist/entities/stylist.entity';
import { Customer } from './modules/customer/entities/customer.entity';
import { ServiceCategory } from './modules/service-category/entities/service-category.entity';
import { Service } from './modules/service/entities/service.entity';
import { Appointment } from './modules/appointment/entities/appointment.entity';
import { AppointmentServiceEntity } from './modules/appointment/entities/appointment-service.entity';
import { TimeSlot } from './modules/time-slot/entities/time-slot.entity';
import { StylistWorkingSchedule } from './modules/stylist/entities/stylist-working-schedule.entity';
import { StylistService } from './modules/stylist/entities/stylist-service.entity';
import { Payment } from './modules/payment/entities/payment.entity';

import {
  UserRole,
  Gender,
  StylistSpecialisation,
  StylistStatus,
  DayOfWeek,
  SlotStatus,
  AppointmentStatus,
  PaymentMethod,
  PaymentStatus,
} from './common/enums';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);

  console.log('Clearing existing data...');
  await dataSource.query('SET FOREIGN_KEY_CHECKS = 0;');
  await dataSource.query('DELETE FROM refresh_token;');
  await dataSource.query('DELETE FROM appointments;');
  await dataSource.query('DELETE FROM appointment_services;');
  await dataSource.query('DELETE FROM time_slots;');
  await dataSource.query('DELETE FROM payments;');
  await dataSource.query('DELETE FROM customers;');
  await dataSource.query('DELETE FROM stylist_working_schedules;');
  await dataSource.query('DELETE FROM stylist_services;');
  await dataSource.query('DELETE FROM stylists;');
  await dataSource.query('DELETE FROM services;');
  await dataSource.query('DELETE FROM service_categories;');
  await dataSource.query('DELETE FROM users;');
  await dataSource.query('SET FOREIGN_KEY_CHECKS = 1;');

  const passwordHash = await bcrypt.hash('Password@123', 10);

  console.log('Seeding Users...');
  const userRepo = dataSource.getRepository(User);
  const admin = userRepo.create({
    name: 'Admin User',
    email: 'admin@suratsalon.com',
    phone: '9876543210',
    role: UserRole.ADMIN,
    passwordHash,
  });

  const receptionist = userRepo.create({
    name: 'Front Desk',
    email: 'hello@suratsalon.com',
    phone: '9876543211',
    role: UserRole.RECEPTIONIST,
    passwordHash,
  });

  const stylist1User = userRepo.create({
    name: 'Aisha Sharma',
    email: 'aisha@suratsalon.com',
    phone: '9876543212',
    role: UserRole.STYLIST,
    passwordHash,
  });

  const stylist2User = userRepo.create({
    name: 'Rahul Verma',
    email: 'rahul@suratsalon.com',
    phone: '9876543213',
    role: UserRole.STYLIST,
    passwordHash,
  });

  const stylist3User = userRepo.create({
    name: 'Priya Patel',
    email: 'priya@suratsalon.com',
    phone: '9876543214',
    role: UserRole.STYLIST,
    passwordHash,
  });

  const stylist4User = userRepo.create({
    name: 'Rohan Desai',
    email: 'rohan@suratsalon.com',
    phone: '9876543215',
    role: UserRole.STYLIST,
    passwordHash,
  });

  const stylist5User = userRepo.create({
    name: 'Neha Gupta',
    email: 'neha@suratsalon.com',
    phone: '9876543216',
    role: UserRole.STYLIST,
    passwordHash,
  });

  await userRepo.save([admin, receptionist, stylist1User, stylist2User, stylist3User, stylist4User, stylist5User]);

  console.log('Seeding Categories...');
  const catRepo = dataSource.getRepository(ServiceCategory);
  const hairCat = catRepo.create({ name: 'Hair' });
  const skinCat = catRepo.create({ name: 'Skin' });
  const nailsCat = catRepo.create({ name: 'Nails' });
  const makeupCat = catRepo.create({ name: 'Makeup' });
  const spaCat = catRepo.create({ name: 'Spa' });
  await catRepo.save([hairCat, skinCat, nailsCat, makeupCat, spaCat]);

  console.log('Seeding Services...');
  const serviceRepo = dataSource.getRepository(Service);
  const servicesData = [
    { serviceCode: 'SRV-001', name: 'Men Haircut', category: hairCat, durationMins: 30, price: 500, gender: Gender.MALE },
    { serviceCode: 'SRV-002', name: 'Women Haircut', category: hairCat, durationMins: 45, price: 800, gender: Gender.FEMALE },
    { serviceCode: 'SRV-003', name: 'Hair Coloring', category: hairCat, durationMins: 120, price: 2500, gender: Gender.UNISEX },
    { serviceCode: 'SRV-004', name: 'Facial', category: skinCat, durationMins: 60, price: 1500, gender: Gender.UNISEX },
    { serviceCode: 'SRV-005', name: 'Bleach', category: skinCat, durationMins: 30, price: 600, gender: Gender.UNISEX },
    { serviceCode: 'SRV-006', name: 'Manicure', category: nailsCat, durationMins: 45, price: 700, gender: Gender.UNISEX },
    { serviceCode: 'SRV-007', name: 'Pedicure', category: nailsCat, durationMins: 60, price: 900, gender: Gender.UNISEX },
    { serviceCode: 'SRV-008', name: 'Bridal Makeup', category: makeupCat, durationMins: 180, price: 15000, gender: Gender.FEMALE },
    { serviceCode: 'SRV-009', name: 'Party Makeup', category: makeupCat, durationMins: 90, price: 4000, gender: Gender.FEMALE },
    { serviceCode: 'SRV-010', name: 'Full Body Massage', category: spaCat, durationMins: 90, price: 3500, gender: Gender.UNISEX },
    { serviceCode: 'SRV-011', name: 'Head Massage', category: spaCat, durationMins: 30, price: 500, gender: Gender.UNISEX },
  ];
  const services = serviceRepo.create(servicesData);
  await serviceRepo.save(services);

  console.log('Seeding Stylists...');
  const stylistRepo = dataSource.getRepository(Stylist);
  const stylistsData = [
    { user: stylist1User, specialisation: StylistSpecialisation.HAIR_STYLIST, commissionRate: 20.0, bio: 'Expert in modern hair styling.' },
    { user: stylist2User, specialisation: StylistSpecialisation.BEAUTICIAN, commissionRate: 15.0, bio: 'Skin care expert.' },
    { user: stylist3User, specialisation: StylistSpecialisation.MAKEUP_ARTIST, commissionRate: 25.0, bio: 'Bridal specialist.' },
    { user: stylist4User, specialisation: StylistSpecialisation.SPA_THERAPIST, commissionRate: 30.0, bio: 'Relaxing therapies expert.' },
    { user: stylist5User, specialisation: StylistSpecialisation.HAIR_STYLIST, commissionRate: 18.0, bio: 'Coloring expert.' },
  ];
  const stylists = stylistRepo.create(stylistsData);
  await stylistRepo.save(stylists);

  console.log('Seeding Stylist Schedules & Services...');
  const scheduleRepo = dataSource.getRepository(StylistWorkingSchedule);
  const stylistServiceRepo = dataSource.getRepository(StylistService);

  for (const stylist of stylists) {
    const schedules = Object.values(DayOfWeek).map((day) => {
      const isWorkingDay = day !== DayOfWeek.SUNDAY;
      return scheduleRepo.create({
        stylist,
        dayOfWeek: day,
        isWorking: isWorkingDay,
        startTime: isWorkingDay ? '09:00:00' : null,
        endTime: isWorkingDay ? '18:00:00' : null,
      });
    });
    await scheduleRepo.save(schedules);

    // Assign some services
    const assignedServices = services.slice(0, 3).map(service =>
      stylistServiceRepo.create({ stylist, service })
    );
    await stylistServiceRepo.save(assignedServices);
  }

  console.log('Seeding Customers...');
  const customerRepo = dataSource.getRepository(Customer);
  const customers = [];
  for (let i = 1; i <= 15; i++) {
    customers.push(customerRepo.create({
      customerCode: `CUST-2025-${i.toString().padStart(3, '0')}`,
      name: `Customer ${i}`,
      email: `customer${i}@example.com`,
      phone: `99887766${i.toString().padStart(2, '0')}`,
      gender: i % 2 === 0 ? Gender.FEMALE : Gender.MALE,
    }));
  }
  await customerRepo.save(customers);

  console.log('Seeding Appointments, TimeSlots, and Payments...');
  const appointmentRepo = dataSource.getRepository(Appointment);
  const timeSlotRepo = dataSource.getRepository(TimeSlot);
  const paymentRepo = dataSource.getRepository(Payment);
  const appointmentServiceRepo = dataSource.getRepository(AppointmentServiceEntity);



  // We need 20 Appointments and 30 TimeSlots
  const dateStr = new Date().toISOString().split('T')[0];
  const appts = [];

  const statuses = [
    AppointmentStatus.SCHEDULED, AppointmentStatus.COMPLETED,
    AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW
  ];

  for (let i = 1; i <= 20; i++) {
    const customer = customers[i % 15];
    const stylist = stylists[i % 5];
    const status = statuses[i % 4];
    const service1 = services[i % 10];

    // Some logic to create times (e.g., 09:00, 10:00)
    let hour = 9 + Math.floor(i / 2); // 9, 9, 10, 10, ...
    if (hour > 17) hour = 17;
    const startTimeStr = `${hour.toString().padStart(2, '0')}:00:00`;
    const endTimeStr = `${hour.toString().padStart(2, '0')}:30:00`; // 30 min duration

    const appt = appointmentRepo.create({
      appointmentCode: `APT-2025-${i.toString().padStart(3, '0')}`,
      customer,
      stylist,
      date: dateStr,
      startTime: startTimeStr,
      endTime: endTimeStr,
      totalDuration: service1.durationMins,
      totalAmount: service1.price,
      appointmentStatus: status,
      status: 1, // Fix Problem 2: explicitly set status
    });
    await appointmentRepo.save(appt);
    appts.push(appt);

    // Fix Problem 1: seed appointment_services table
    const isCompleted = status === AppointmentStatus.COMPLETED;
    const apptService = appointmentServiceRepo.create({
      appointment: appt,
      service: service1,
      serviceName: service1.name,
      price: service1.price,
      durationMins: service1.durationMins,
      isCompleted: isCompleted,
    });
    await appointmentServiceRepo.save(apptService);

    let paymentStatus = PaymentStatus.PENDING;
    if (status === AppointmentStatus.COMPLETED) paymentStatus = PaymentStatus.PAID;
    else if (status === AppointmentStatus.CANCELLED) paymentStatus = PaymentStatus.REFUNDED;

    const paymentMethods = [PaymentMethod.CASH, PaymentMethod.CARD, PaymentMethod.UPI];
    const paymentMethod = paymentMethods[i % paymentMethods.length];

    const isPaid = paymentStatus === PaymentStatus.PAID;
    const payment = paymentRepo.create({
      appointment: appt,
      amount: appt.totalAmount,
      paymentMethod,
      paymentStatus,
      transactionRef: isPaid ? `TXN-2025-${i.toString().padStart(4, '0')}` : null,
      notes: 'Initial seed payment',
      paidAt: isPaid ? new Date() : null,
    });
    await paymentRepo.save(payment);

    // Create TimeSlots for this appointment (at least 1 per appt)
    const slot1 = timeSlotRepo.create({
      stylist,
      appointmentId: appt.id,
      date: dateStr,
      startTime: startTimeStr,
      endTime: endTimeStr,
      status: status === AppointmentStatus.CANCELLED ? SlotStatus.AVAILABLE : SlotStatus.BOOKED,
    });
    await timeSlotRepo.save(slot1);

    // Throw in an extra time slot for every odd appointment to reach total 30
    if (i % 2 !== 0) {
      const extraStartTime = `${hour.toString().padStart(2, '0')}:30:00`;
      const extraEndTime = `${(hour + 1).toString().padStart(2, '0')}:00:00`;
      const slot2 = timeSlotRepo.create({
        stylist,
        appointmentId: appt.id,
        date: dateStr,
        startTime: extraStartTime,
        endTime: extraEndTime,
        status: status === AppointmentStatus.CANCELLED ? SlotStatus.AVAILABLE : SlotStatus.BOOKED,
      });
      await timeSlotRepo.save(slot2);
    }
  }

  // To reach exactly 30 slots if the math doesn't sum up or we need some just AVAILABLE 
  // Loop for the remaining available slots, let's say 5 free slots just in case
  for (let j = 1; j <= 5; j++) {
    const freeSlot = timeSlotRepo.create({
      stylist: stylists[0],
      appointmentId: null,
      date: `2025-12-01`,  // future test date
      startTime: `1${j}:00:00`,
      endTime: `1${j}:30:00`,
      status: SlotStatus.AVAILABLE,
    });
    try {
      await timeSlotRepo.save(freeSlot);
    } catch (e) { /* ignore duplication if any */ }
  }

  console.log('Seed completed successfully!');
  await app.close();
}

bootstrap().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
