@echo off
set "JAVA_HOME=C:\Progra~1\Microsoft\jdk-17.0.18.8-hotspot"
set "PATH=%JAVA_HOME%\bin;%PATH%"
call ".\gradlew.bat" assembleDebug
