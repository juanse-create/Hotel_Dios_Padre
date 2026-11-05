import {
  BadRequestException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../common/guards/roles.guard';
import { CortesiasController } from './cortesias.controller';
import { porcentajeValido, validarCortesia } from './cortesias';
import { ReservacionesController } from './reservaciones.controller';

function contexto(controller: any, handler: any, rol?: string): any {
  return {
    getClass: () => controller,
    getHandler: () => handler,
    switchToHttp: () => ({
      getRequest: () => ({ user: rol ? { rol } : undefined }),
    }),
  };
}

describe('Permisos de cortesías e herencia administrativa', () => {
  const guard = new RolesGuard(new Reflector());
  it.each(['Administrador', 'Superadministrador'])(
    '%s conserva acceso a reservaciones y lectura del límite',
    (rol) => {
      expect(
        guard.canActivate(
          contexto(
            ReservacionesController,
            ReservacionesController.prototype.create,
            rol,
          ),
        ),
      ).toBe(true);
      expect(
        guard.canActivate(
          contexto(
            CortesiasController,
            CortesiasController.prototype.obtener,
            rol,
          ),
        ),
      ).toBe(true);
    },
  );
  it.each(['Administrador', 'Camarista', 'Taquilla', undefined])(
    'rechaza cambio del límite por %s',
    (rol) => {
      expect(() =>
        guard.canActivate(
          contexto(
            CortesiasController,
            CortesiasController.prototype.actualizar,
            rol,
          ),
        ),
      ).toThrow(ForbiddenException);
    },
  );
  it('permite exclusivamente al Superadministrador cambiar el límite', () => {
    expect(
      guard.canActivate(
        contexto(
          CortesiasController,
          CortesiasController.prototype.actualizar,
          'Superadministrador',
        ),
      ),
    ).toBe(true);
  });
  it.each(['Camarista', 'Taquilla', undefined])(
    'conserva restricciones de reservaciones para %s',
    (rol) => {
      expect(() =>
        guard.canActivate(
          contexto(
            ReservacionesController,
            ReservacionesController.prototype.create,
            rol,
          ),
        ),
      ).toThrow(ForbiddenException);
    },
  );
});

describe('Validación estricta de porcentajes', () => {
  it.each([
    -1,
    100.01,
    44444444,
    1.001,
    NaN,
    Infinity,
    -Infinity,
    null,
    undefined,
    '',
    '20',
    true,
    {},
    [],
  ])('rechaza %p', (valor) => {
    expect(() => porcentajeValido(valor)).toThrow(BadRequestException);
  });
  it.each([0, 0.01, 10.25, 100])('acepta %p', (valor) =>
    expect(porcentajeValido(valor)).toBe(valor),
  );
  it.each([0, 19.99, 20])(
    'autoriza %p hasta el límite inclusive',
    async (valor) => {
      const manager = {
        query: jest.fn().mockResolvedValue([{ maximo_porcentaje: '20.00' }]),
      };
      expect(await validarCortesia(manager as any, valor)).toBe(valor);
      expect(manager.query).toHaveBeenCalledWith(
        expect.stringContaining('FOR UPDATE'),
      );
    },
  );
  it('rechaza exceso y configuración ausente', async () => {
    await expect(
      validarCortesia(
        { query: async () => [{ maximo_porcentaje: 20 }] } as any,
        20.01,
      ),
    ).rejects.toThrow(BadRequestException);
    await expect(
      validarCortesia({ query: async () => [] } as any, 0),
    ).rejects.toThrow(ServiceUnavailableException);
  });
  it('guarda el nuevo límite parametrizado', async () => {
    const db = { query: jest.fn().mockResolvedValue({ affectedRows: 1 }) };
    expect(
      await new CortesiasController(db as any).actualizar({
        maximoPorcentaje: 15.25,
      }),
    ).toEqual({ maximoPorcentaje: 15.25 });
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE configuracion_cortesias'),
      [15.25],
    );
  });
});
