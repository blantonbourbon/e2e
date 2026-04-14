package com.example.e2e.core.reporting;

import io.qameta.allure.Allure;

public final class AllureExecutionReporter implements ExecutionReporter {
    @Override
    public void info(String message) {
        Allure.step(message);
    }

    @Override
    public void attachment(String name, String content) {
        Allure.attachment(name, content);
    }
}
