import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UsuarioActual } from '../common/decorators/usuario-actual.decorator';
import { ReservacionesService } from './reservaciones.service';

@Controller('reservaciones')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Administrador') // En este sistema el Administrador también realiza la función de recepción.
export class ReservacionesController {
  constructor(private readonly service: ReservacionesService) {}

  @Get()
  list(@Query('estado') estado?: string) {
    return this.service.list(estado);
  }

  @Get('disponibles')
  disponibles(
    @Query('inicio') inicio: string,
    @Query('fin') fin: string,
    @Query('reservacionId') reservacionId?: string,
  ) {
    return this.service.disponibles(
      inicio,
      fin,
      reservacionId ? Number(reservacionId) : undefined,
    );
  }

  @Post('bloqueo/:id')
  bloquear(@Param('id', ParseIntPipe) id: number) {
    return this.service.bloquearHabitacion(id);
  }

  @Delete('bloqueo/:id')
  desbloquear(@Param('id', ParseIntPipe) id: number) {
    return this.service.desbloquearHabitacion(id);
  }

  @Post()
  create(@Body() data: any, @UsuarioActual() usuario: any) {
    return this.service.create(data, usuario.id);
  }

  @Patch(':id')
  modificar(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: any,
    @UsuarioActual() usuario: any,
  ) {
    return this.service.modificar(id, data, usuario.id);
  }

  @Patch(':id/estado')
  estado(
    @Param('id', ParseIntPipe) id: number,
    @Body('estado') estado: string,
  ) {
    return this.service.estado(id, estado);
  }

  @Delete(':id')
  eliminar(@Param('id', ParseIntPipe) id: number) {
    return this.service.eliminar(id);
  }

  @Post('liberar-expiradas')
  liberar() {
    return this.service.liberarExpiradas();
  }
}
