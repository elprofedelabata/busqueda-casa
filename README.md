# Mi búsqueda de casa

Herramienta personal para guardar, organizar y comparar anuncios inmobiliarios
seleccionados manualmente.

## Estructura

- `chrome-extension/`: extensión de Chrome que captura el anuncio abierto y
  permite revisar sus datos.
- `data/offers.json`: almacén inicial de ofertas que consumirá la aplicación.
- `docs/`: interfaz web publicada mediante GitHub Pages.
- `docs/hipoteca.html`: simulador hipotecario interactivo, sin dependencias y preparado para GitHub Pages.

## Estado

La extensión extrae anuncios de Idealista, distingue superficie anunciada,
vivienda y garaje/anexos, y actualiza `data/offers.json`. La aplicación web
muestra la selección, sus principales métricas y permite buscar, filtrar,
ordenar y consultar cada ficha.

## Privacidad

El repositorio y el contenido publicado mediante GitHub Pages serán públicos.
No se almacenarán fotografías, teléfonos, nombres de contacto, ubicaciones
exactas, credenciales ni notas personales.
