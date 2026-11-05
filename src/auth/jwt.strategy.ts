import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Usuario } from '../usuarios/entities/usuario.entity';
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }
  async validate(payload: { sub: number }) {
    const usuario = await this.usuarios.findOne({
      where: { id: payload.sub },
      relations: { rol: true },
    });
    if (!usuario?.activo || !usuario.rol?.activo)
      throw new UnauthorizedException();
    return {
      id: usuario.id,
      usuario: usuario.usuario,
      rol: usuario.rol.nombre,
    };
  }
}
