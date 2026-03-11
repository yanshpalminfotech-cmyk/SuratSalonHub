import { STATUS } from 'src/common/constant/constant';
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    OneToMany,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';

@Entity('service_categories')
export class ServiceCategory {
    @PrimaryGeneratedColumn({ unsigned: true })
    id!: number;

    @Column({ type: 'varchar', length: 50, unique: true })
    name!: string;

    @Column({ type: 'tinyint', default: STATUS.ACTIVE })
    status!: number;

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;
}