package com.example.e2e.core.reporting;

enum NoOpExecutionReporter implements ExecutionReporter {
    INSTANCE;

    @Override
    public void info(String message) {
    }

    @Override
    public void attachment(String name, String content) {
    }
}
