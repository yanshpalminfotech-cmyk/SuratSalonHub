import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
} from 'typeorm';
import { ServiceCategory } from '../../service-category/entities/service-category.entity';
import { Gender } from 'src/common/enums/gender.enum';
import { STATUS } from 'src/common/constant/constant';


@Entity('services')
export class Service {
    @PrimaryGeneratedColumn({ unsigned: true })
    id!: number;

    @Column({ name: 'service_code', type: 'varchar', length: 20, unique: true })
    serviceCode!: string;                              // SRV-001

    @Column({ type: 'varchar', length: 100 })
    name!: string;

    // @Index('idx_services_category_id')
    @ManyToOne(() => ServiceCategory, {
        nullable: false,
        onDelete: 'RESTRICT',                        // cannot delete category with active services
        onUpdate: 'CASCADE',
    })
    @JoinColumn({ name: 'category_id' })
    category!: ServiceCategory;

    @Column({ name: 'duration_mins', type: 'smallint', unsigned: true })
    durationMins!: number;

    @Column({ type: 'decimal', precision: 10, scale: 2 })
    price!: number;

    // @Index('idx_services_gender')
    @Column({ type: 'enum', enum: Gender, default: Gender.UNISEX })
    gender!: Gender;

    @Column({ type: 'text', nullable: true })
    description!: string | null;

    // @Index('idx_services_status')
    @Column({ type: 'tinyint', default: STATUS.ACTIVE })
    status!: number;

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;
}