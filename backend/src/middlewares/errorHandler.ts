import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

// Clase de error personalizada: nos permite lanzar errores con un
// código HTTP específico desde cualquier controlador.
export class AppError extends Error {
  public statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

// Forma mínima que comparten los errores que lanza el motor de Prisma.
// Se usa "duck typing" (revisar .name/.code) en vez de "instanceof
// Prisma.PrismaClientKnownRequestError" a propósito: ese instanceof solo
// funciona de forma confiable si el cliente de Prisma quedó generado con
// exactamente la misma versión del runtime en todo el proyecto, algo que
// no siempre se puede garantizar. Revisar .name/.code es la forma más
// robusta y es un patrón recomendado también por la propia comunidad de
// Prisma para estos casos.
interface ErrorConNombreYCodigo {
  name?: string;
  code?: string;
  meta?: { target?: string[] };
}

function esErrorPrismaConocido(err: unknown): err is ErrorConNombreYCodigo {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as ErrorConNombreYCodigo).name === "PrismaClientKnownRequestError"
  );
}

function esErrorConexionPrisma(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const nombre = (err as ErrorConNombreYCodigo).name;
  return (
    nombre === "PrismaClientInitializationError" ||
    nombre === "PrismaClientRustPanicError"
  );
}

// Middleware de errores de Express: SIEMPRE recibe 4 parámetros
// (err, req, res, next). Express lo detecta por esa firma y lo ejecuta
// cuando algo llama a next(error) o se lanza una excepción en una ruta
// async envuelta en catchAsync.
//
// CORRECCIÓN: antes, cualquier error que no fuera un AppError (por ejemplo,
// un error de validación de Zod, o un error real de la base de datos como
// una violación de llave única o una caída de conexión) caía siempre en el
// bloque genérico de abajo y respondía 500 "Error interno del servidor",
// sin ninguna pista de qué había fallado. Eso hacía muy difícil depurar
// errores de base de datos y también hacía que el frontend mostrara
// mensajes de error inútiles. Ahora se reconocen explícitamente los tres
// tipos de error más comunes en este proyecto.
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  console.error("[ERROR]", err);

  // 1) Errores de negocio lanzados a propósito desde los services/controllers
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      ok: false,
      mensaje: err.message,
    });
  }

  // 2) Errores de validación de Zod (datos con formato incorrecto en el body)
  if (err instanceof ZodError) {
    return res.status(400).json({
      ok: false,
      mensaje: "Datos inválidos",
      errores: err.issues.map((issue) => ({
        campo: issue.path.join("."),
        mensaje: issue.message,
      })),
    });
  }

  // 3) Errores conocidos de Prisma (violaciones de la base de datos)
  if (esErrorPrismaConocido(err)) {
    switch (err.code) {
      case "P2002": // violación de índice único (ej: nombre de categoría repetido)
        return res.status(409).json({
          ok: false,
          mensaje: `Ya existe un registro con ese valor único (${
            err.meta?.target?.join(", ") ?? "campo duplicado"
          })`,
        });
      case "P2003": // violación de llave foránea (ej: categoriaId que no existe)
        return res.status(400).json({
          ok: false,
          mensaje: "La operación hace referencia a un registro relacionado que no existe",
        });
      case "P2025": // registro no encontrado (ej: update/delete sobre un id inexistente)
        return res.status(404).json({
          ok: false,
          mensaje: "El registro solicitado no existe",
        });
      default:
        return res.status(400).json({
          ok: false,
          mensaje: `Error de base de datos (${err.code ?? "desconocido"})`,
        });
    }
  }

  // 4) Prisma no logró conectarse a PostgreSQL (servidor apagado, credenciales
  //    incorrectas en DATABASE_URL, base de datos inexistente, etc.)
  if (esErrorConexionPrisma(err)) {
    return res.status(503).json({
      ok: false,
      mensaje:
        "No se pudo conectar con la base de datos. Verifica que PostgreSQL esté " +
        "encendido y que DATABASE_URL en tu archivo .env sea correcto.",
    });
  }

  // 5) Error no controlado (bug real)
  return res.status(500).json({
    ok: false,
    mensaje: "Error interno del servidor",
  });
}

// Helper para no repetir try/catch en cada controlador async.
// Envuelve la función y si esta rechaza (throw dentro de un async),
// automáticamente llama a next(error), que termina en errorHandler.
export function catchAsync(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}
