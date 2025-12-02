::[Bat To Exe Converter]
::
::YAwzoRdxOk+EWAnk
::fBw5plQjdG8=
::YAwzuBVtJxjWCl3EqQJgSA==
::ZR4luwNxJguZRRnk
::Yhs/ulQjdF+5
::cxAkpRVqdFKZSDk=
::cBs/ulQjdF+5
::ZR41oxFsdFKZSDk=
::eBoioBt6dFKZSDk=
::cRo6pxp7LAbNWATEpCI=
::egkzugNsPRvcWATEpCI=
::dAsiuh18IRvcCxnZtBJQ
::cRYluBh/LU+EWAnk
::YxY4rhs+aU+JeA==
::cxY6rQJ7JhzQF1fEqQJQ
::ZQ05rAF9IBncCkqN+0xwdVs0
::ZQ05rAF9IAHYFVzEqQJQ
::eg0/rx1wNQPfEVWB+kM9LVsJDGQ=
::fBEirQZwNQPfEVWB+kM9LVsJDGQ=
::cRolqwZ3JBvQF1fEqQJQ
::dhA7uBVwLU+EWDk=
::YQ03rBFzNR3SWATElA==
::dhAmsQZ3MwfNWATElA==
::ZQ0/vhVqMQ3MEVWAtB9wSA==
::Zg8zqx1/OA3MEVWAtB9wSA==
::dhA7pRFwIByZRRnk
::Zh4grVQjdCuDJEmW+0g1Kw9oTxGQL2SoS7kd/eb45++Vnl4JVfArNY3a2b+LLuRd713hFQ==
::YB416Ek+ZG8=
::
::
::978f952a14a936cc963da21a135fa983
@echo off
chcp 65001 >nul
title Cursor Launcher Backend Server

echo ========================================
echo   Cursor Launcher Backend Server
echo ========================================
echo.

:: ?�재 ?�크립트???�렉?�리�??�동
cd /d "%~dp0"

:: Node.js가 ?�치?�어 ?�는지 ?�인
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
  echo [?�류] Node.js가 ?�치?�어 ?��? ?�습?�다.
  echo Node.js�??�치?????�시 ?�도?�주?�요.
  echo https://nodejs.org/
  pause
  exit /b 1
)

:: node_modules가 ?�는지 ?�인
if not exist "node_modules\" (
  echo [?�보] ?�존???�키지�??�치?�는 �?..
  call npm install
  if %ERRORLEVEL% NEQ 0 (
    echo [?�류] ?�키지 ?�치???�패?�습?�다.
    pause
    exit /b 1
  )
  echo.
)

:: 백엔???�버 ?�작
echo [?�보] 백엔???�버�??�작?�는 �?..
echo [?�보] ?�버 주소: http://localhost:3001
echo [?�보] 종료?�려�?Ctrl+C�??�르거나 ??창을 ?�으?�요.
echo.
echo ========================================
echo.

node server/index.js

:: ?�버가 종료?�면
echo.
echo [?�보] 백엔???�버가 종료?�었?�니??
pause

