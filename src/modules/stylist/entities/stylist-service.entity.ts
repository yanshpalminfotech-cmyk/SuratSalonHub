import {
    Entity,
    PrimaryGeneratedColumn,
    ManyToOne,
    JoinColumn,
    Index,
    Unique,
} from 'typeorm';
import { Stylist } from './stylist.entity';
import { Service } from '../../service/entities/service.entity';

@Entity('stylist_services')
@Unique('uq_stylist_service', ['stylist', 'service'])  // no duplicate assignment
export class StylistService {
    @PrimaryGeneratedColumn({ unsigned: true })
    id!: number;

    @Index('idx_stylist_services_stylist_id')
    @ManyToOne(() => Stylist, (stylist) => stylist.stylistServices, {
        nullable: false,
        onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'stylist_id' })
    stylist!: Stylist;

    @Index('idx_stylist_services_service_id')
    @ManyToOne(() => Service, {
        nullable: false,
        onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'service_id' })
    service!: Service;
}