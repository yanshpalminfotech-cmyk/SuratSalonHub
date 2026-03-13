import { User } from 'src/modules/user/entities/user.entity';
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
    Index,
} from 'typeorm';


@Entity('refresh_token')
export class RefreshToken {
    @PrimaryGeneratedColumn({ unsigned: true })
    id!: number;

    @Index('idx_rt_user_id')
    @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user!: User;

    @Index('idx_rt_token_hash')
    @Column({ name: 'token_hash', type: 'varchar', length: 255 })
    tokenHash!: string;

    @Column({ name: 'expires_at', type: 'timestamp' })
    expiresAt!: Date;

    @Column({ type: 'boolean', default: false })
    revoked!: boolean;

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;
}