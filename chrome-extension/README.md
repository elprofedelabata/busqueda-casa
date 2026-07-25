# Mi búsqueda de casa — extensión de Chrome

Primer prototipo para capturar manualmente los datos de un anuncio inmobiliario.

## Instalación

1. Abre `chrome://extensions` en Chrome.
2. Activa **Modo de desarrollador**.
3. Pulsa **Cargar descomprimida**.
4. Selecciona esta carpeta `chrome-extension`.
5. Fija la extensión en la barra de herramientas.

## Uso

1. Abre la ficha de una vivienda en Idealista.
2. Pulsa el icono de la extensión.
3. Revisa y corrige los campos detectados.
4. Pulsa **Descargar ficha JSON**.

La superficie se divide en anunciada, vivienda y garaje/anexos. El extractor
prioriza la ficha técnica para la superficie anunciada y solo utiliza la
descripción para detectar desgloses expresos.

Fotocasa se reconoce como portal, pero su extractor específico todavía no está
implementado. La conexión con GitHub se añadirá después de validar la extracción
con varios anuncios reales.

## Iconos

El diseño original está en `icons/icon-source.svg`. Para regenerar las versiones
PNG usadas por Chrome:

```powershell
python scripts/generate-icons.py
```

## Privacidad y permisos

La extensión utiliza `activeTab` y `scripting`. Solo puede leer la pestaña actual
cuando pulsas su icono. En esta versión no realiza peticiones de red ni almacena
credenciales.
