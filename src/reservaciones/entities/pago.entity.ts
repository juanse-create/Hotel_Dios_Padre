import { Column, Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Reservacion } from './reservacion.entity';

@Entity('pagos')
export class Pago {
  @PrimaryGeneratedColumn() id: number;

  @Column() metodo_pago: string;

  @Column('decimal', { precision: 10, scale: 2 }) importe: number;

  @Column({ nullable: true }) banco: string;

  @Column({ type: 'date' }) fecha_pago: string;

  @Column({ length: 4, nullable: true }) terminacion_tarjeta: string;

  @Column({ nullable: true }) referencia: string;

  @ManyToOne(() => Reservacion, (reservacion) => reservacion.pagos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reservacion_id' })
  reservacion: Reservacion;
}