@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

echo ╔════════════════════════════════════════════════════════════╗
echo ║                                                            ║
echo ║          INSTALADOR DE SPIMFORCE CRM v1.0                  ║
echo ║        Sistema de Gestión de Campañas y Contactos          ║
echo ║                                                            ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

REM Verificar si Node.js está instalado
echo [1/5] Verificando instalación de Node.js...
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo.
    echo ❌ Node.js no está instalado
    echo.
    echo Intentando descargar e instalar Node.js automáticamente...
    echo.
    call :InstallNodeJS
    set INSTALL_RESULT=!ERRORLEVEL!
    
    if !INSTALL_RESULT! equ 2 (
        REM El usuario instaló manualmente Node.js
        REM Crear un script que continúe la instalación
        call :CreateContinueScript
        
        echo.
        echo ══════════════════════════════════════════════════════════
        echo   INSTALACIÓN DE NODE.JS COMPLETADA
        echo ══════════════════════════════════════════════════════════
        echo.
        echo Node.js se ha instalado correctamente.
        echo.
        echo Para continuar con la instalación de SPIMForce:
        echo   1. CIERRE esta ventana
        echo   2. Abra una NUEVA ventana de comandos
        echo   3. Navegue a esta carpeta: %CD%
        echo   4. Ejecute: continuar-instalacion.bat
        echo.
        echo O simplemente ejecute el archivo:
        echo   continuar-instalacion.bat
        echo.
        echo (Se ha creado en la carpeta actual)
        echo.
        pause
        exit /b 0
        
    ) else if !INSTALL_RESULT! neq 0 (
        echo.
        echo Por favor, descargue e instale Node.js manualmente desde:
        echo https://nodejs.org/
        echo.
        echo Después de la instalación:
        echo   1. Abra una nueva ventana de comandos
        echo   2. Ejecute INSTALAR.bat nuevamente
        echo.
        pause
        exit /b 1
    )
)

for /f "tokens=*" %%i in ('node --version 2^>nul') do set NODE_VER=%%i
echo       Node.js %NODE_VER%
echo       ✅ Node.js encontrado
echo.

REM Verificar si npm está instalado
echo [2/5] Verificando npm...
where npm >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo       ❌ npm no encontrado
    echo       Por favor, reinstale Node.js
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('npm --version 2^>nul') do set NPM_VER=%%i
echo       npm %NPM_VER%
echo       ✅ npm encontrado
echo.

REM Instalar dependencias del instalador
echo [3/5] Instalando dependencias del instalador...
echo       (Esto puede tardar unos minutos^)
echo.
echo       Ejecutando: npm install
echo       En directorio: %CD%
echo.

call npm install 2>&1
set INSTALL_ERROR=%ERRORLEVEL%

echo.
echo       Resultado del comando npm install: %INSTALL_ERROR%
echo.
if %INSTALL_ERROR% neq 0 (
    echo       ❌ Error instalando dependencias (Código: %INSTALL_ERROR%^)
    echo       Verifique su conexión a Internet
    echo.
    pause
    exit /b 1
)
echo       ✅ Dependencias instaladas
echo.

REM Verificar que install.js existe
echo [4/5] Verificando archivos del instalador...
if not exist "install.js" (
    echo       ❌ Error: No se encontró install.js
    echo       Asegúrese de estar en la carpeta correcta
    echo.
    pause
    exit /b 1
)
echo       ✅ Archivos verificados
echo.

REM Ejecutar el instalador
echo [5/5] Iniciando proceso de instalación...
echo.
echo ════════════════════════════════════════════════════════════
echo.
node install.js
set NODE_ERROR=%ERRORLEVEL%
echo.
echo ════════════════════════════════════════════════════════════

if %NODE_ERROR% equ 0 (
    echo.
    echo ✅ INSTALACIÓN COMPLETADA EXITOSAMENTE
    echo.
    echo Próximos pasos:
    echo   1. Vaya al escritorio y ejecute el acceso directo SPIMForce
    echo   2. O ejecute start.bat en la carpeta spimforce
    echo   3. La aplicación se abrirá en http://localhost:8080
    echo.
    
    REM Eliminar script de continuación si existe
    if exist "continuar-instalacion.bat" del "continuar-instalacion.bat"
) else (
    echo.
    echo ❌ LA INSTALACIÓN ENCONTRÓ ERRORES
    echo    Código de error: %NODE_ERROR%
    echo.
    echo Consulte los mensajes anteriores para más detalles
    echo.
)

echo ════════════════════════════════════════════════════════════
echo.
pause
exit /b %NODE_ERROR%

:InstallNodeJS
echo.
echo ══════════════════════════════════════════════════════════
echo   INSTALACIÓN AUTOMÁTICA DE NODE.JS
echo ══════════════════════════════════════════════════════════
echo.
echo Descargando Node.js LTS...
echo (Esto puede tardar varios minutos dependiendo de su conexión^)
echo.

REM Crear carpeta temporal
set "TEMP_DIR=%TEMP%\spimforce-installer"
if not exist "%TEMP_DIR%" mkdir "%TEMP_DIR%"

REM Determinar arquitectura
set "NODE_ARCH=x64"
if "%PROCESSOR_ARCHITECTURE%"=="x86" set "NODE_ARCH=x86"

REM Descargar Node.js usando PowerShell
set "NODE_URL=https://nodejs.org/dist/v20.11.0/node-v20.11.0-%NODE_ARCH%.msi"
set "NODE_MSI=%TEMP_DIR%\nodejs-installer.msi"

echo Descargando desde: %NODE_URL%
echo.

powershell -Command "$ProgressPreference = 'SilentlyContinue'; try { Invoke-WebRequest -Uri '%NODE_URL%' -OutFile '%NODE_MSI%' -UseBasicParsing; exit 0 } catch { Write-Host 'Error: No se pudo descargar Node.js'; exit 1 }"

if %ERRORLEVEL% neq 0 (
    echo.
    echo ❌ Error descargando Node.js
    echo.
    exit /b 1
)

if not exist "%NODE_MSI%" (
    echo ❌ Error: El archivo de instalación no se descargó correctamente
    exit /b 1
)

echo ✅ Descarga completada
echo.
echo Instalando Node.js...
echo (Esto requiere permisos de administrador^)
echo.

REM Instalar Node.js silenciosamente
msiexec /i "%NODE_MSI%" /qn /norestart

if %ERRORLEVEL% neq 0 (
    echo.
    echo ⚠️  La instalación automática requiere permisos de administrador
    echo.
    echo Abriendo instalador manual de Node.js...
    echo.
    echo Por favor, complete la instalación que se va a abrir.
    echo Cuando termine, vuelva a esta ventana.
    echo.
    timeout /t 2 /nobreak > nul
    
    REM Abrir instalador y esperar a que termine
    start "" /wait "%NODE_MSI%"
    
    echo.
    echo ✅ Instalación manual completada
    echo.
    REM Retornar código 2 para indicar instalación manual
    exit /b 2
)

echo.
echo ✅ Node.js instalado correctamente
echo.
exit /b 0

:CreateContinueScript
echo Creando script de continuación...

set "CONTINUE_SCRIPT=%CD%\continuar-instalacion.bat"

(
echo @echo off
echo chcp 65001 ^> nul
echo setlocal enabledelayedexpansion
echo.
echo echo ╔════════════════════════════════════════════════════════════╗
echo echo ║                                                            ║
echo echo ║     CONTINUANDO INSTALACIÓN DE SPIMFORCE CRM               ║
echo echo ║                                                            ║
echo echo ╚════════════════════════════════════════════════════════════╝
echo echo.
echo.
echo REM Verificar Node.js
echo echo Verificando instalación de Node.js...
echo where node ^>nul 2^>nul
echo if %%ERRORLEVEL%% neq 0 ^(
echo     echo.
echo     echo ❌ Node.js aún no está disponible
echo     echo.
echo     echo Por favor:
echo     echo   1. Asegúrese de haber completado la instalación de Node.js
echo     echo   2. Abra una NUEVA ventana de comandos ^(importante^)
echo     echo   3. Ejecute este script nuevamente
echo     echo.
echo     pause
echo     exit /b 1
echo ^)
echo.
echo for /f "tokens=*" %%%%i in ^('node --version 2^^^>nul'^) do set NODE_VER=%%%%i
echo echo ✅ Node.js %%NODE_VER%% detectado
echo echo.
echo.
echo REM Instalar dependencias
echo echo Instalando dependencias del instalador...
echo echo ^(Esto puede tardar unos minutos^)
echo echo.
echo call npm install 2^^^>^^^&1
echo if %%ERRORLEVEL%% neq 0 ^(
echo     echo.
echo     echo ❌ Error instalando dependencias
echo     pause
echo     exit /b 1
echo ^)
echo echo ✅ Dependencias instaladas
echo echo.
echo.
echo REM Ejecutar instalador principal
echo echo Iniciando instalación de SPIMForce...
echo echo.
echo node install.js
echo set RESULT=%%ERRORLEVEL%%
echo.
echo if %%RESULT%% equ 0 ^(
echo     echo.
echo     echo ✅ INSTALACIÓN COMPLETADA
echo     echo.
echo     REM Eliminar este script
echo     del "%%~f0"
echo ^) else ^(
echo     echo.
echo     echo ❌ Error en la instalación
echo     echo.
echo ^)
echo.
echo pause
echo exit /b %%RESULT%%
) > "%CONTINUE_SCRIPT%"

echo ✅ Script creado: continuar-instalacion.bat
goto :eof