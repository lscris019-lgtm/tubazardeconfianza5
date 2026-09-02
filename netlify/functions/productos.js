import { getDatabase } from "@netlify/database";
import { getStore } from "@netlify/blobs";

export default async (req) => {
    try {
        const db = getDatabase();
        const store = getStore("ropa");

        /* ==========================================
           GET - OBTENER TODAS LAS PRENDAS
        ========================================== */

        if (req.method === "GET") {
            const resultado = await db.sql`
                SELECT
                    id,
                    foto,
                    descripcion,
                    precio,
                    categoria,
                    estado,
                    fecha
                FROM productos
                ORDER BY id DESC
            `;

            return respuestaJSON(resultado);
        }

        /* ==========================================
           POST - AGREGAR PRENDA
        ========================================== */

        if (req.method === "POST") {
            const formData = await req.formData();

            const descripcion = formData.get("descripcion");
            const precio = formData.get("precio");
            const categoria = formData.get("categoria");
            const estado = formData.get("estado");
            const archivo = formData.get("foto");

            if (
                !descripcion ||
                !precio ||
                !categoria ||
                !estado
            ) {
                return respuestaError(
                    "Todos los campos son obligatorios.",
                    400
                );
            }

            /* Validar estado */
            const estadosPermitidos = [
                "disponible",
                "apartado",
                "comprado"
            ];

            if (!estadosPermitidos.includes(estado)) {
                return respuestaError(
                    "El estado seleccionado no es válido.",
                    400
                );
            }

            /* Validar precio */
            const precioNumero = Number(precio);

            if (
                !Number.isFinite(precioNumero) ||
                precioNumero < 0
            ) {
                return respuestaError(
                    "El precio no es válido.",
                    400
                );
            }

            let nombreFoto = null;

            /*
             * FECHA
             *
             * Al crear una prenda nueva, la fecha siempre
             * se toma del servidor (fecha del "computador"),
             * nunca se recibe desde el formulario.
             */

            const fecha =
                new Date().toISOString().slice(0, 10);

            /* ==========================================
               GUARDAR IMAGEN EN NETLIFY BLOBS
            ========================================== */

            if (
                archivo &&
                typeof archivo !== "string" &&
                archivo.size > 0
            ) {
                if (!archivo.type.startsWith("image/")) {
                    return respuestaError(
                        "El archivo seleccionado no es una imagen.",
                        400
                    );
                }

                nombreFoto = crearNombreImagen(
                    archivo.name
                );

                const buffer =
                    await archivo.arrayBuffer();

                await store.set(
                    nombreFoto,
                    buffer,
                    {
                        metadata: {
                            contentType: archivo.type
                        }
                    }
                );
            }

            /* ==========================================
               INSERTAR PRODUCTO
            ========================================== */

            const resultado = await db.sql`
                INSERT INTO productos
                (
                    foto,
                    descripcion,
                    precio,
                    categoria,
                    estado,
                    fecha
                )
                VALUES
                (
                    ${nombreFoto},
                    ${descripcion},
                    ${precioNumero},
                    ${categoria},
                    ${estado},
                    ${fecha}
                )
                RETURNING
                    id,
                    foto,
                    descripcion,
                    precio,
                    categoria,
                    estado,
                    fecha
            `;

            return respuestaJSON(
                resultado[0],
                201
            );
        }

        /* ==========================================
           PUT - EDITAR PRENDA
        ========================================== */

        if (req.method === "PUT") {
            const formData = await req.formData();

            const id = Number(
                formData.get("id")
            );

            if (!id) {
                return respuestaError(
                    "ID inválido.",
                    400
                );
            }

            const descripcion =
                formData.get("descripcion");

            const precio =
                formData.get("precio");

            const categoria =
                formData.get("categoria");

            const estado =
                formData.get("estado");

            const archivo =
                formData.get("foto");

            /* Validar campos */

            if (
                !descripcion ||
                !precio ||
                !categoria ||
                !estado
            ) {
                return respuestaError(
                    "Todos los campos son obligatorios.",
                    400
                );
            }

            const estadosPermitidos = [
                "disponible",
                "apartado",
                "comprado"
            ];

            if (!estadosPermitidos.includes(estado)) {
                return respuestaError(
                    "El estado seleccionado no es válido.",
                    400
                );
            }

            const precioNumero = Number(precio);

            if (
                !Number.isFinite(precioNumero) ||
                precioNumero < 0
            ) {
                return respuestaError(
                    "El precio no es válido.",
                    400
                );
            }

            /* ==========================================
               OBTENER PRODUCTO ACTUAL
            ========================================== */

            const actual = await db.sql`
                SELECT
                    foto
                FROM productos
                WHERE id = ${id}
            `;

            if (actual.length === 0) {
                return respuestaError(
                    "La prenda no existe.",
                    404
                );
            }

            let nombreFoto =
                actual[0].foto;

            /* ==========================================
               SI SUBIÓ UNA NUEVA IMAGEN
            ========================================== */

            if (
                archivo &&
                typeof archivo !== "string" &&
                archivo.size > 0
            ) {
                if (!archivo.type.startsWith("image/")) {
                    return respuestaError(
                        "El archivo seleccionado no es una imagen.",
                        400
                    );
                }

                /* Eliminar imagen anterior */

                if (nombreFoto) {
                    try {
                        await store.delete(
                            nombreFoto
                        );
                    } catch (error) {
                        console.error(
                            "No se pudo eliminar la imagen anterior:",
                            error
                        );
                    }
                }

                /* Crear nueva imagen */

                nombreFoto =
                    crearNombreImagen(
                        archivo.name
                    );

                const buffer =
                    await archivo.arrayBuffer();

                await store.set(
                    nombreFoto,
                    buffer,
                    {
                        metadata: {
                            contentType:
                                archivo.type
                        }
                    }
                );
            }

            /* ==========================================
               ACTUALIZAR PRODUCTO
            ========================================== */

            /*
             * La fecha NUNCA se modifica al editar una
             * prenda: solo se asigna una vez, al crearla.
             */

            const resultado = await db.sql`
                UPDATE productos
                SET
                    foto = ${nombreFoto},
                    descripcion = ${descripcion},
                    precio = ${precioNumero},
                    categoria = ${categoria},
                    estado = ${estado}
                WHERE id = ${id}
                RETURNING
                    id,
                    foto,
                    descripcion,
                    precio,
                    categoria,
                    estado,
                    fecha
            `;

            return respuestaJSON(
                resultado[0]
            );
        }

        /* ==========================================
           DELETE - ELIMINAR PRENDA
        ========================================== */

        if (req.method === "DELETE") {
            const body = await req.json();

            const id = Number(body.id);

            if (!id) {
                return respuestaError(
                    "ID inválido.",
                    400
                );
            }

            /* ==========================================
               OBTENER IMAGEN
            ========================================== */

            const actual = await db.sql`
                SELECT
                    foto
                FROM productos
                WHERE id = ${id}
            `;

            if (actual.length === 0) {
                return respuestaError(
                    "La prenda no existe.",
                    404
                );
            }

            const nombreFoto =
                actual[0].foto;

            /* ==========================================
               ELIMINAR PRODUCTO
            ========================================== */

            await db.sql`
                DELETE FROM productos
                WHERE id = ${id}
            `;

            /* ==========================================
               ELIMINAR IMAGEN
            ========================================== */

            if (nombreFoto) {
                try {
                    await store.delete(
                        nombreFoto
                    );
                } catch (error) {
                    console.error(
                        "No se pudo eliminar la imagen:",
                        error
                    );
                }
            }

            return respuestaJSON({
                mensaje:
                    "Producto eliminado correctamente."
            });
        }

        /* ==========================================
           MÉTODO NO PERMITIDO
        ========================================== */

        return respuestaError(
            "Método no permitido.",
            405
        );

    } catch (error) {
        console.error(
            "Error en productos.js:",
            error
        );

        const detalle =
            error?.cause?.message ||
            error?.message ||
            String(error);

        return respuestaError(
            `Error interno del servidor: ${detalle}`,
            500
        );
    }
};


/* ==========================================
   CREAR NOMBRE DE IMAGEN
========================================== */

function crearNombreImagen(
    nombreOriginal
) {
    const extension =
        nombreOriginal
            .split(".")
            .pop()
            .toLowerCase();

    const nombre =
        `${Date.now()}-${crypto.randomUUID()}.${extension}`;

    return `prendas/${nombre}`;
}


/* ==========================================
   RESPUESTA JSON
========================================== */

function respuestaJSON(
    datos,
    status = 200
) {
    return new Response(
        JSON.stringify(datos),
        {
            status,
            headers: {
                "Content-Type":
                    "application/json"
            }
        }
    );
}


/* ==========================================
   RESPUESTA DE ERROR
========================================== */

function respuestaError(
    mensaje,
    status
) {
    return respuestaJSON(
        {
            error: mensaje
        },
        status
    );
}