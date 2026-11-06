-- ============================================================================
-- DATOS DE PRUEBA SOLO PARA DESARROLLO LOCAL
-- Este script NUNCA debe ejecutarse contra la base de producción (Supabase).
-- Está pensado para correrse a mano en pgAdmin, conectado a la base local
-- "volare_dev", para poder ver la landing pública con contenido de ejemplo.
-- ============================================================================

-- Busca al admin de prueba por su correo (no se escriben ids a mano).
-- Si no existe ningún usuario con este correo, los INSERT siguientes no
-- insertarán nada (la subconsulta no devuelve filas) y no habrá error.
DO $$
DECLARE
    admin_id TEXT;
BEGIN
    SELECT id INTO admin_id FROM "User" WHERE email = 'adminprueba@gmail.com';

    IF admin_id IS NULL THEN
        RAISE NOTICE 'No se encontró ningún usuario con email adminprueba@gmail.com. No se insertó ningún post.';
        RETURN;
    END IF;

    -- 1) Público y en carrusel, con imagen — DEBE salir en /api/landing/carrusel y /noticias
    INSERT INTO "Post" (id, titulo, descripcion, tipo, "imagenUrl", "archivoUrl", estado, "creadoEn", "autorId", publico, "enCarrusel", "publicadoPorId", "publicadoEn")
    VALUES (
        gen_random_uuid(), 'Bazar navideño comunitario', 'Este sábado 14 de diciembre en la Casa Club, de 10am a 4pm. Habrá emprendimientos de residentes, comida y música en vivo.', 'AVISO',
        ARRAY['https://images.unsplash.com/photo-1512909006721-3d6018887383?w=800'], ARRAY[]::TEXT[], 'ACTIVO', now(), admin_id,
        true, true, admin_id, now()
    );

    -- 2) Público y en carrusel, con imagen — DEBE salir
    INSERT INTO "Post" (id, titulo, descripcion, tipo, "imagenUrl", "archivoUrl", estado, "creadoEn", "autorId", publico, "enCarrusel", "publicadoPorId", "publicadoEn")
    VALUES (
        gen_random_uuid(), 'Avance de obra: cancha múltiple', 'Terminamos la segunda etapa de la cancha múltiple. Queda pendiente la instalación de luminarias para el próximo mes.', 'OBRA',
        ARRAY['https://images.unsplash.com/photo-1526676537331-7747bf8278fc?w=800'], ARRAY[]::TEXT[], 'ACTIVO', now(), admin_id,
        true, true, admin_id, now()
    );

    -- 3) Público y en carrusel, con imagen — DEBE salir
    INSERT INTO "Post" (id, titulo, descripcion, tipo, "imagenUrl", "archivoUrl", estado, "creadoEn", "autorId", publico, "enCarrusel", "publicadoPorId", "publicadoEn")
    VALUES (
        gen_random_uuid(), 'Nuevas áreas verdes en la entrada principal', 'Se sembraron especies nativas en el ingreso de la urbanización como parte del plan de paisajismo 2026.', 'COMUNICADO',
        ARRAY['https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800'], ARRAY[]::TEXT[], 'ACTIVO', now(), admin_id,
        true, true, admin_id, now()
    );

    -- 4) Público, SIN imagen — debe salir en /noticias, NUNCA en /carrusel
    INSERT INTO "Post" (id, titulo, descripcion, tipo, "imagenUrl", "archivoUrl", estado, "creadoEn", "autorId", publico, "enCarrusel", "publicadoPorId", "publicadoEn")
    VALUES (
        gen_random_uuid(), 'Corte de agua programado', 'El miércoles 18 de noviembre, de 8am a 1pm, por mantenimiento de la red principal. Se recomienda almacenar agua con anticipación.', 'COMUNICADO',
        ARRAY[]::TEXT[], ARRAY[]::TEXT[], 'ACTIVO', now(), admin_id,
        true, false, admin_id, now()
    );

    -- 5) CONTROL — privado, con imagen — NO debe salir en ningún endpoint público
    INSERT INTO "Post" (id, titulo, descripcion, tipo, "imagenUrl", "archivoUrl", estado, "creadoEn", "autorId", publico, "enCarrusel", "publicadoPorId", "publicadoEn")
    VALUES (
        gen_random_uuid(), 'Borrador interno: propuesta de reglamento de mascotas', 'Texto en revisión, todavía no aprobado para publicar. Uso interno del comité.', 'COMUNICADO',
        ARRAY['https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=800'], ARRAY[]::TEXT[], 'ACTIVO', now(), admin_id,
        false, false, NULL, NULL
    );

    -- 6) CONTROL — público pero con estado distinto de ACTIVO — NO debe salir en ningún endpoint público
    INSERT INTO "Post" (id, titulo, descripcion, tipo, "imagenUrl", "archivoUrl", estado, "creadoEn", "autorId", publico, "enCarrusel", "publicadoPorId", "publicadoEn")
    VALUES (
        gen_random_uuid(), 'Evento de integración (cancelado)', 'Este evento fue cancelado y el post se desactivó, pero quedó marcado como público por error humano — sirve para probar que estado manda sobre publico.', 'AVISO',
        ARRAY['https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=800'], ARRAY[]::TEXT[], 'INACTIVO', now(), admin_id,
        true, true, admin_id, now()
    );

    RAISE NOTICE 'Se insertaron 6 posts de prueba para el admin %', admin_id;
END $$;
