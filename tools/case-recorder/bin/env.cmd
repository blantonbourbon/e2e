@echo off

if exist "C:\nvm4w\nodejs\node.exe" (
  set "PATH=C:\nvm4w\nodejs;%PATH%"
)

if not defined JAVA_HOME (
  if exist "%USERPROFILE%\.sdkman\candidates\java\current\bin\java.exe" (
    set "JAVA_HOME=%USERPROFILE%\.sdkman\candidates\java\current"
  )
)

if defined JAVA_HOME (
  if exist "%JAVA_HOME%\bin\java.exe" (
    set "PATH=%JAVA_HOME%\bin;%PATH%"
  )
)
