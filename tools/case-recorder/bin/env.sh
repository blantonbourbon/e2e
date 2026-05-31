#!/usr/bin/env sh

case_recorder_node_home="${HOME}/.local/toolchains/node-current"
case_recorder_java_home="${JAVA_HOME:-}"

if [ -d "${case_recorder_node_home}/bin" ]; then
  PATH="${case_recorder_node_home}/bin:${PATH}"
fi

if [ -z "${case_recorder_java_home}" ] && [ -d "${HOME}/.sdkman/candidates/java/current" ]; then
  case_recorder_java_home="${HOME}/.sdkman/candidates/java/current"
fi

if [ -n "${case_recorder_java_home}" ] && [ -d "${case_recorder_java_home}/bin" ]; then
  JAVA_HOME="${case_recorder_java_home}"
  PATH="${JAVA_HOME}/bin:${PATH}"
  export JAVA_HOME
fi

export PATH
