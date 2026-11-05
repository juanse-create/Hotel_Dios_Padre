import { UsuariosService } from './usuarios.service';
import { ForbiddenException } from '@nestjs/common';

describe('Protección de cuentas Superadministrador', () => {
  let repo: any;
  let service: UsuariosService;
  beforeEach(() => {
    repo = {
      findOne: jest.fn().mockResolvedValue({ id: 10, rolId: 9, activo: true }),
      save: jest.fn(),
      create: jest.fn((x) => x),
    };
    const roles = {
      findOne: jest.fn(async ({ where }) => ({
        id: where.id,
        nombre: where.id === 9 ? 'Superadministrador' : 'Administrador',
        activo: true,
      })),
    };
    service = new UsuariosService(repo, roles as any);
  });
  it('impide crear una cuenta privilegiada mediante rolId manipulado', async () => {
    await expect(
      service.create({ rolId: 9 } as any, 'Administrador'),
    ).rejects.toThrow(ForbiddenException);
    expect(repo.save).not.toHaveBeenCalled();
  });
  it('impide ascenderse o ascender a otra cuenta', async () => {
    repo.findOne.mockResolvedValue({ id: 10, rolId: 5, activo: true });
    await expect(
      service.update(10, { rolId: 9 }, 'Administrador'),
    ).rejects.toThrow(ForbiddenException);
    expect(repo.save).not.toHaveBeenCalled();
  });
  it.each([
    { password: 'nueva-clave' },
    { rolId: 5 },
    { activo: false },
    { usuario: 'suplantado' },
  ])('impide modificar cuenta privilegiada: %p', async (dto) => {
    await expect(service.update(10, dto, 'Administrador')).rejects.toThrow(
      ForbiddenException,
    );
    expect(repo.save).not.toHaveBeenCalled();
  });
  it.each(['toggle', 'remove'] as const)(
    'impide %s sobre una cuenta privilegiada',
    async (metodo) => {
      await expect(service[metodo](10, 'Administrador')).rejects.toThrow(
        ForbiddenException,
      );
      expect(repo.save).not.toHaveBeenCalled();
    },
  );
  it('permite al Superadministrador gestionar cuentas privilegiadas', async () => {
    await service.toggle(10, 'Superadministrador');
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ activo: false }),
    );
  });
  it('conserva la gestión administrativa de cuentas normales', async () => {
    repo.findOne.mockResolvedValue({ id: 10, rolId: 5, activo: true });
    await service.toggle(10, 'Administrador');
    expect(repo.save).toHaveBeenCalled();
  });
});
