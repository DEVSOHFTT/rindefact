# Rinde Fact

Plataforma web para la gestión y optimización de rendiciones de cuentas, desarrollada sobre Google Apps Script (GAS) con arquitectura cliente-servidor.

Versión: 2.1.0  
Autor: Devsohftt Studio  
Plataforma: Google Apps Script Web App  

---

## Tabla de Contenidos

1. Descripción General  
2. Características Principales  
3. Inicio Rápido (Desarrollo Local)  
4. Arquitectura del Sistema  
5. Backend (Servidor GAS)  
6. Frontend (Cliente HTML/JS)  
7. Algoritmo de Optimización  
8. Flujo de Datos  
9. Despliegue y Producción  

---

## Descripción General

Rinde Fact es una herramienta diseñada para resolver un problema clásico en entornos administrativos:  
cómo seleccionar un conjunto de comprobantes que maximice el uso de un monto disponible sin superarlo.

El sistema funciona completamente sobre infraestructura serverless de Google, eliminando la necesidad de bases de datos externas o servidores dedicados.

---

## Características Principales

- Gestión de comprobantes: Alta, edición y eliminación de facturas con detalle y monto.  
- Control de tope: Definición estricta de un monto máximo de rendición.  
- Optimización automática: Cálculo de la mejor combinación posible sin exceder el límite.  
- Modo manual: Selección personalizada de comprobantes por parte del usuario.  
- Persistencia local: Uso de localStorage para mantener el estado entre sesiones.  
- Generación de reportes: Impresión formateada lista para uso administrativo.  

---

## Inicio Rápido (Desarrollo Local)

El proyecto utiliza npm y @google/clasp para habilitar un flujo de desarrollo moderno con control de versiones.

### Requisitos

- Node.js >= 18  
- Cuenta de Google con acceso al proyecto GAS  

### Comandos

```bash
# Instalar dependencias
npm install

# Autenticarse en Google
npx clasp login

# Descargar código remoto (opcional)
npm run pull

# Subir cambios locales
npm run push

# Ver logs en tiempo real
npm run logs
```

---

## Arquitectura del Sistema

El proyecto sigue una estructura inspirada en el patrón MVC, separando claramente responsabilidades:

```
rindefact/
├── .clasp.json
├── package.json
├── README.md
│
└── src/
    ├── appsscript.json
    │
    ├── server/
    │   ├── routes.js
    │   └── optimizer.js
    │
    └── client/
        ├── views/
        │   └── layout.html
        ├── styles/
        │   └── global.css.html
        └── scripts/
            └── ui-logic.js.html
```

.clasp.json define rootDir: src, asegurando que solo el código relevante se despliegue a GAS.

---

## Backend (Servidor GAS)

Ubicado en src/server/, ejecutándose sobre el motor V8 de Google.

### routes.js
- doGet(e): Entry point de la Web App  
- include(filename): Inyección de recursos HTML, CSS y JS  

### optimizer.js

calcularMejorCombinacion(facturas, tope, seed)

Devuelve un DTO con la mejor combinación encontrada según restricciones.

---

## Frontend (Cliente HTML/JS)

Ubicado en src/client/, con archivos .html extendidos para compatibilidad con GAS.

### layout.html

Estructura principal. Inyección dinámica de recursos:

<?!= include('client/styles/global.css') ?>
<?!= include('client/scripts/ui-logic.js') ?>

### global.css.html

- Variables globales  
- Personalización de Tailwind  
- Reglas de impresión  

### ui-logic.js.html

- Manejo del estado global  
- Manipulación del DOM  
- Persistencia en localStorage  
- Comunicación con backend (google.script.run)  

---

## Algoritmo de Optimización

El sistema implementa una variante del Problema de la Mochila 0/1 (Knapsack Problem).

### Estrategia

- Backtracking con Branch and Bound

### Optimizaciones aplicadas

- Ordenamiento descendente: prioriza montos altos  
- Poda por exceso: corta ramas inválidas inmediatamente  
- Corte óptimo: detiene ejecución si alcanza el tope exacto  
- Timeout de seguridad: límite de 8000ms para evitar bloqueos  

Nota: Para más de ~45 comprobantes, el sistema puede devolver resultados parciales optimizados.

---

## Flujo de Datos

1. El usuario interactúa con la UI  
2. Se actualiza el estado en memoria  
3. Se persiste en localStorage  
4. Se renderiza el DOM  
5. Se invoca el backend mediante google.script.run  
6. Se bloquea temporalmente la UI  
7. El backend procesa la optimización  
8. Se devuelve el resultado y se actualiza la vista  

---

## Despliegue y Producción

### Configuración

- Permisos definidos en appsscript.json  
- Acceso público anónimo (según configuración)  

### Publicación de nueva versión

1. Ejecutar:

npm run push

2. Ir a Google Apps Script  
3. Implementar → Administrar implementaciones  
4. Editar despliegue actual  
5. Seleccionar Nueva versión  
6. Implementar  

Si no creás una nueva versión, los usuarios seguirán ejecutando código anterior.

---

## Autor

Devsohftt Studio © 2026
