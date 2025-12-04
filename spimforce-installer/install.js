#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');
const os = require('os');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║                                                            ║');
console.log('║              INSTALADOR DE SPIMFORCE CRM                   ║');
console.log('║           Sistema de Gestión de Campañas v1.0              ║');
console.log('║                                                            ║');
console.log('╚════════════════════════════════════════════════════════════╝');
console.log('');
console.log('🔍 Verificando entorno de instalación...');
console.log('   Directorio del instalador:', process.cwd());
console.log('   Node.js:', process.version);
console.log('   Plataforma:', process.platform);
console.log('   Arquitectura:', process.arch);
console.log('');

// Detectar el directorio de la aplicación
const installerDir = process.cwd();
const appDir = path.join(installerDir, '..', 'spimforce');

console.log('📂 Detectando directorios...');
console.log('   Instalador:', installerDir);
console.log('   Aplicación esperada:', appDir);
console.log('');

async function checkNodeInstallation() {
  console.log('🔍 Verificando instalación de Node.js...');
  try {
    const version = execSync('node --version', { encoding: 'utf8' }).trim();
    console.log(`✅ Node.js encontrado: ${version}`);
    const majorVersion = parseInt(version.replace('v', '').split('.')[0]);
    if (majorVersion < 18) {
      console.log('⚠️  Advertencia: Se recomienda Node.js versión 18 o superior');
      const continueAnyway = await question('¿Desea continuar de todos modos? (s/n): ');
      if (continueAnyway.toLowerCase() !== 's') {
        console.log('Instalación cancelada. Por favor, actualice Node.js.');
        process.exit(1);
      }
    }
    return true;
  } catch (error) {
    console.log('❌ Node.js no encontrado');
    console.log('Por favor, descargue e instale Node.js desde: https://nodejs.org/');
    console.log('Se recomienda la versión LTS (Long Term Support)');
    process.exit(1);
  }
}

async function checkAppDirectory() {
  console.log('🔍 Verificando directorio de la aplicación...');
  
  if (!fs.existsSync(appDir)) {
    console.log('❌ Error: No se encontró la carpeta de la aplicación');
    console.log('');
    console.log('Estructura esperada:');
    console.log('  carpeta-padre/');
    console.log('  ├── spimforce/              ← Carpeta de la aplicación');
    console.log('  │   ├── backend/');
    console.log('  │   ├── src/');
    console.log('  │   └── package.json');
    console.log('  └── spimforce-installer/    ← Carpeta del instalador (aquí)');
    console.log('');
    console.log('Ubicación actual:', installerDir);
    console.log('Buscando en:', appDir);
    console.log('');
    console.log('⚠️  Asegúrese de que la carpeta "spimforce" está junto a "spimforce-installer"');
    process.exit(1);
  }
  
  // Verificar que tiene los archivos necesarios
  const requiredFiles = ['package.json', 'backend', 'src'];
  for (const file of requiredFiles) {
    if (!fs.existsSync(path.join(appDir, file))) {
      console.log(`❌ Error: Falta ${file} en la carpeta spimforce`);
      console.log('   Asegúrese de tener el código completo de la aplicación');
      process.exit(1);
    }
  }
  
  console.log('✅ Directorio de aplicación encontrado');
  console.log('   ' + appDir);
}

async function getGeminiApiKey() {
  console.log('\n📝 Configuración de Google Gemini API');
  console.log('─────────────────────────────────────────');
  console.log('Para utilizar las funciones de análisis con IA, necesita una API Key de Google Gemini.');
  console.log('');
  console.log('Pasos para obtener su API Key:');
  console.log('1. Visite: https://aistudio.google.com/app/apikey');
  console.log('2. Inicie sesión con su cuenta de Google');
  console.log('3. Haga clic en "Create API Key"');
  console.log('4. Copie la clave generada');
  console.log('');
  
  const apiKey = await question('Ingrese su Google Gemini API Key: ');
  
  if (!apiKey || apiKey.trim().length < 20) {
    console.log('⚠️  API Key inválida o muy corta');
    const retry = await question('¿Desea intentar de nuevo? (s/n): ');
    if (retry.toLowerCase() === 's') {
      return await getGeminiApiKey();
    }
    console.log('⚠️  Continuando sin API Key. Puede configurarla más tarde editando el archivo .env');
    return '';
  }
  
  return apiKey.trim();
}

function createDirectoryStructure() {
  console.log('\n📁 Creando estructura de directorios en la aplicación...');
  const dirs = [
    path.join(appDir, 'runtime'),
    path.join(appDir, 'runtime', 'data'),
    path.join(appDir, 'runtime', 'attachments'),
    path.join(appDir, 'runtime', 'pdfs'),
    path.join(appDir, 'runtime', 'logs')
  ];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`   ✅ Creado: ${path.relative(appDir, dir)}`);
    } else {
      console.log(`   ℹ️  Ya existe: ${path.relative(appDir, dir)}`);
    }
  });
}

function createDatabase() {
  console.log('\n🗄️  Inicializando base de datos SQLite...');
  
  const dbPath = path.join(appDir, 'runtime', 'data', 'crm_campaigns.db');
  
  if (fs.existsSync(dbPath)) {
    console.log('   ⚠️  La base de datos ya existe en:', dbPath);
    console.log('   ℹ️  Manteniendo base de datos existente');
    return;
  }
  
  try {
    const sqlite3 = require('better-sqlite3');
    const db = sqlite3(dbPath);
    
    console.log('   📋 Creando tablas...');
    
    // Crear todas las tablas
    const tables = [
      {
        name: 'contacts',
        sql: `CREATE TABLE IF NOT EXISTS contacts (
          id TEXT PRIMARY KEY,
          first_name TEXT,
          last_name TEXT,
          email TEXT,
          phone TEXT,
          organization TEXT,
          title TEXT,
          gartner_role TEXT,
          contact_type TEXT,
          tier TEXT,
          linkedin_url TEXT,
          pa_name TEXT,
          pa_email TEXT,
          pa_phone TEXT,
          webinar_role TEXT,
          contacted INTEGER DEFAULT 0,
          last_contact_date TEXT,
          interested INTEGER DEFAULT 0,
          webinars_subscribed INTEGER DEFAULT 0,
          notes TEXT,
          csm_name TEXT, 
          csm_email TEXT, 
          ep_name TEXT, 
          ep_email TEXT, 
          last_email_check TEXT,
          ai_initiatives TEXT,
          photo_url TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        )`
      },
      {
        name: 'campaign_templates',
        sql: `CREATE TABLE IF NOT EXISTS campaign_templates (
          id TEXT PRIMARY KEY,
          name TEXT,
          gartner_role TEXT,
          email_1_subject TEXT,
          email_1_html TEXT,
          email_1_attachments TEXT,
          email_2_subject TEXT,
          email_2_html TEXT,
          email_2_attachments TEXT,
          email_3_subject TEXT,
          email_3_html TEXT,
          email_3_attachments TEXT,
          email_4_subject TEXT,
          email_4_html TEXT,
          email_4_attachments TEXT,
          email_5_subject TEXT,
          email_5_html TEXT,
          email_5_attachments TEXT,
          attachments TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        )`
      },
      {
      name: 'accounts',
        sql: `CREATE TABLE IF NOT EXISTS accounts (
          id TEXT PRIMARY KEY,
          name TEXT,
          full_name TEXT,
          logo TEXT,
          sector TEXT,
          web_site TEXT,
          address TEXT,
          corporative_objectives TEXT,
          org_chart TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        )`
      },
      {
        name: 'campaigns',
        sql: `CREATE TABLE IF NOT EXISTS campaigns (
          id TEXT PRIMARY KEY,
          contact_id TEXT,
          template_id TEXT,
          campaign_name TEXT,
          start_campaign INTEGER DEFAULT 0,
          email_1_date TEXT,
          email_2_date TEXT,
          email_3_date TEXT,
          email_4_date TEXT,
          email_5_date TEXT,
          status TEXT DEFAULT 'pending',
          response_date TEXT,
          response_text TEXT,
          emails_sent INTEGER DEFAULT 0,
          has_replied INTEGER DEFAULT 0,
          last_reply_date TEXT,
          email_incorrect INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
          FOREIGN KEY (template_id) REFERENCES campaign_templates(id) ON DELETE SET NULL
        )`
      },
      {
        name: 'opportunities',
        sql: `CREATE TABLE IF NOT EXISTS opportunities (
          id TEXT PRIMARY KEY,
          contact_id TEXT NOT NULL,
          status TEXT DEFAULT 'open',
          proposed_solution TEXT,
          offer_presented INTEGER DEFAULT 0,
          qualification_initiatives TEXT,
          last_qualification_update TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
        )`
      },
      {
        name: 'meetings',
        sql: `CREATE TABLE IF NOT EXISTS meetings (
          id TEXT PRIMARY KEY,
          opportunity_id TEXT NOT NULL,
          contact_id TEXT,
          meeting_type TEXT NOT NULL,
          meeting_date TEXT NOT NULL,
          feeling TEXT DEFAULT 'neutral',
          notes TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE CASCADE,
          FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL
        )`
      },
      {
        name: 'settings',
        sql: `CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )`
      },
      {
        name: 'webinar_distributions',
        sql: `CREATE TABLE IF NOT EXISTS webinar_distributions (
          id TEXT PRIMARY KEY,
          file_name TEXT,
          file_url TEXT,
          month TEXT,
          email_subject TEXT,
          email_html TEXT,
          webinar_table TEXT,
          sent INTEGER DEFAULT 0,
          sent_at TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        )`
      },
      {
        name: 'webinar_recommendations',
        sql: `CREATE TABLE IF NOT EXISTS webinar_recommendations (
          id TEXT PRIMARY KEY,
          distribution_id TEXT,
          gartner_role TEXT,
          webinar_title TEXT,
          webinar_description TEXT,
          relevance_score REAL,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (distribution_id) REFERENCES webinar_distributions(id) ON DELETE CASCADE
        )`
      }
    ];
    
    tables.forEach(table => {
      db.exec(table.sql);
      console.log(`   ✅ Tabla ${table.name} creada`);
    });
    
    // Crear índices
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_campaigns_contact_id ON campaigns(contact_id);
      CREATE INDEX IF NOT EXISTS idx_campaigns_template_id ON campaigns(template_id);
      CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
      CREATE INDEX IF NOT EXISTS idx_opportunities_contact_id ON opportunities(contact_id);
      CREATE INDEX IF NOT EXISTS idx_opportunities_status ON opportunities(status);
      CREATE INDEX IF NOT EXISTS idx_meetings_opportunity_id ON meetings(opportunity_id);
      CREATE INDEX IF NOT EXISTS idx_meetings_contact_id ON meetings(contact_id);
      CREATE INDEX IF NOT EXISTS idx_meetings_date ON meetings(meeting_date);
    `);
    console.log('   ✅ Índices creados');
    
    db.close();
    console.log('   ✅ Base de datos inicializada correctamente en:', dbPath);
  } catch (error) {
    console.error('   ❌ Error creando base de datos:', error.message);
    console.log('');
    console.log('   Nota: Si el error es sobre better-sqlite3, se intentará instalar con las dependencias');
  }
}

function createEnvFile(apiKey) {
  console.log('\n📝 Creando archivo de configuración (.env)...');
  
  const envContent = `VITE_GOOGLE_GEMINI_API_KEY="${apiKey}"
DATABASE_URL=postgresql://postgres:Gartner@localhost:5432/spimforce
PORT=3001
VITE_API_URL=http://localhost:3001
`;
  
  const envPath = path.join(appDir, '.env');
  fs.writeFileSync(envPath, envContent);
  console.log('   ✅ Archivo .env creado en la aplicación');
}

function installDependencies() {
  console.log('\n📦 Instalando dependencias de Node.js en la aplicación...');
  console.log('   Directorio:', appDir);
  console.log('   (Esto puede tardar varios minutos)');
  console.log('');
  
  try {
    console.log('   Ejecutando: npm install');
    console.log('');
    
    execSync('npm install', { 
      stdio: 'inherit',
      cwd: appDir,
      encoding: 'utf-8'
    });
    
    console.log('\n   ✅ Dependencias instaladas correctamente');
    return true;
  } catch (error) {
    console.log('\n   ❌ Error instalando dependencias');
    console.log('   Código de error:', error.status);
    console.log('   Mensaje:', error.message);
    
    console.log('\n   Por favor, ejecute manualmente:');
    console.log(`   cd ${appDir}`);
    console.log('   npm install');
    return false;
  }
}

function createStartupScripts() {
  console.log('\n🚀 Creando scripts de inicio...');
  
  // Script de inicio en una sola ventana
  const startBatContent = `@echo off
timeout /t 2 /nobreak > nul

REM Iniciar servidores en segundo plano usando npm-run-all
echo.
echo Iniciando servicios...
echo.

start /B npm run dev:all

REM Esperar 5 segundos para que los servidores se inicien
echo [INFO] Esperando a que los servidores se inicien...
timeout /t 12 /nobreak >nul

echo.
echo ============================================
echo   SPIMForce iniciado correctamente
echo ============================================
echo.
echo Servidores activos:
echo   - Backend DB: http://localhost:3001
echo   - Backend Email: http://localhost:3002
echo   - Frontend: http://localhost:8080
echo.
echo Abriendo aplicacion en el navegador...
echo.

REM Abrir navegador en http://localhost:8080
start http://localhost:8080
`;
  
  fs.writeFileSync(path.join(appDir, 'start.bat'), startBatContent);
  console.log('   ✅ start.bat creado (ventana única)');
  
  // Script de inicio completamente oculto
  const startHiddenVbs = `Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "cmd /c cd /d """ & WScript.Arguments(0) & """ && start-background.bat", 0, False
Set WshShell = Nothing
`;
  
  fs.writeFileSync(path.join(appDir, 'start-hidden.vbs'), startHiddenVbs);
  console.log('   ✅ start-hidden.vbs creado (ejecución oculta)');
  
  // Script auxiliar para ejecución en background
  const startBackgroundContent = `@echo off
setlocal EnableDelayedExpansion

echo ============================================
echo   Iniciando SPIMForce en segundo plano
echo ============================================
echo.

REM Verificar Node.js
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js no esta instalado
    pause
    exit /b 1
)

echo [OK] Node.js detectado
node --version
echo.

REM Verificar dependencias
if not exist "node_modules\\" (
    echo [INFO] Instalando dependencias...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Fallo al instalar dependencias
        pause
        exit /b 1
    )
)

REM Crear directorios necesarios
if not exist "runtime\\logs" mkdir "runtime\\logs"

REM Limpiar archivos de log existentes
echo [INFO] Limpiando logs anteriores...
del /F /Q "runtime\\logs\\*.log" 2>nul

REM Generar timestamp para los logs
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set TIMESTAMP=%datetime:~0,8%_%datetime:~8,6%

REM Iniciar servidores en segundo plano con logs únicos
echo [INFO] Iniciando servidores en segundo plano...
echo.

start /B cmd /c "npm run db-server > runtime\\logs\\db-server_%TIMESTAMP%.log 2>&1"
start /B cmd /c "npm run email-server > runtime\\logs\\email-server_%TIMESTAMP%.log 2>&1"
start /B cmd /c "npm run dev > runtime\\logs\\frontend_%TIMESTAMP%.log 2>&1"

REM Esperar a que los servidores se inicien
echo [INFO] Esperando a que los servidores se inicien...
timeout /t 12 /nobreak >nul

echo.
echo ============================================
echo   SPIMForce iniciado en segundo plano
echo ============================================
echo.
echo Servidores activos:
echo   - Backend DB: http://localhost:3001
echo   - Backend Email: http://localhost:3002
echo   - Frontend: http://localhost:8080
echo.
echo Logs guardados en: runtime\logs\
echo   - db-server_%TIMESTAMP%.log
echo   - email-server_%TIMESTAMP%.log
echo   - frontend_%TIMESTAMP%.log
echo.
echo Para detener los servidores, ejecuta stop.bat
echo.
pause
`;
  
  fs.writeFileSync(path.join(appDir, 'start-background.bat'), startBackgroundContent);
  console.log('   ✅ start-background.bat creado (auxiliar)');
  
  // Launcher para inicio oculto
  const startHiddenBatContent = `@echo off
echo ===============================================
echo   SPIMFORCE CRM - Inicio sin ventanas
echo ===============================================
echo.
echo Iniciando servicios en segundo plano...
echo Los servicios se ejecutaran sin ventanas visibles
echo.

REM Crear carpeta de logs si no existe
if not exist "runtime\\logs" mkdir "runtime\\logs"

echo Logs disponibles en: runtime\\logs\\
echo   - db-server.log
echo   - email-server.log  
echo   - frontend.log
echo.

wscript.exe "%~dp0start-hidden.vbs" "%~dp0"

timeout /t 12 /nobreak > nul
start http://localhost:8080

echo.
echo ===============================================
echo   Servicios iniciados
echo ===============================================
echo.
echo La aplicacion se abrira en: http://localhost:8080
echo.
echo Para detener: Ejecute stop.bat
echo.

pause
`;
  
  fs.writeFileSync(path.join(appDir, 'start-hidden.bat'), startHiddenBatContent);
  console.log('   ✅ start-hidden.bat creado (sin ventanas)');
  
  // Script para detener servicios
  const stopBatContent = `@echo off
echo ============================================
echo   Deteniendo servidores de SPIMForce
echo ============================================
echo.

REM Matar procesos en puerto 3001
echo Buscando procesos en puerto 3001...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001 ^| findstr LISTENING') do (
    echo Matando proceso %%a en puerto 3001
    taskkill /F /PID %%a >nul 2>&1
)

REM Matar procesos en puerto 3002
echo Buscando procesos en puerto 3002...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3002 ^| findstr LISTENING') do (
    echo Matando proceso %%a en puerto 3002
    taskkill /F /PID %%a >nul 2>&1
)

REM Matar proceso de Vite (puerto 8080)
echo Buscando procesos en puerto 8080...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8080 ^| findstr LISTENING') do (
    echo Matando proceso %%a en puerto 8080
    taskkill /F /PID %%a >nul 2>&1
)

REM Matar todos los procesos node.exe que contengan SPIMforce en su ruta
echo Matando procesos Node.js de SPIMforce...
for /f "tokens=2" %%a in ('tasklist /FI "IMAGENAME eq node.exe" /FO LIST ^| findstr PID') do (
    wmic process where "ProcessId=%%a" get CommandLine 2>nul | findstr /I "SPIMforce" >nul
    if not errorlevel 1 (
        echo Matando proceso Node.js %%a
        taskkill /F /PID %%a >nul 2>&1
    )
)

REM Esperar un momento para asegurar que los procesos se cierren
timeout /t 2 /nobreak >nul

echo.
echo ============================================
echo   Servidores detenidos correctamente
echo ============================================
echo.
pause
`;
  
  fs.writeFileSync(path.join(appDir, 'stop.bat'), stopBatContent);
  console.log('   ✅ stop.bat creado (mejorado)');
  
  // Crear carpeta de logs
  const logsDir = path.join(appDir, 'runtime', 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
    console.log('   ✅ Carpeta de logs creada');
  }
}

function createShortcutToDesktop() {
  console.log('\n🔗 Creando acceso directo en el escritorio...');
  
  try {
    const desktopPath = path.join(os.homedir(), 'Desktop');
    
    if (!fs.existsSync(desktopPath)) {
      console.log('   ⚠️  No se encontró la carpeta del escritorio');
      console.log('   ℹ️  Omitiendo creación del acceso directo');
      return false;
    }
    
    const targetBat = path.join(appDir, 'start-hidden.bat');
    const iconPath = path.join(appDir, 'public', 'favicon_shell.ico');
    const shortcutPath = path.join(desktopPath, 'SPIMForce.lnk');
    
    // Verificar que existe el archivo objetivo
    if (!fs.existsSync(targetBat)) {
      console.log('   ⚠️  No se encontró start-hidden.bat');
      console.log('   ℹ️  Omitiendo creación del acceso directo');
      return false;
    }
    
    // Verificar que existe el icono
    if (!fs.existsSync(iconPath)) {
      console.log('   ⚠️  No se encontró el icono en:', iconPath);
      console.log('   ℹ️  El acceso directo se creará sin icono personalizado');
    }
    
    // Crear el acceso directo usando PowerShell
    const psScript = `
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("${shortcutPath.replace(/\\/g, '\\\\')}")
$Shortcut.TargetPath = "${targetBat.replace(/\\/g, '\\\\')}"
$Shortcut.WorkingDirectory = "${appDir.replace(/\\/g, '\\\\')}"
$Shortcut.Description = "SPIMForce CRM - Sistema de Gestión de Campañas"
${fs.existsSync(iconPath) ? `$Shortcut.IconLocation = "${iconPath.replace(/\\/g, '\\\\')}"` : ''}
$Shortcut.Save()
`;
    
    // Ejecutar el script de PowerShell
    execSync(`powershell -Command "${psScript.replace(/"/g, '\\"').replace(/\n/g, '; ')}"`, {
      encoding: 'utf8'
    });
    
    console.log('   ✅ Acceso directo creado en el escritorio');
    console.log('   📍', shortcutPath);
    return true;
    
  } catch (error) {
    console.log('   ⚠️  Error creando acceso directo:', error.message);
    console.log('   ℹ️  Puede crear el acceso directo manualmente');
    return false;
  }
}

function createReadme() {
  console.log('\n📄 Generando documentación...');
  
  const readmeContent = `# SPIMForce CRM - Guía de Uso

## Inicio de la Aplicación

### Opción 1: Acceso Directo del Escritorio (Recomendado)
Haga doble clic en el acceso directo **SPIMForce** en su escritorio.
- Los servicios se inician automáticamente en segundo plano
- No hay ventanas visibles
- La aplicación se abre automáticamente en el navegador

### Opción 2: Ventana Única
Ejecute \`start.bat\` para iniciar todos los servicios en una sola ventana:
\`\`\`
start.bat
\`\`\`
- Todos los servicios se ejecutan en la misma ventana
- Puede ver los logs en tiempo real
- Para detener: Presione Ctrl+C o cierre la ventana

### Opción 3: Ejecución Oculta
Ejecute \`start-hidden.bat\` para iniciar sin ventanas visibles:
\`\`\`
start-hidden.bat
\`\`\`
- Los servicios se ejecutan en segundo plano
- No hay ventanas visibles
- Los logs se guardan en \`runtime/logs/\`
- Para detener: Ejecute \`stop.bat\`

### Opción 4: Manual (Desarrollo)
Si prefiere iniciar los servicios manualmente en terminales separadas:

1. Servidor de base de datos:
   \`\`\`
   node backend/db-server.js
   \`\`\`

2. Servidor de email:
   \`\`\`
   node backend/email-server.js
   \`\`\`

3. Interfaz web:
   \`\`\`
   npm run dev
   \`\`\`

## Acceso a la Aplicación

Una vez iniciada, la aplicación estará disponible en:
\`\`\`
http://localhost:8080
\`\`\`

## Detener la Aplicación

### Si usó el acceso directo o start-hidden.bat
Ejecute el archivo \`stop.bat\` en la carpeta de instalación:
\`\`\`
stop.bat
\`\`\`

### Si usó start.bat (Ventana Única)
- Presione \`Ctrl+C\` en la ventana
- O simplemente cierre la ventana
- O ejecute \`stop.bat\`

## Logs de la Aplicación

Si ejecutó con el acceso directo o \`start-hidden.bat\`, los logs están en:
\`\`\`
runtime/logs/
├── db-server.log      # Logs del servidor de base de datos
├── email-server.log   # Logs del servidor de email
└── frontend.log       # Logs del frontend
\`\`\`

Puede consultar estos archivos para diagnóstico de problemas.

## Configuración

### API Key de Google Gemini
La API Key se encuentra en el archivo \`.env\`. Para cambiarla:
1. Abra el archivo \`.env\` con un editor de texto
2. Modifique el valor de \`VITE_GOOGLE_GEMINI_API_KEY\`
3. Guarde el archivo
4. Reinicie la aplicación

## Requisitos del Sistema

- **Node.js**: Versión 18 o superior
- **Microsoft Outlook**: Instalado y configurado (para funciones de email)
- **Sistema Operativo**: Windows 10/11 (recomendado)
- **Navegador**: Chrome, Edge o Firefox (última versión)

## Estructura de Archivos

\`\`\`
spimforce/
├── backend/               # Servidores backend
│   ├── db-server.js      # Servidor de base de datos
│   └── email-server.js   # Servidor de email/Outlook
├── runtime/              # Datos de la aplicación
│   ├── data/            # Base de datos SQLite
│   ├── attachments/     # Archivos adjuntos
│   ├── pdfs/           # Documentos PDF
│   └── logs/           # Logs de los servicios
├── src/                 # Código fuente del frontend
├── .env                 # Configuración (API Keys)
├── start.bat           # Script de inicio (ventana única)
├── start-hidden.bat    # Script de inicio (sin ventanas)
├── stop.bat            # Script de detención
└── LEEME.md            # Esta documentación
\`\`\`

## Solución de Problemas

### La aplicación no inicia
1. Verifique que Node.js está instalado: \`node --version\`
2. Asegúrese de que los puertos 3001, 3002 y 8080 están disponibles
3. Revise los logs en \`runtime/logs/\`
4. Ejecute \`stop.bat\` y vuelva a intentar

### Error de API Key
1. Verifique que la API Key en \`.env\` es correcta
2. Compruebe que tiene acceso a internet
3. Verifique que la API Key de Gemini está activa en Google AI Studio

### Problemas con Outlook
1. Asegúrese de que Outlook está instalado
2. Verifique que Outlook está configurado con una cuenta de email
3. Inicie Outlook al menos una vez antes de usar SPIMForce

### Los servicios no se detienen
1. Ejecute \`stop.bat\` varias veces si es necesario
2. Abra el Administrador de tareas y cierre procesos "node.exe" manualmente
3. Reinicie el equipo si persiste el problema

## Soporte

Para más información o ayuda, contacte con el administrador del sistema.
`;
  
  fs.writeFileSync(path.join(appDir, 'LEEME.md'), readmeContent);
  console.log('   ✅ LEEME.md creado en la aplicación');
}

async function main() {
  try {
    console.log('🔍 Iniciando verificación de requisitos...\n');
    
    await checkNodeInstallation();
    await checkAppDirectory();
    
    console.log('\n🎯 Comenzando instalación...\n');
    
    const apiKey = await getGeminiApiKey();
    
    createDirectoryStructure();
    createEnvFile(apiKey);
    createDatabase();
    
    const depsInstalled = installDependencies();
    
    createStartupScripts();
    createReadme();
    
    const shortcutCreated = createShortcutToDesktop();
    
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                                                            ║');
    console.log('║        ✅ INSTALACIÓN COMPLETADA EXITOSAMENTE ✅          ║');
    console.log('║                                                            ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('📋 Próximos pasos:');
    console.log('');
    console.log('   1. Asegurese de que MS Outlook está iniciado');
    console.log('');
    
    if (shortcutCreated) {
      console.log('   2. Vaya al escritorio y ejecute el acceso directo:');
      console.log('      SPIMForce');
    } else {
      console.log('   2. Para iniciar la aplicación, ejecute:');
      console.log('      ' + path.join(appDir, 'start-hidden.bat'));
    }
    
    console.log('');
    console.log('   3. La aplicación se abrirá automáticamente en:');
    console.log('      http://localhost:8080');
    console.log('      (guarde la URL en favoritos para acceder directamente)');
    console.log('');
    console.log('      Siempre que no se detenga la aplicación o se apague el ordenador,');
    console.log('      no es necesario iniciar la aplicación de nuevo, solo acceder a la URL');
    console.log('');
    console.log('   4. Para detener la aplicación acceda a la carpeta de instalación y ejecute:');
    console.log('      stop.bat');
    console.log('');
    console.log('📚 Consulte LEEME.md en la carpeta spimforce para más información');
    console.log('');
    
    if (!depsInstalled) {
      console.log('⚠️  IMPORTANTE: Las dependencias no se instalaron correctamente.');
      console.log('   Ejecute manualmente:');
      console.log('   cd ../spimforce');
      console.log('   npm install');
      console.log('');
      process.exit(1);
    }
    
    console.log('✅ Todo listo. ¡Disfrute de SPIMForce CRM!');
    console.log('');
    process.exit(0);
    
  } catch (error) {
    console.error('\n╔════════════════════════════════════════════════════════════╗');
    console.error('║                                                            ║');
    console.error('║           ❌ ERROR DURANTE LA INSTALACIÓN ❌              ║');
    console.error('║                                                            ║');
    console.error('╚════════════════════════════════════════════════════════════╝');
    console.error('');
    console.error('Error:', error.message);
    console.error('');
    if (error.stack) {
      console.error('Detalles técnicos:');
      console.error(error.stack);
      console.error('');
    }
    console.error('Por favor, reporte este error al soporte técnico.');
    console.error('');
    process.exit(1);
  } finally {
    rl.close();
  }
}

process.on('uncaughtException', (error) => {
  console.error('\n❌ Error no capturado:', error.message);
  console.error(error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('\n❌ Promesa rechazada no manejada:', reason);
  process.exit(1);
});

main();