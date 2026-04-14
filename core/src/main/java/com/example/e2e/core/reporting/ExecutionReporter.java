package com.example.e2e.core.reporting;

public interface ExecutionReporter {
    void info(String message);

    void attachment(String name, String content);

    static ExecutionReporter noOp() {
        return NoOpExecutionReporter.INSTANCE;
    }
}
