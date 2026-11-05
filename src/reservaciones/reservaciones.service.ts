import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { validarCortesia } from './cortesias';
import { DataSource, In, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Reservacion } from './entities/reservacion.entity';
import { ReservacionHabitacion } from './entities/reservacion-habitacion.entity';
import { Habitacion } from '../habitaciones/entities/habitacion.entity';
import { EstadoHabitacion } from '../habitaciones/entities/estado-habitacion.entity';
import { Huesped } from '../huespedes/huesped.entity';
import { Pago } from './entities/pago.entity';

@Injectable()
export class ReservacionesService implements OnModuleInit {
  constructor(
    @InjectRepository(Reservacion)
    private readonly reservaciones: Repository<Reservacion>,
    @InjectRepository(ReservacionHabitacion)
    private readonly enlaces: Repository<ReservacionHabitacion>,
    @InjectRepository(Habitacion)
    private readonly habitaciones: Repository<Habitacion>,
    @InjectRepository(EstadoHabitacion)
    private readonly estados: Repository<EstadoHabitacion>,
    private readonly dataSource: DataSource,
  ) {}

  // Se asegura de que la tabla pagos exista automáticamente al arrancar NestJS
  async onModuleInit() {
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS pagos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        reservacion_id INT NOT NULL,
        metodo_pago VARCHAR(50) NOT NULL,
        importe DECIMAL(10,2) NOT NULL,
        banco VARCHAR(100) NOT NULL,
        fecha_pago DATE NOT NULL,
        terminacion_tarjeta VARCHAR(4) NULL,
        referencia VARCHAR(100) NULL,
        INDEX idx_pagos_reservacion (reservacion_id)
      )
    `);
  }

  async list(estado?: string) {
    const consulta = this.reservaciones
      .createQueryBuilder('r')
      .leftJoin('huespedes', 'h', 'h.id=r.huesped_id')
      .leftJoin('usuarios', 'u', 'u.id=r.usuario_id')
      .leftJoin('reservacion_habitaciones', 'rh', 'rh.reservacion_id=r.id')
      .leftJoin('habitaciones', 'ha', 'ha.id=rh.habitacion_id')
      .select([
        'r.*',
        'h.nombre AS huesped_nombre',
        'h.apellido_paterno AS huesped_apellido',
        'u.nombre AS recepcionista_nombre',
        "GROUP_CONCAT(CONCAT(ha.numero, IF(ha.foto_url IS NULL, '', CONCAT('|',ha.foto_url)))) AS habitaciones_detalle",
        ' ROUND(COALESCE(SUM(rh.precio), 0) * GREATEST(DATEDIFF(r.fecha_fin, r.fecha_inicio), 1) * (1 - r.cortesia_porcentaje / 100), 2) AS total_reservacion',
        '(SELECT COALESCE(SUM(p.importe), 0) FROM pagos p WHERE p.reservacion_id = r.id) AS total_pagado',
      ])
      .groupBy('r.id')
      .orderBy('r.id', 'DESC');

    consulta.andWhere(
      `(r.estado IN ('En proceso','Confirmada')
        OR (r.estado IN ('Cancelada','Finalizada')
            AND DATE(r.fecha_fin)=CURDATE()
            AND CURTIME() < '23:59:00'))`,
    );

    if (estado) consulta.andWhere('r.estado = :estado', { estado });
    const filas = await consulta.getRawMany();

    if (!filas.length) return filas;

    const ids = filas.map((f) => Number(f.id));
    const pagos = await this.dataSource
      .getRepository(Pago)
      .createQueryBuilder('p')
      .where('p.reservacion_id IN (:...ids)', { ids })
      .orderBy('p.id', 'ASC')
      .getRawMany();

    return filas.map((r) => {
      const totalRes = Number(r.total_reservacion || 0);
      const totalPag = Number(r.total_pagado || 0);
      const pagosDeReserva = pagos
        .filter((p) => Number(p.p_reservacion_id) === Number(r.id))
        .map((p) => ({
          id: p.p_id,
          metodo_pago: p.p_metodo_pago,
          importe: Number(p.p_importe),
          banco: p.p_banco,
          fecha_pago:
            p.p_fecha_pago instanceof Date
              ? p.p_fecha_pago.toISOString().slice(0, 10)
              : String(p.p_fecha_pago || '').slice(0, 10),
          terminacion_tarjeta: p.p_terminacion_tarjeta,
          referencia: p.p_referencia,
        }));

      return {
        ...r,
        total_reservacion: totalRes,
        total_pagado: totalPag,
        saldo_pendiente: Math.max(0, totalRes - totalPag),
        pagos_detalle: pagosDeReserva,
      };
    });
  }

  async disponibles(inicio: string, fin: string, reservacionId?: number) {
    if (!inicio || !fin) {
      throw new BadRequestException('Selecciona fecha de entrada y salida');
    }
    if (
      reservacionId !== undefined &&
      (!Number.isInteger(reservacionId) || reservacionId <= 0)
    ) {
      throw new BadRequestException('Reservación inválida');
    }
    this.validarFechaActual(inicio);
    if (new Date(fin) <= new Date(inicio)) {
      throw new BadRequestException(
        'La salida debe ser posterior a la entrada',
      );
    }

    const habitacionesActuales = reservacionId
      ? await this.enlaces.findBy({ reservacionId })
      : [];
    const habitacionesActualesIds = new Set(
      habitacionesActuales.map((enlace) => enlace.habitacionId),
    );

    const habitaciones = await this.habitaciones
      .createQueryBuilder('h')
      .leftJoinAndSelect('h.estado', 'estado')
      .leftJoinAndSelect('h.tipo', 'tipo')
      .where('h.activa=1')
      .andWhere(
        `h.id NOT IN (
          SELECT rh.habitacion_id
          FROM reservacion_habitaciones rh
          JOIN reservaciones r ON r.id=rh.reservacion_id
          WHERE r.estado IN ('En proceso','Confirmada')
          AND r.fecha_inicio < :fin
          AND r.fecha_fin > :inicio
          AND (:reservacionId IS NULL OR r.id <> :reservacionId)
        )`,
        { inicio, fin, reservacionId: reservacionId ?? null },
      )
      .andWhere(
        `(estado.nombre NOT IN ('Fuera de servicio','Ocupada','Pendiente de limpieza','Sucia','En proceso')
          OR (:reservacionId IS NOT NULL AND h.id IN (
            SELECT actual.habitacion_id
            FROM reservacion_habitaciones actual
            WHERE actual.reservacion_id = :reservacionId
          )))`,
        { reservacionId: reservacionId ?? null },
      )
      .orderBy('h.numero', 'ASC')
      .getMany();

    return habitaciones.map((habitacion) =>
      Object.assign(habitacion, {
        asignadaActualmente: habitacionesActualesIds.has(habitacion.id),
      }),
    );
  }

  async create(data: any, usuarioId: number) {
    this.validarDatos(data);
    const pagosValidados = this.validarPagos(data.pagos);

    const habitacionIds = (data.habitacionIds ?? []).map(Number);
    if (!habitacionIds.length) {
      throw new BadRequestException('Selecciona al menos una habitación');
    }

    const disponibles = await this.disponibles(data.fechaInicio, data.fechaFin);
    const permitidas = new Set(disponibles.map((habitacion) => habitacion.id));
    const bloqueadas = await this.habitaciones.find({
      where: { id: In(habitacionIds) },
      relations: { estado: true, tipo: true },
    });
    bloqueadas
      .filter(
        (habitacion) =>
          habitacion.estado?.nombre === 'En proceso de reservación',
      )
      .forEach((habitacion) => permitidas.add(habitacion.id));
    if (habitacionIds.some((id: number) => !permitidas.has(id))) {
      throw new BadRequestException(
        'Una de las habitaciones seleccionadas ya no está disponible',
      );
    }
    const preciosPorHabitacion = new Map(
      bloqueadas.map((habitacion) => [
        habitacion.id,
        Number(habitacion.tipo?.precio || 0),
      ]),
    );

    return this.dataSource.transaction(async (manager) => {
      const cortesiaPorcentaje = await validarCortesia(
        manager,
        data.cortesiaPorcentaje === undefined ? 0 : data.cortesiaPorcentaje,
      );
      let huespedId = Number(data.huespedId);
      if (!huespedId && data.huesped) {
        const huesped = await manager.save(
          Huesped,
          manager.create(Huesped, this.normalizarHuesped(data.huesped)),
        );
        huespedId = huesped.id;
      }
      if (!huespedId) {
        throw new BadRequestException('Captura los datos del huésped');
      }

      const reservacion = await manager.save(
        Reservacion,
        manager.create(Reservacion, {
          folio: `RES-${Date.now()}`,
          huespedId,
          usuarioId,
          fechaInicio: data.fechaInicio,
          fechaFin: data.fechaFin,
          cortesiaPorcentaje,
          adultos: Number(data.adultos || 1),
          menores: Number(data.menores || 0),
          estado: 'Confirmada',
        }),
      );

      for (const habitacionId of habitacionIds) {
        await manager.save(
          ReservacionHabitacion,
          manager.create(ReservacionHabitacion, {
            reservacionId: reservacion.id,
            habitacionId,
            precio: preciosPorHabitacion.get(habitacionId) || 0,
          }),
        );
      }

      for (const p of pagosValidados) {
        await manager.save(
          Pago,
          manager.create(Pago, {
            ...p,
            reservacion: { id: reservacion.id } as Reservacion,
          }),
        );
      }

      const estado = await manager.findOne(EstadoHabitacion, {
        where: {
          nombre: 'Reservada',
        },
      });

      if (estado) {
        await manager.update(Habitacion, habitacionIds, {
          estadoId: estado.id,
        });
      }

      return reservacion;
    });
  }

  async modificar(id: number, data: any, usuarioId: number) {
    this.validarDatos(data);
    const pagosValidados = this.validarPagos(data.pagos);

    const actual = await this.reservaciones.findOneBy({ id });
    if (!actual) throw new NotFoundException('Reservación no encontrada');
    if (['Finalizada', 'Cancelada'].includes(actual.estado)) {
      throw new BadRequestException('Esta reservación ya no puede modificarse');
    }

    const nuevosIds = (data.habitacionIds ?? []).map(Number);
    if (!nuevosIds.length) {
      throw new BadRequestException('Selecciona al menos una habitación');
    }

    const enlacesActuales = await this.enlaces.findBy({ reservacionId: id });
    const actualesIds = enlacesActuales.map((enlace) => enlace.habitacionId);
    const preciosActuales = new Map(
      enlacesActuales.map((enlace) => [
        enlace.habitacionId,
        Number(enlace.precio || 0),
      ]),
    );

    const disponibles = await this.disponibles(
      data.fechaInicio,
      data.fechaFin,
      id,
    );
    const permitidas = new Set(disponibles.map((habitacion) => habitacion.id));
    if (
      nuevosIds.some((habitacionId: number) => !permitidas.has(habitacionId))
    ) {
      throw new BadRequestException('Una habitación ya no está disponible');
    }
    const habitacionesSeleccionadas = await this.habitaciones.find({
      where: { id: In(nuevosIds) },
      relations: { tipo: true },
    });
    const preciosPorHabitacion = new Map(
      habitacionesSeleccionadas.map((habitacion) => [
        habitacion.id,
        Number(habitacion.tipo?.precio || 0),
      ]),
    );

    return this.dataSource.transaction(async (manager) => {
      const cortesiaPorcentaje = await validarCortesia(
        manager,
        data.cortesiaPorcentaje === undefined
          ? Number(actual.cortesiaPorcentaje ?? 0)
          : data.cortesiaPorcentaje,
      );
      let huespedId = Number(data.huespedId || actual.huespedId);
      if (data.huesped) {
        if (huespedId) {
          await manager.update(
            Huesped,
            huespedId,
            this.normalizarHuesped(data.huesped),
          );
        } else {
          const huesped = await manager.save(
            Huesped,
            manager.create(Huesped, this.normalizarHuesped(data.huesped)),
          );
          huespedId = huesped.id;
        }
      }

      await manager.update(Reservacion, id, {
        huespedId,
        usuarioId,
        fechaInicio: data.fechaInicio,
        fechaFin: data.fechaFin,
        cortesiaPorcentaje,
        adultos: Number(data.adultos || 1),
        menores: Number(data.menores || 0),
      });

      await manager.delete(ReservacionHabitacion, { reservacionId: id });
      for (const habitacionId of nuevosIds) {
        await manager.save(
          ReservacionHabitacion,
          manager.create(ReservacionHabitacion, {
            reservacionId: id,
            habitacionId,
            precio:
              preciosActuales.get(habitacionId) ||
              preciosPorHabitacion.get(habitacionId) ||
              0,
          }),
        );
      }

      await manager.query('DELETE FROM pagos WHERE reservacion_id = ?', [id]);
      for (const p of pagosValidados) {
        await manager.save(
          Pago,
          manager.create(Pago, {
            ...p,
            reservacion: { id } as Reservacion,
          }),
        );
      }

      const liberadas = actualesIds.filter(
        (habitacionId) => !nuevosIds.includes(habitacionId),
      );
      const disponible = await manager.findOne(EstadoHabitacion, {
        where: { nombre: 'Disponible' },
      });
      if (disponible && liberadas.length) {
        await manager.update(Habitacion, liberadas, {
          estadoId: disponible.id,
        });
      }

      const nombreEstado =
        actual.estado === 'Confirmada'
          ? 'Reservada'
          : 'En proceso de reservación';
      const estadoHabitacion = await manager.findOne(EstadoHabitacion, {
        where: { nombre: nombreEstado },
      });
      if (estadoHabitacion) {
        await manager.update(Habitacion, nuevosIds, {
          estadoId: estadoHabitacion.id,
        });
      }

      return manager.findOneBy(Reservacion, { id });
    });
  }

  async estado(id: number, estado: string) {
    const permitidos = ['En proceso', 'Confirmada', 'Cancelada'];
    if (!permitidos.includes(estado)) {
      throw new BadRequestException('Estado de reservación inválido');
    }

    const reservacion = await this.reservaciones.findOneBy({ id });
    if (!reservacion) throw new NotFoundException('Reservación no encontrada');

    reservacion.estado = estado;
    await this.reservaciones.save(reservacion);

    const enlaces = await this.enlaces.findBy({ reservacionId: id });
    const nombre =
      estado === 'Cancelada'
        ? 'Disponible'
        : estado === 'Confirmada'
          ? 'Reservada'
          : 'En proceso de reservación';
    const estadoHabitacion = await this.estados.findOneBy({ nombre });
    if (estadoHabitacion && enlaces.length) {
      await this.habitaciones.update(
        enlaces.map((enlace) => enlace.habitacionId),
        { estadoId: estadoHabitacion.id },
      );
    }

    return reservacion;
  }

  async liberarExpiradas() {
    await this.dataSource.query(
      `UPDATE habitaciones h
       JOIN reservacion_habitaciones rh ON rh.habitacion_id=h.id
       JOIN reservaciones r ON r.id=rh.reservacion_id
       JOIN estados_habitacion e ON e.nombre='Disponible'
       SET h.estado_id=e.id,r.estado='Cancelada'
       WHERE r.estado='En proceso'
       AND r.created_at < DATE_SUB(NOW(),INTERVAL 15 MINUTE)`,
    );
    return { message: 'Bloqueos vencidos liberados' };
  }

  async eliminar(id: number) {
    const reservacion = await this.reservaciones.findOneBy({ id });
    if (!reservacion) throw new NotFoundException('Reservación no encontrada');

    return this.dataSource.transaction(async (manager) => {
      const enlaces = await manager.findBy(ReservacionHabitacion, {
        reservacionId: id,
      });
      const habitacionIds = enlaces.map((enlace) => enlace.habitacionId);

      await manager.query('DELETE FROM pagos WHERE reservacion_id = ?', [id]);
      await manager.delete(ReservacionHabitacion, { reservacionId: id });
      await manager.delete(Reservacion, id);

      const disponible = await manager.findOne(EstadoHabitacion, {
        where: { nombre: 'Disponible' },
      });
      if (disponible && habitacionIds.length) {
        await manager.update(Habitacion, habitacionIds, {
          estadoId: disponible.id,
        });
      }

      return { message: 'Reservación eliminada' };
    });
  }

  async bloquearHabitacion(id: number) {
    const disponible = await this.estados.findOneBy({ nombre: 'Disponible' });
    const enProceso = await this.estados.findOneBy({
      nombre: 'En proceso de reservación',
    });
    if (!disponible || !enProceso) {
      throw new BadRequestException('Estados de habitación no configurados');
    }
    const resultado = await this.habitaciones.update(
      { id, estadoId: disponible.id, activa: true },
      { estadoId: enProceso.id },
    );
    if (!resultado.affected) {
      throw new BadRequestException(
        'La habitación acaba de ser seleccionada por otra persona',
      );
    }
    return { message: 'Habitación bloqueada temporalmente' };
  }

  async desbloquearHabitacion(id: number) {
    const disponible = await this.estados.findOneBy({ nombre: 'Disponible' });
    const enProceso = await this.estados.findOneBy({
      nombre: 'En proceso de reservación',
    });
    if (disponible && enProceso) {
      await this.habitaciones.update(
        { id, estadoId: enProceso.id },
        { estadoId: disponible.id },
      );
    }
    return { message: 'Bloqueo liberado' };
  }

  private validarDatos(data: any) {
    if (!data.fechaInicio || !data.fechaFin) {
      throw new BadRequestException('Selecciona fecha de entrada y salida');
    }
    this.validarFechaActual(data.fechaInicio);
    if (new Date(data.fechaFin) <= new Date(data.fechaInicio)) {
      throw new BadRequestException(
        'La salida debe ser posterior a la entrada',
      );
    }
  }

  private validarPagos(pagos: any[]): Partial<Pago>[] {
    if (!Array.isArray(pagos) || !pagos.length) {
      throw new BadRequestException(
        'Toda reservación debe contar obligatoriamente con al menos una forma de pago registrada',
      );
    }

    const metodosValidos = [
      'Tarjeta de débito',
      'Tarjeta de crédito',
      'Transferencia bancaria',
      'Depósito bancario',
      'debito',
      'credito',
      'transferencia',
      'deposito',
    ];

    return pagos.map((p, idx) => {
      const metodo = String(p.metodo_pago || '').trim();
      if (!metodosValidos.includes(metodo)) {
        throw new BadRequestException(
          `Forma de pago inválida en el pago #${idx + 1}`,
        );
      }

      const importe = Number(p.importe);
      if (!Number.isFinite(importe) || importe <= 0) {
        throw new BadRequestException(
          `Importe inválido en el pago #${idx + 1}`,
        );
      }

      const banco = String(p.banco || '').trim();
      if (!banco) {
        throw new BadRequestException(
          `El banco es obligatorio en el pago #${idx + 1}`,
        );
      }

      const fecha = String(p.fecha_pago || '').slice(0, 10);
      if (!fecha) {
        throw new BadRequestException(
          `La fecha de pago es obligatoria en el pago #${idx + 1}`,
        );
      }

      const esTarjeta =
        metodo === 'Tarjeta de débito' ||
        metodo === 'Tarjeta de crédito' ||
        metodo === 'debito' ||
        metodo === 'credito';

      const terminacion = String(p.terminacion_tarjeta || '').trim();
      if (esTarjeta && !/^\d{4}$/.test(terminacion)) {
        throw new BadRequestException(
          `Por seguridad, únicamente deben registrarse los últimos 4 dígitos de la tarjeta en el pago #${idx + 1}`,
        );
      }

      const referencia = String(p.referencia || '').trim();
      if (!esTarjeta && !referencia) {
        throw new BadRequestException(
          `El número o referencia de operación es obligatorio en el pago #${idx + 1}`,
        );
      }

      return {
        metodo_pago: metodo,
        importe,
        banco,
        fecha_pago: fecha,
        terminacion_tarjeta: esTarjeta ? terminacion : undefined,
        referencia: referencia || undefined,
      };
    });
  }

  private validarFechaActual(fecha: string) {
    const hoy = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Mexico_City',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    if (fecha < hoy) {
      throw new BadRequestException(
        'La fecha de entrada no puede ser anterior a la fecha actual',
      );
    }
  }

  private normalizarHuesped(data: any): Partial<Huesped> {
    const nombre = String(data.nombre || '').trim();
    const apellidoPaterno = String(data.apellidoPaterno || '').trim();
    const telefono = String(data.telefono || '').trim();
    if (!nombre || !apellidoPaterno || !telefono) {
      throw new BadRequestException(
        'Nombre, apellido paterno y teléfono del huésped son obligatorios',
      );
    }
    return {
      nombre,
      apellidoPaterno,
      apellidoMaterno: String(data.apellidoMaterno || '').trim() || undefined,
      telefono,
      correo: String(data.correo || '').trim() || undefined,
      direccion: String(data.direccion || '').trim() || undefined,
      identificacion: String(data.identificacion || '').trim() || undefined,
    };
  }
}
