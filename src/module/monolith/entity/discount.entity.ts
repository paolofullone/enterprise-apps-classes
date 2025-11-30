import { JsonMetadata } from '../interface/common.interface';
import { Column, Entity, OneToMany } from 'typeorm';
import { DefaultEntity } from '@sharedModules/persistence/typeorm/entity/default.entity';
import { DiscountType } from '../enum/discount-type.enum';
import { SubscriptionDiscount } from '../entity/subscription-discount.entity';

export class ColumnNumericTransformer {
  to(data: number): number {
    return data;
  }
  from(data: string): number {
    return parseFloat(data);
  }
}

@Entity({ name: 'BillingDiscount' })
export class Discount extends DefaultEntity<Discount> {
  @Column({ unique: true, length: 50 })
  code: string;

  @Column({ length: 100 })
  name: string;

  @Column({
    type: 'enum',
    enum: DiscountType,
  })
  discountType: DiscountType;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  value: number;

  @Column({ type: 'int', nullable: true })
  maxRedemptions: number | null;

  @Column({ type: 'int', default: 0 })
  currentRedemptions: number;

  @Column({ type: 'timestamp' })
  validFrom: Date;

  @Column({ type: 'timestamp', nullable: true })
  validTo: Date | null;

  @Column({ type: 'json', nullable: true })
  applicablePlans: string[] | null;

  @Column({ default: false })
  isStackable: boolean;

  @Column({ type: 'int', default: 0 })
  priority: number;

  @Column({ type: 'json', nullable: true })
  metadata: JsonMetadata | null;

  @OneToMany(
    () => SubscriptionDiscount,
    (subscriptionDiscount) => subscriptionDiscount.discount,
  )
  subscriptionDiscounts: SubscriptionDiscount[];
}
