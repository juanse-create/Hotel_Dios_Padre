import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UsuarioActual } from '../common/decorators/usuario-actual.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { UsuariosService } from './usuarios.service';

@Controller('usuarios')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Administrador')
export class UsuariosController {
  constructor(private readonly service: UsuariosService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get('roles')
  findRoles() {
    return this.service.findRoles();
  }

  @Post()
  create(
    @Body() dto: CreateUsuarioDto,
    @UsuarioActual() actor: { rol: string },
  ) {
    return this.service.create(dto, actor.rol);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUsuarioDto,
    @UsuarioActual() actor: { rol: string },
  ) {
    return this.service.update(id, dto, actor.rol);
  }

  @Patch(':id/estado')
  toggle(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioActual() actor: { rol: string },
  ) {
    return this.service.toggle(id, actor.rol);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioActual() actor: { rol: string },
  ) {
    return this.service.remove(id, actor.rol);
  }
}
