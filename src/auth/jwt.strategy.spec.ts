import { JwtStrategy } from './jwt.strategy';
import { UnauthorizedException } from '@nestjs/common';

describe('Roles actuales en cada petición', () => {
  it('usa el rol vigente en MySQL aunque el JWT todavía indique Superadministrador', async () => {
    const strategy = new JwtStrategy(
      { getOrThrow: () => 'test-only-secret' } as any,
      {
        findOne: async () => ({
          id: 1,
          activo: true,
          usuario: 'admin',
          rol: { activo: true, nombre: 'Administrador' },
        }),
      } as any,
    );
    expect(
      await strategy.validate({ sub: 1, rol: 'Superadministrador' }),
    ).toEqual({ id: 1, usuario: 'admin', rol: 'Administrador' });
  });
  it.each([null, { activo: false }, { activo: true, rol: { activo: false } }])(
    'rechaza cuenta o rol inactivo/ausente: %p',
    async (usuario) => {
      const strategy = new JwtStrategy(
        { getOrThrow: () => 'test-only-secret' } as any,
        { findOne: async () => usuario } as any,
      );
      await expect(strategy.validate({ sub: 1 })).rejects.toThrow(
        UnauthorizedException,
      );
    },
  );
});
