import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  VersionColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('products')
@Index('idx_product_sale_window', ['isActive', 'saleStartAt'])
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  // Durable source of truth. Live decrements go to Redis during the sale,
  // then get reconciled back here after the sale closes.
  @Column({ type: 'int', default: 0 })
  stock: number;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  price: string;

  @Column({ type: 'boolean', default: false })
  isActive: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  saleStartAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  saleEndAt: Date | null;

  // Optimistic-lock safety net for the guarded DB decrement at checkout.
  @VersionColumn()
  version: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
