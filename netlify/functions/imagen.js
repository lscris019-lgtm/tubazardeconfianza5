import { getStore } from "@netlify/blobs";

export default async (req) => {

    try {

        const url =
            new URL(req.url);

        const key =
            url.searchParams.get("key");


        if (!key) {

            return new Response(
                "Falta la imagen",
                {
                    status: 400
                }
            );

        }


        const store =
            getStore("ropa");


        const blob =
            await store.get(
                key,
                {
                    type: "arrayBuffer"
                }
            );


        if (!blob) {

            return new Response(
                "Imagen no encontrada",
                {
                    status: 404
                }
            );

        }


        const extension =
            key.split(".").pop().toLowerCase();


        const tipos = {

            jpg: "image/jpeg",

            jpeg: "image/jpeg",

            png: "image/png",

            webp: "image/webp",

            gif: "image/gif"

        };


        const contentType =
            tipos[extension] ||
            "application/octet-stream";


        return new Response(
            blob,
            {
                status: 200,

                headers: {
                    "Content-Type": contentType,

                    "Cache-Control":
                        "public, max-age=3600"
                }
            }
        );


    } catch (error) {

        console.error(error);

        return new Response(
            "Error al obtener la imagen",
            {
                status: 500
            }
        );

    }

};