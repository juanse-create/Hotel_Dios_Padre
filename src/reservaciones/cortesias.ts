import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { EntityManager } from 'typeorm';

export function porcentajeValido(value: unknown): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 100 ||
    Math.abs(value * 100 - Math.round(value * 100)) > 1e-8
  ) {
    throw new BadRequestException(
      'El porcentaje debe ser un número entre 0 y 100 con máximo dos decimales',
    );
  }
  return value;
}

// Compartir bloqueo con la actualización del límite evita autorizar con un límite obsoleto.
export async function validarCortesia(
  manager: EntityManager,
  value: unknown,
): Promise<number> {
  const porcentaje = porcentajeValido(value);
  const [config] = await manager.query<
    Array<{ maximo_porcentaje: string | number }>
  >(
    'SELECT maximo_porcentaje FROM configuracion_cortesias WHERE id = 1 FOR UPDATE',
  );
  if (!config)
    throw new ServiceUnavailableException(
      'Falta configurar el límite de cortesías',
    );
  if (porcentaje > Number(config.maximo_porcentaje))
    throw new BadRequestException('La cortesía supera el máximo autorizado');
  return porcentaje;
}
