import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
    OneToOne,
    OneToMany,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { UserRole } from 'src/common/enums';
import { STATUS } from 'src/common/constant/constant';



@Entity('users')
export class User {
    @PrimaryGeneratedColumn({ unsigned: true })
    id!: number;

    // @Index('idx_users_role')
    @Column({ type: 'enum', enum: UserRole })
    role!: UserRole;

    @Column({ type: 'varchar', length: 100 })
    name!: string;

    // @Index({ unique: true })
    @Column({ type: 'varchar', length: 150, unique: true })
    email!: string;

    // @Index({ unique: true })
    @Column({ type: 'varchar', length: 15, unique: true })
    phone!: string;

    @Exclude()
    @Column({ name: 'password', type: 'varchar', length: 255 })
    passwordHash!: string;

    // @Index('idx_users_is_locked')
    @Column({ name: 'is_locked', type: 'boolean', default: false })
    isLocked!: boolean;

    @Column({ name: 'failed_attempts', type: 'tinyint', unsigned: true, default: 0 })
    failedAttempts!: number;

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;

    @Column({
        type: 'tinyint',
        default: STATUS.ACTIVE
    })
    status!: number;
}