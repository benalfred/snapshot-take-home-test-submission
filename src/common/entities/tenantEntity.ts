import { Column } from 'typeorm';
import { BaseEntity } from './base.entity';

export abstract class AuditableEntity extends BaseEntity {
    @Column()
    tenantId: string;
}