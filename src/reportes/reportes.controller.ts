import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import PDFDocument from 'pdfkit';
import { existsSync } from 'fs';
import { join } from 'path';
import { DataSource } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('reportes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Administrador')
export class ReportesController {
  constructor(private readonly dataSource: DataSource) {}

  @Get('dashboard')
  async dash() {
    const estados = await this.dataSource.query(
      'SELECT e.nombre, COUNT(h.id) total FROM estados_habitacion e LEFT JOIN habitaciones h ON h.estado_id=e.id AND h.activa=1 GROUP BY e.id ORDER BY e.id',
    );
    const [reservaciones] = await this.dataSource.query(
      "SELECT COUNT(*) total FROM reservaciones WHERE estado='Confirmada'",
    );
    const [ocupacion] = await this.dataSource.query(
      "SELECT ROUND(100*SUM(e.nombre='Ocupada')/NULLIF(COUNT(h.id),0),2) porcentaje FROM habitaciones h JOIN estados_habitacion e ON e.id=h.estado_id WHERE h.activa=1",
    );

    return {
      estados,
      reservacionesConfirmadas: Number(reservaciones?.total || 0),
      porcentajeOcupacion: Number(ocupacion?.porcentaje || 0),
    };
  }

  @Get('ocupacion')
  async ocupacion(
    @Query('inicio') inicio?: string,
    @Query('fin') fin?: string,
  ) {
    const { clause, params } = this.rango(inicio, fin, 'fecha_inicio');
    const resultado = await this.dataSource.query(
      `SELECT DATE(fecha_inicio) fecha, COUNT(*) reservaciones, SUM(adultos+menores) huespedes FROM reservaciones WHERE estado IN ('Confirmada','Finalizada') ${clause} GROUP BY DATE(fecha_inicio) ORDER BY fecha DESC`,
      params,
    );
    return this.filas(resultado);
  }

  @Get(['pdf', 'pdf-ganancias'])
  async pdf(
    @Query('inicio') inicio: string,
    @Query('fin') fin: string,
    @Res() response: Response,
  ) {
    this.rango(inicio, fin);
    const [ocupacion, tiposHabitacion, ingresosPorDia] = await Promise.all([
      this.ocupacion(inicio, fin),
      this.tiposHabitacion(inicio, fin),
      this.ingresosPorDia(inicio, fin),
    ]);
    const archivo = await this.crearPdf(
      inicio,
      fin,
      ocupacion,
      tiposHabitacion,
      ingresosPorDia,
    );
    response.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="reporte-hotel-${inicio}-${fin}-ingresos.pdf"`,
      'Content-Length': String(archivo.length),
      'X-Report-Version': 'tipos-ganancias-v2',
    });
    response.end(archivo);
  }

  @Get(['tipos-habitacion', 'habitaciones-utilizadas'])
  async tiposHabitacion(
    @Query('inicio') inicio?: string,
    @Query('fin') fin?: string,
  ) {
    const { clause, params } = this.rango(inicio, fin, 'r.fecha_inicio');
    const resultado = await this.dataSource.query(
      `SELECT COALESCE(th.nombre, 'Sin tipo') tipo,
              COUNT(*) usos,
              SUM(GREATEST(DATEDIFF(r.fecha_fin, r.fecha_inicio), 1)) dias,
              ROUND(SUM(COALESCE(NULLIF(rh.precio, 0), th.precio, 0) * GREATEST(DATEDIFF(r.fecha_fin, r.fecha_inicio), 1) * (1 - r.cortesia_porcentaje / 100)), 2) ganancias
       FROM reservacion_habitaciones rh
       JOIN habitaciones h ON h.id=rh.habitacion_id
       LEFT JOIN tipos_habitacion th ON th.id=h.tipo_id
       JOIN reservaciones r ON r.id=rh.reservacion_id
       WHERE r.estado IN ('Confirmada','Finalizada') ${clause}
       GROUP BY th.id, th.nombre
       ORDER BY usos DESC, tipo ASC`,
      params,
    );
    return this.filas(resultado);
  }

  private filas(valor: any): any[] {
    if (Array.isArray(valor)) return valor;
    if (Array.isArray(valor?.data)) return valor.data;
    if (Array.isArray(valor?.rows)) return valor.rows;
    return valor && typeof valor === 'object' ? [valor] : [];
  }

  @Get('ingresos-por-dia')
  async ingresosPorDia(
    @Query('inicio') inicio?: string,
    @Query('fin') fin?: string,
  ) {
    this.rango(inicio, fin);
    const resultado = await this.dataSource.query(
      `WITH RECURSIVE dias_reserva AS (
         SELECT rh.id enlace_id,
                r.fecha_inicio dia,
                r.fecha_fin,
                COALESCE(NULLIF(rh.precio, 0), th.precio, 0) * (1 - r.cortesia_porcentaje / 100) precio
         FROM reservacion_habitaciones rh
         JOIN habitaciones h ON h.id=rh.habitacion_id
         LEFT JOIN tipos_habitacion th ON th.id=h.tipo_id
         JOIN reservaciones r ON r.id=rh.reservacion_id
         WHERE r.estado IN ('Confirmada','Finalizada')
           AND r.fecha_inicio <= ?
           AND r.fecha_fin > ?
         UNION ALL
         SELECT enlace_id,
                DATE_ADD(dia, INTERVAL 1 DAY),
                fecha_fin,
                precio
         FROM dias_reserva
         WHERE DATE_ADD(dia, INTERVAL 1 DAY) < fecha_fin
       )
       SELECT dia,
              COUNT(*) habitaciones,
              ROUND(SUM(precio), 2) ganancias
       FROM dias_reserva
       WHERE dia BETWEEN ? AND ?
       GROUP BY dia
       ORDER BY ganancias DESC, dia ASC`,
      [fin, inicio, inicio, fin],
    );
    return this.filas(resultado);
  }

  private rango(inicio?: string, fin?: string, campo = 'fecha_inicio') {
    if (!inicio && !fin) return { clause: '', params: [] };
    if (
      !inicio ||
      !fin ||
      !/^\d{4}-\d{2}-\d{2}$/.test(inicio) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(fin)
    ) {
      throw new BadRequestException('Selecciona un rango de fechas válido');
    }
    if (inicio > fin)
      throw new BadRequestException(
        'La fecha inicial debe ser anterior o igual a la final',
      );
    return { clause: `AND ${campo} BETWEEN ? AND ?`, params: [inicio, fin] };
  }

  private crearPdf(
    inicio: string,
    fin: string,
    ocupacion: any[],
    tiposHabitacion: any[],
    ingresosPorDia: any[],
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const partes: Buffer[] = [];
      doc.on('data', (parte: Buffer) => partes.push(parte));
      doc.on('end', () => resolve(Buffer.concat(partes)));
      doc.on('error', reject);

      const logo = join(
        __dirname,
        '..',
        '..',
        'public',
        'hotel-ixmiquilpan.png',
      );
      if (existsSync(logo)) doc.image(logo, 40, 28, { fit: [88, 58] });
      doc.fillColor('#0f4c81').fontSize(21).font('Helvetica-Bold');
      doc.text('HOTEL DIOS PADRE', 145, 36);
      doc.fillColor('#475569').fontSize(10).font('Helvetica');
      doc.text('Ixmiquilpan, Hidalgo', 145, 64);
      doc
        .moveTo(40, 98)
        .lineTo(555, 98)
        .strokeColor('#0f4c81')
        .lineWidth(2)
        .stroke();

      doc.fillColor('#0f172a').fontSize(17).font('Helvetica-Bold');
      doc.text('Reporte de ocupación', 40, 115);
      doc.fontSize(10).font('Helvetica').fillColor('#475569');
      doc.text(`Periodo: ${inicio} al ${fin}`, 40, 140);
      doc.text(
        `Generado: ${new Intl.DateTimeFormat('es-MX', {
          dateStyle: 'long',
          timeStyle: 'short',
          timeZone: 'America/Mexico_City',
        }).format(new Date())}`,
        40,
        156,
      );

      const totalReservaciones = ocupacion.reduce(
        (suma, fila) => suma + Number(fila.reservaciones || 0),
        0,
      );
      const totalHuespedes = ocupacion.reduce(
        (suma, fila) => suma + Number(fila.huespedes || 0),
        0,
      );
      const gananciasTotales = tiposHabitacion.reduce(
        (suma, fila) => suma + Number(fila.ganancias || 0),
        0,
      );
      doc.roundedRect(40, 182, 161, 62, 6).fillAndStroke('#eff6ff', '#bfdbfe');
      doc.roundedRect(217, 182, 161, 62, 6).fillAndStroke('#f0fdf4', '#bbf7d0');
      doc.roundedRect(394, 182, 161, 62, 6).fillAndStroke('#fffbeb', '#fde68a');
      doc
        .fillColor('#1e3a8a')
        .fontSize(9)
        .font('Helvetica')
        .text('RESERVACIONES', 55, 194);
      doc
        .fontSize(22)
        .font('Helvetica-Bold')
        .text(String(totalReservaciones), 55, 208);
      doc
        .fillColor('#166534')
        .fontSize(9)
        .font('Helvetica')
        .text('HUÉSPEDES', 232, 194);
      doc
        .fontSize(22)
        .font('Helvetica-Bold')
        .text(String(totalHuespedes), 232, 208);
      doc
        .fillColor('#92400e')
        .fontSize(9)
        .font('Helvetica')
        .text('GANANCIAS TOTALES', 409, 194);
      doc
        .fontSize(16)
        .font('Helvetica-Bold')
        .text(this.dinero(gananciasTotales), 409, 211, {
          width: 131,
        });

      let y = 271;
      let tablaActual: {
        titulo: string;
        columnas: string[];
        anchos: number[];
      } | null = null;
      const agregarPie = () => {
        doc.fontSize(8).fillColor('#64748b').font('Helvetica');
        doc.text(
          'Hotel Dios Padre · Reporte generado por el panel administrativo',
          40,
          790,
          {
            align: 'center',
            width: 515,
            lineBreak: false,
          },
        );
      };
      const nuevaPagina = () => {
        agregarPie();
        doc.addPage();
        y = 42;
      };
      const dibujarEncabezado = (
        titulo: string,
        columnas: string[],
        anchos: number[],
        continuacion = false,
      ) => {
        doc
          .fillColor('#0f172a')
          .fontSize(13)
          .font('Helvetica-Bold')
          .text(`${titulo}${continuacion ? ' (continuación)' : ''}`, 40, y);
        y += 23;
        doc.rect(40, y, 515, 22).fill('#0f4c81');
        let x = 46;
        doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold');
        columnas.forEach((columna, indice) => {
          doc.text(columna, x, y + 7, { width: anchos[indice] - 10 });
          x += anchos[indice];
        });
        y += 22;
      };
      const encabezadoTabla = (
        titulo: string,
        columnas: string[],
        anchos: number[],
      ) => {
        if (y > 710) nuevaPagina();
        tablaActual = { titulo, columnas, anchos };
        dibujarEncabezado(titulo, columnas, anchos);
      };
      const filaTabla = (valores: string[], anchos: number[]) => {
        if (y > 755) {
          nuevaPagina();
          if (tablaActual) {
            dibujarEncabezado(
              tablaActual.titulo,
              tablaActual.columnas,
              tablaActual.anchos,
              true,
            );
          }
        }
        doc.rect(40, y, 515, 21).fillAndStroke('#ffffff', '#e2e8f0');
        let x = 46;
        doc.fillColor('#334155').fontSize(9).font('Helvetica');
        valores.forEach((valor, indice) => {
          doc.text(valor, x, y + 6, { width: anchos[indice] - 10 });
          x += anchos[indice];
        });
        y += 21;
      };

      encabezadoTabla(
        'Ocupación por día',
        ['Fecha', 'Reservaciones', 'Huéspedes'],
        [220, 150, 145],
      );
      if (!ocupacion.length)
        filaTabla(['Sin registros', '0', '0'], [220, 150, 145]);
      ocupacion.forEach((fila) =>
        filaTabla(
          [
            this.fechaTexto(fila.fecha),
            String(fila.reservaciones),
            String(fila.huespedes),
          ],
          [220, 150, 145],
        ),
      );

      y += 25;
      encabezadoTabla(
        'Ocupación y ganancias por tipo de habitación',
        ['Tipo', 'Usos', 'Días cobrados', 'Ganancias'],
        [185, 75, 75, 180],
      );
      if (!tiposHabitacion.length) {
        filaTabla(
          ['Sin registros', '0', '0', this.dinero(0)],
          [185, 75, 75, 180],
        );
      }
      tiposHabitacion.forEach((fila) =>
        filaTabla(
          [
            String(fila.tipo),
            String(fila.usos),
            String(fila.dias),
            this.dinero(Number(fila.ganancias || 0)),
          ],
          [185, 75, 75, 180],
        ),
      );

      y += 25;
      encabezadoTabla(
        'Días con mayores ingresos',
        ['Fecha', 'Habitaciones cobradas', 'Ingresos'],
        [185, 150, 180],
      );
      if (!ingresosPorDia.length) {
        filaTabla(['Sin registros', '0', this.dinero(0)], [185, 150, 180]);
      }
      ingresosPorDia.forEach((fila) =>
        filaTabla(
          [
            this.fechaTexto(fila.dia),
            String(fila.habitaciones),
            this.dinero(Number(fila.ganancias || 0)),
          ],
          [185, 150, 180],
        ),
      );

      agregarPie();
      doc.end();
    });
  }

  private fechaTexto(valor: string | Date): string {
    if (valor instanceof Date) {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Mexico_City',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(valor);
    }
    return String(valor).slice(0, 10);
  }

  private dinero(valor: number): string {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2,
    }).format(valor);
  }
}
