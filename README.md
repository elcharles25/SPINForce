# SPIMForce CRM - Instalador

## 🎯 Descripción

Sistema completo de gestión de CRM y campañas de email con integración de Microsoft Outlook y análisis con IA (Google Gemini).

## 📋 Requisitos Previos

Antes de instalar, asegúrese de tener:

### Requisitos Obligatorios

1. **Node.js** (versión 18 o superior)
   - Descarga: https://nodejs.org/
   - Recomendado: Versión LTS (Long Term Support)
   - Verificar instalación: `node --version`

2. **Microsoft Outlook**
   - Debe estar instalado y configurado
   - Necesario para las funciones de automatización de email

3. **Google Gemini API Key**
   - Necesaria para funciones de análisis con IA
   - Obtener en: https://aistudio.google.com/app/apikey
   - Gratuita con límites de uso

### Requisitos Recomendados

- **Sistema Operativo**: Windows 10/11
- **RAM**: Mínimo 4GB, recomendado 8GB
- **Espacio en disco**: 500MB libres
- **Navegador**: Chrome, Edge o Firefox (última versión)
- **Conexión a Internet**: Para instalación de dependencias

## 🚀 Instalación

### Método 1: Instalación Automática (Recomendado para Windows)

1. Extraiga todos los archivos del paquete de instalación en una carpeta
2. Ejecute el archivo `INSTALAR.bat`
3. Siga las instrucciones en pantalla
4. Cuando se le solicite, ingrese su Google Gemini API Key

### Método 2: Instalación Manual

1. Abra una terminal o símbolo del sistema
2. Navegue a la carpeta del instalador:
   ```bash
   cd ruta/a/spimforce-installer
   ```

3. Instale las dependencias del instalador:
   ```bash
   npm install
   ```

4. Ejecute el instalador:
   ```bash
   node install.js
   ```

5. Siga las instrucciones en pantalla

## 📦 Contenido del Paquete

El instalador incluye:

- `install.js` - Script principal de instalación
- `package.json` - Configuración del instalador
- `INSTALAR.bat` - Instalador automático para Windows
- `README.md` - Este archivo

## 🔧 Proceso de Instalación

El instalador realizará automáticamente:

1. ✅ Verificación de Node.js
2. ✅ Solicitud de Google Gemini API Key
3. ✅ Creación de estructura de directorios
4. ✅ Inicialización de base de datos SQLite
5. ✅ Creación de archivo de configuración (.env)
6. ✅ Instalación de todas las dependencias
7. ✅ Creación de scripts de inicio (start.bat, stop.bat)
8. ✅ Generación de documentación

## 📝 Obtener Google Gemini API Key

1. Visite: https://aistudio.google.com/app/apikey
2. Inicie sesión con su cuenta de Google
3. Haga clic en "Create API Key"
4. Copie la clave generada
5. Tenga la clave lista para ingresarla durante la instalación

**Nota**: La API Key es gratuita con límites de uso generosos para la mayoría de casos.

## 🎮 Después de la Instalación

Una vez completada la instalación, encontrará en la carpeta principal:

### Archivos de Inicio

- **start.bat** - Inicia todos los servicios de la aplicación (Windows)
- **stop.bat** - Detiene todos los servicios (Windows)

### Directorios Principales

- **runtime/** - Datos de la aplicación
  - **data/** - Base de datos SQLite
  - **attachments/** - Archivos adjuntos de emails
  - **pdfs/** - Documentos PDF procesados

### Archivos de Configuración

- **.env** - Configuración de API Keys y variables de entorno
- **LEEME.md** - Guía de uso completa

## 🚀 Iniciar la Aplicación

### Windows:
```bash
start.bat
```

### Otras plataformas:
```bash
npm run dev:all
```

La aplicación se abrirá automáticamente en: `http://localhost:8080`

## 🛑 Detener la Aplicación

### Windows:
```bash
stop.bat
```

### Otras plataformas:
Presione `Ctrl+C` en cada terminal donde se ejecutan los servicios.

## 🔍 Verificación de Instalación

Para verificar que todo se instaló correctamente:

1. Debe existir la carpeta `runtime/data/` con el archivo `crm_campaigns.db`
2. Debe existir el archivo `.env` con su API Key
3. Los archivos `start.bat` y `stop.bat` deben estar presentes
4. La carpeta `node_modules/` debe contener todas las dependencias

## ⚠️ Solución de Problemas

### Error: "Node.js no encontrado"
- Instale Node.js desde https://nodejs.org/
- Reinicie la terminal después de instalar
- Verifique con: `node --version`

### Error: "API Key inválida"
- Verifique que copió la clave completa
- Asegúrese de no incluir espacios al inicio o final
- Puede editar el archivo `.env` después de la instalación

### Error: "No se puede crear la base de datos"
- Verifique que tiene permisos de escritura en la carpeta
- Asegúrese de que no hay antivirus bloqueando la creación de archivos
- Ejecute como administrador si es necesario

### Error: "Fallo instalando dependencias"
- Verifique su conexión a internet
- Intente ejecutar manualmente: `npm install`
- Si persiste, elimine la carpeta `node_modules` y vuelva a intentar

### Error al iniciar: "Puerto en uso"
- Verifique que los puertos 3001, 3002 y 8080 estén disponibles
- Cierre otras aplicaciones que puedan estar usando estos puertos
- Ejecute el script `stop.bat` antes de volver a iniciar

## 📞 Soporte

Si encuentra problemas durante la instalación:

1. Revise la sección de "Solución de Problemas" arriba
2. Verifique que cumple todos los requisitos previos
3. Consulte el archivo `LEEME.md` generado tras la instalación
4. Contacte al administrador del sistema

## 📄 Licencia

Este software es de uso interno. Todos los derechos reservados.

## 🔄 Actualización

Para actualizar a una nueva versión:

1. Haga backup de la carpeta `runtime/` (contiene sus datos)
2. Haga backup del archivo `.env` (contiene su configuración)
3. Extraiga la nueva versión en una carpeta nueva
4. Ejecute el instalador
5. Copie la carpeta `runtime/` y el archivo `.env` de su backup a la nueva instalación

## 📊 Características Principales

- ✅ Gestión de contactos con roles y organizaciones
- ✅ Campañas de email automatizadas con plantillas personalizables
- ✅ Integración completa con Microsoft Outlook
- ✅ Seguimiento de oportunidades y reuniones
- ✅ Análisis con IA (Google Gemini) para iniciativas y cualificación
- ✅ Distribución de webinars por rol
- ✅ Dashboard con métricas y estadísticas
- ✅ Importación/Exportación de datos en CSV
- ✅ Gestión de adjuntos y documentos PDF
- ✅ Sistema de detección de rebotes y respuestas automáticas

## 🎉 ¡Instalación Completada!

Una vez finalizada la instalación, ejecute `start.bat` y comience a usar SPIMForce CRM.

¡Éxito en la gestión de sus campañas y contactos!
