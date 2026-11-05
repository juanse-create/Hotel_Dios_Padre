import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Not, Repository } from 'typeorm';
import { Rol } from '../roles/entities/rol.entity';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { Usuario } from './entities/usuario.entity';

@Injectable()
export class UsuariosService {
  constructor(
    @InjectRepository(Usuario)
    private readonly repo: Repository<Usuario>,

    @InjectRepository(Rol)
    private readonly rolesRepo: Repository<Rol>,
  ) {}

  findAll() {
    return this.repo
      .createQueryBuilder('usuario')
      .leftJoinAndSelect('usuario.rol', 'rol')
      .select([
        'usuario.id',
        'usuario.nombre',
        'usuario.apellidoPaterno',
        'usuario.apellidoMaterno',
        'usuario.telefono',
        'usuario.correo',
        'usuario.usuario',
        'usuario.rolId',
        'usuario.activo',
        'rol.id',
        'rol.nombre',
      ])
      .orderBy('usuario.id', 'DESC')
      .getMany();
  }

  findRoles() {
    return this.rolesRepo.find({
      where: {
        activo: true,
      },
      order: {
        nombre: 'ASC',
      },
    });
  }

  private protegerRol(rol: Rol, actorRol?: string) {
    if (
      rol.nombre === 'Superadministrador' &&
      actorRol !== 'Superadministrador'
    ) {
      throw new ForbiddenException(
        'Solo el Superadministrador puede gestionar estas cuentas',
      );
    }
  }

  private async validarRol(rolId: number): Promise<Rol> {
    const rol = await this.rolesRepo.findOne({
      where: {
        id: rolId,
      },
    });

    if (!rol) {
      throw new NotFoundException('El rol seleccionado no existe');
    }

    if (!rol.activo) {
      throw new ConflictException('El rol seleccionado se encuentra inactivo');
    }

    return rol;
  }

  private async validarDuplicados(
    usuario: string,
    correo?: string,
    excluirId?: number,
  ): Promise<void> {
    const usuarioExistente = await this.repo.findOne({
      where: excluirId
        ? {
            usuario,
            id: Not(excluirId),
          }
        : {
            usuario,
          },
    });

    if (usuarioExistente) {
      throw new ConflictException(
        'El nombre de usuario ya se encuentra registrado',
      );
    }

    if (!correo) return;

    const correoExistente = await this.repo.findOne({
      where: excluirId
        ? {
            correo,
            id: Not(excluirId),
          }
        : {
            correo,
          },
    });

    if (correoExistente) {
      throw new ConflictException(
        'El correo electrónico ya se encuentra registrado',
      );
    }
  }

  private limpiarRespuesta(usuario: Usuario) {
    return {
      id: usuario.id,
      nombre: usuario.nombre,
      apellidoPaterno: usuario.apellidoPaterno,
      apellidoMaterno: usuario.apellidoMaterno,
      telefono: usuario.telefono,
      correo: usuario.correo,
      usuario: usuario.usuario,
      rolId: usuario.rolId,
      activo: usuario.activo,
    };
  }

  async create(dto: CreateUsuarioDto, actorRol?: string) {
    this.protegerRol(await this.validarRol(dto.rolId), actorRol);

    await this.validarDuplicados(dto.usuario, dto.correo);

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const nuevoUsuario = this.repo.create({
      nombre: dto.nombre,
      apellidoPaterno: dto.apellidoPaterno ?? null,
      apellidoMaterno: dto.apellidoMaterno ?? null,
      telefono: dto.telefono ?? null,
      correo: dto.correo ?? null,
      usuario: dto.usuario,
      password: passwordHash,
      rolId: dto.rolId,
      activo: dto.activo ?? true,
    });

    const usuarioGuardado = await this.repo.save(nuevoUsuario);

    return {
      message: 'Usuario registrado correctamente',
      usuario: this.limpiarRespuesta(usuarioGuardado),
    };
  }

  async update(id: number, dto: UpdateUsuarioDto, actorRol?: string) {
    const usuario = await this.repo.findOne({
      where: {
        id,
      },
    });

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const usuarioActualizado = dto.usuario ?? usuario.usuario;
    const correoActualizado =
      dto.correo !== undefined ? dto.correo : (usuario.correo ?? undefined);
    const rolIdActualizado = dto.rolId ?? usuario.rolId;

    this.protegerRol(await this.validarRol(usuario.rolId), actorRol);
    this.protegerRol(await this.validarRol(rolIdActualizado), actorRol);

    await this.validarDuplicados(
      usuarioActualizado,
      correoActualizado,
      usuario.id,
    );

    usuario.nombre = dto.nombre ?? usuario.nombre;
    usuario.apellidoPaterno =
      dto.apellidoPaterno !== undefined
        ? dto.apellidoPaterno
        : usuario.apellidoPaterno;
    usuario.apellidoMaterno =
      dto.apellidoMaterno !== undefined
        ? dto.apellidoMaterno
        : usuario.apellidoMaterno;
    usuario.telefono =
      dto.telefono !== undefined ? dto.telefono : usuario.telefono;
    usuario.correo = dto.correo !== undefined ? dto.correo : usuario.correo;
    usuario.usuario = usuarioActualizado;
    usuario.rolId = rolIdActualizado;
    usuario.activo = dto.activo ?? usuario.activo;

    if (dto.password) {
      usuario.password = await bcrypt.hash(dto.password, 10);
    }

    await this.repo.save(usuario);

    return {
      message: 'Usuario actualizado correctamente',
    };
  }

  async toggle(id: number, actorRol?: string) {
    const usuario = await this.repo.findOne({
      where: {
        id,
      },
    });

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    this.protegerRol(await this.validarRol(usuario.rolId), actorRol);
    usuario.activo = !usuario.activo;

    await this.repo.save(usuario);

    return {
      message: usuario.activo
        ? 'Usuario activado correctamente'
        : 'Usuario desactivado correctamente',
      activo: usuario.activo,
    };
  }

  async remove(id: number, actorRol?: string) {
    const usuario = await this.repo.findOne({
      where: {
        id,
      },
    });

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    this.protegerRol(await this.validarRol(usuario.rolId), actorRol);
    if (!usuario.activo) {
      return {
        message: 'El usuario ya se encuentra inactivo',
      };
    }

    usuario.activo = false;

    await this.repo.save(usuario);

    return {
      message: 'Usuario desactivado correctamente',
    };
  }
}
