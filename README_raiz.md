# Rinde Fact

Herramienta web para gestión de rendiciones de cuentas, desarrollada sobre Google Apps Script.

**Versión:** 2.1.0 | **Autor:** Devsohftt Studio | **Plataforma:** Google Apps Script Webapp

---

## Estructura del proyecto

```
rindefact/
│
├── .clasp.json          ← Configuración de CLASP. rootDir apunta a src/
├── .gitignore
├── README.md            ← Este archivo
│
└── src/                 ← Todo lo que CLASP sube a GAS
    ├── appsscript.json  ← Manifiesto del proyecto GAS
    │
    ├── main.gs          ← Entry point servidor: doGet() + include()
    ├── algorithm.gs     ← Algoritmo de optimización combinatoria (backtracking)
    │
    ├── index.html       ← Shell HTML principal (usa scriptlets <?!= include() ?>)
    ├── styles.html      ← Fragmento <style> — incluido en index.html
    └── app.html         ← Fragmento <script> — incluido en index.html
```

### Por qué `src/` y no todo en la raíz

Separar los archivos que van al servidor GAS (`src/`) de los archivos de configuración del repo (`.clasp.json`, `.gitignore`, `README.md`) mantiene la raíz limpia y deja espacio para agregar tests, scripts de build o documentación sin que CLASP los suba por error.

CLASP lee `rootDir: "src"` en `.clasp.json` y solo sube lo que está dentro de esa carpeta.

### Cómo HtmlService resuelve los includes

`HtmlService` resuelve los archivos por **nombre**, no por ruta de filesystem. CLASP sube todo el contenido de `src/` al proyecto GAS como archivos planos (sin estructura de carpetas). Por eso:

```html
<?!= include('styles') ?>   <!-- busca el archivo llamado "styles" en GAS -->
<?!= include('app') ?>      <!-- busca el archivo llamado "app" en GAS    -->
```

...funcionan correctamente aunque localmente estén en `src/styles.html` y `src/app.html`.

---

## Inicio rápido

```bash
# 1. Instalar CLASP globalmente
npm install -g @google/clasp

# 2. Autenticarse con Google
clasp login

# 3. Descargar el proyecto desde GAS
clasp pull

# 4. Desarrollar localmente — editar archivos en src/

# 5. Subir cambios
clasp push

# 6. Ver logs del servidor en tiempo real
clasp logs --watch
```

---

## Documentación completa

Ver [`src/README.md`](src/README.md) para la documentación técnica detallada del sistema, incluyendo arquitectura, descripción de módulos, algoritmo y guía de extensión.

---

*Devsohftt Studio © 2026*
