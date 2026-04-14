package com.example.e2e.core.auth.oidc;

import com.example.e2e.core.config.RuntimeConfiguration;
import com.example.e2e.core.reporting.ExecutionReporter;
import com.microsoft.playwright.BrowserContext;

import java.util.Objects;

public record OidcBootstrapContext(
    RuntimeConfiguration configuration,
    BrowserContext browserContext,
    ExecutionReporter reporter
) {
    public OidcBootstrapContext {
        Objects.requireNonNull(configuration, "configuration");
        Objects.requireNonNull(browserContext, "browserContext");
        Objects.requireNonNull(reporter, "reporter");
    }
}
