import { Column } from 'typeorm';
import { BaseEntity } from './base.entity';

export abstract class TenantEntity extends BaseEntity {
    @Column()
    tenantId: string;
}