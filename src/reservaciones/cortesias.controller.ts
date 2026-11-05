import {
  Body,
  Controller,
  Get,
  Patch,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { porcentajeValido } from './cortesias';

@Controller('configuracion/cortesias')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Administrador')
export class CortesiasController {
  constructor(private readonly db: DataSource) {}

  @Get()
  async obtener() {
    const [config] = await this.db.query<
      Array<{ maximo_porcentaje: string | number }>
    >('SELECT maximo_porcentaje FROM configuracion_cortesias WHERE id = 1');
    if (!config)
      throw new ServiceUnavailableException(
        'Falta configurar el límite de cortesías',
      );
    return { maximoPorcentaje: Number(config.maximo_porcentaje) };
  }

  @Patch()
  @Roles('Superadministrador')
  async actualizar(@Body() body: { maximoPorcentaje: number }) {
    const maximo = porcentajeValido(body?.maximoPorcentaje);
    const result = await this.db.query<{ affectedRows: number }>(
      'UPDATE configuracion_cortesias SET maximo_porcentaje = ? WHERE id = 1',
      [maximo],
    );
    if (!result.affectedRows)
      throw new ServiceUnavailableException(
        'Falta configurar el límite de cortesías',
      );
    return { maximoPorcentaje: maximo };
  }
}
