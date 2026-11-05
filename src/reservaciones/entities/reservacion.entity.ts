import { Column, Entity, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { Pago } from './pago.entity';

@Entity('reservaciones')
export class Reservacion {
  @PrimaryGeneratedColumn() id: number;
  @Column({ nullable: true }) folio: string;
  @Column({ name: 'huesped_id', nullable: true }) huespedId: number;
  @Column({ name: 'usuario_id', nullable: true }) usuarioId: number;
  @Column({ name: 'fecha_inicio', type: 'date', nullable: true })
  fechaInicio: string;
  @Column({ name: 'fecha_fin', type: 'date', nullable: true }) fechaFin: string;
  @Column({
    name: 'cortesia_porcentaje',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
  })
  cortesiaPorcentaje: number;
  @Column({ nullable: true }) adultos: number;
  @Column({ nullable: true }) menores: number;
  @Column({
    type: 'enum',
    enum: ['En proceso', 'Confirmada', 'Cancelada', 'Finalizada'],
    nullable: true,
  })
  estado: string;
  @Column({
    name: 'created_at',
    type: 'timestamp',
    insert: false,
    update: false,
  })
  createdAt: Date;

  @OneToMany(() => Pago, (pago) => pago.reservacion, { cascade: true })
  pagos: Pago[];
}
