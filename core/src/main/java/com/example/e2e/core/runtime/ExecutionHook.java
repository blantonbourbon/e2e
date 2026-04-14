package com.example.e2e.core.runtime;

import com.example.e2e.core.config.RuntimeConfiguration;
import com.example.e2e.core.reporting.ExecutionReporter;

public interface ExecutionHook {
    default void beforeSession(RuntimeConfiguration configuration, ExecutionReporter reporter) {
    }

    default void afterSessionStart(PlaywrightSession session) {
    }

    default void beforeSessionClose(PlaywrightSession session) {
    }

    default void afterSessionClose(RuntimeConfiguration configuration, ExecutionReporter reporter) {
    }
}
