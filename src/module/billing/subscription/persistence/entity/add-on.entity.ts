import { JsonMetadata } from '@billingModule/shared/core/interface/common.interface';
import { Column, Entity, OneToMany } from 'typeorm';
import { DefaultEntity } from '@sharedModules/persistence/typeorm/entity/default.entity';
import { AddOnType } from '@billingModule/subscription/core/enum/add-on-type.enum';
import { SubscriptionAddOnEntity } from '@billingModule/subscription/persistence/entity/subscription-add-on.entity';

export class ColumnNumericTransformer {
  to(data: number): number {
    return data;
  }
  from(data: string): number {
    return parseFloat(data);
  }
}

@Entity({ name: 'BillingAddOn' })
export class AddOn extends DefaultEntity<AddOn> {
  @Column({ length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: AddOnType,
  })
  addOnType: AddOnType;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  price: number;

  @Column({ length: 3, default: 'USD' })
  currency: string;

  @Column({ type: 'json', nullable: true })
  requiresPlan: string[] | null;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  taxCategoryId: string | null;

  @Column({ type: 'json', nullable: true })
  metadata: JsonMetadata | null;

  @OneToMany(
    () => SubscriptionAddOnEntity,
    (subscriptionAddOn) => subscriptionAddOn.addOn,
  )
  subscriptionAddOns: SubscriptionAddOnEntity[];
}
