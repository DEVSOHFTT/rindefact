# Rinde Fact

Herramienta web profesional para gestión de rendiciones de cuentas, desarrollada sobre Google Apps Script con arquitectura de cliente-servidor emulada.

**Versión:** 2.1.0 | **Autor:** Devsohftt Studio | **Plataforma:** Google Apps Script Webapp

---

## Estructura del proyecto (Arquitectura Semántica)

```text
rindefact/
│
├── .clasp.json          ← Configuración de CLASP. rootDir apunta a src/
├── package.json         ← Scripts de npm y dependencias de tipos de GAS
├── .gitignore
├── README.md            ← Este archivo
│
└── src/                 ← Todo lo que CLASP sube a GAS
    ├── appsscript.json  ← Manifiesto del proyecto GAS
    │
    ├── server/          ← Backend (GAS Server-Side)
    │   ├── routes.js    ← Enrutador HTTP (doGet, include)
    │   └── optimizer.js ← Motor algorítmico de optimización (backtracking)
    │
    └── client/          ← Frontend (HtmlService)
        ├── views/
        │   └── layout.html        ← Shell HTML principal
        ├── styles/
        │   └── global.css.html    ← Parcial CSS global
        └── scripts/
            └── ui-logic.js.html   ← Lógica de interfaz, estado y localStorage
