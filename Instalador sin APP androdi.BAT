@echo off
setlocal enabledelayedexpansion

echo ================================
echo   INICIADOR APP WEB LOCAL
echo ================================
echo.

:: Pedir la clave GEMINI_API_KEY
set /p GEMINI_API_KEY="Introduce tu GEMINI_API_KEY: "

:: Crear o actualizar .env.local
echo GEMINI_API_KEY=%GEMINI_API_KEY% > .env.local
echo Archivo .env.local actualizado.
echo.

:: Instalar dependencias
echo Instalando dependencias...
call npm install
if errorlevel 1 (
    echo Error al instalar dependencias. Revisa npm.
    pause
    exit /b
)

:: Ejecutar la app en la misma ventana y mantenerla abierta
echo.
echo Iniciando servidor...
call npm run dev

:: Mantener ventana abierta
echo.
echo La app se ha detenido. Manteniendo la ventana abierta.
pause
