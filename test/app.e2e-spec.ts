import { NestFactory } from '@nestjs/core';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('Aplicación hotel (e2e con base sintética local)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    if (
      !['127.0.0.1', 'localhost'].includes(process.env.DB_HOST || '') ||
      !/^hotel_cortesias_test_[a-f0-9]{12}$/.test(process.env.DB_NAME || '')
    ) {
      throw new Error(
        'Ejecutar únicamente con el fixture sintético local de cortesías',
      );
    }
    // ServeStatic selecciona el loader durante la creación del módulo: usar el
    // arranque real instala el adaptador HTTP antes de resolver ese proveedor.
    app = await NestFactory.create(AppModule, { logger: false });
    app.setGlobalPrefix('api', { exclude: ['/'] });
    await app.init();
  });

  it('sirve el acceso del hotel con ambos roles administrativos', async () => {
    const response = await request(app.getHttpServer()).get('/').expect(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.text).toContain('id="loginForm"');
    expect(response.text).toContain('value="Administrador"');
    expect(response.text).toContain('value="Superadministrador"');
  });

  it('no permite leer la configuración sin autenticación', () => {
    return request(app.getHttpServer())
      .get('/api/configuracion/cortesias')
      .expect(401);
  });

  afterAll(async () => {
    if (app) await app.close();
  });
});
