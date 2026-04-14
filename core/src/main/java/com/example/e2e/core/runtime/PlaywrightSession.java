package com.example.e2e.core.runtime;

import com.example.e2e.core.auth.AuthBootstrapResult;
import com.example.e2e.core.config.RuntimeConfiguration;
import com.example.e2e.core.reporting.ExecutionReporter;
import com.microsoft.playwright.Browser;
import com.microsoft.playwright.BrowserContext;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Playwright;

public interface PlaywrightSession extends AutoCloseable {
    RuntimeConfiguration configuration();

    ExecutionReporter reporter();

    AuthBootstrapResult authBootstrapResult();

    Playwright playwright();

    Browser browser();

    BrowserContext context();

    Page page();

    void navigateToBaseUrl();

    @Override
    void close();
}
