import { ReservacionesService } from './reservaciones.service';

describe('ReservacionesService historial visible', () => {
  it('mantiene activas y limita finalizadas o canceladas al día actual', async () => {
    const queryBuilder = {
      leftJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
    const reservaciones = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    } as any;
    const service = new ReservacionesService(
      reservaciones,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await service.list();

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      expect.stringContaining("r.estado IN ('En proceso','Confirmada')"),
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('DATE(r.fecha_fin)=CURDATE()'),
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      expect.stringContaining("CURTIME() < '23:59:00'"),
    );
  });
});

describe('ReservacionesService disponibilidad al editar', () => {
  it('incluye y marca las habitaciones de la reservación actual', async () => {
    const queryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([{ id: 7 }, { id: 8 }]),
    };
    const enlaces = {
      findBy: jest.fn().mockResolvedValue([{ habitacionId: 7 }]),
    } as any;
    const habitaciones = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    } as any;
    const service = new ReservacionesService(
      {} as any,
      enlaces,
      habitaciones,
      {} as any,
      {} as any,
    );

    const resultado = await service.disponibles('2099-07-20', '2099-07-22', 42);

    expect(enlaces.findBy).toHaveBeenCalledWith({ reservacionId: 42 });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('r.id <> :reservacionId'),
      {
        inicio: '2099-07-20',
        fin: '2099-07-22',
        reservacionId: 42,
      },
    );
    expect(resultado).toEqual([
      { id: 7, asignadaActualmente: true },
      { id: 8, asignadaActualmente: false },
    ]);
  });

  it('no permite conservar una habitación que se cruza con otra reservación', async () => {
    const reservaciones = {
      findOneBy: jest.fn().mockResolvedValue({
        id: 42,
        estado: 'Confirmada',
        huespedId: 3,
      }),
    } as any;
    const enlaces = {
      findBy: jest.fn().mockResolvedValue([{ habitacionId: 7, precio: 900 }]),
    } as any;
    const service = new ReservacionesService(
      reservaciones,
      enlaces,
      {} as any,
      {} as any,
      {} as any,
    );
    jest.spyOn(service, 'disponibles').mockResolvedValue([{ id: 8 }] as any);

    await expect(
      service.modificar(
        42,
        {
          fechaInicio: '2099-07-20',
          fechaFin: '2099-07-22',
          habitacionIds: [7],
          pagos: [
            {
              metodo_pago: 'transferencia',
              importe: 100,
              banco: 'Prueba',
              fecha_pago: '2099-07-20',
              referencia: 'TEST',
            },
          ],
        },
        1,
      ),
    ).rejects.toThrow('Una habitación ya no está disponible');
    expect(service.disponibles).toHaveBeenCalledWith(
      '2099-07-20',
      '2099-07-22',
      42,
    );
  });
});
