package com.example.e2e.core.runtime;

import java.util.Locale;
import java.util.Objects;

public record PlaywrightRuntimeOptions(String browserName, boolean headless) {
    public PlaywrightRuntimeOptions {
        Objects.requireNonNull(browserName, "browserName");
    }

    public static PlaywrightRuntimeOptions defaults() {
        return new PlaywrightRuntimeOptions("chromium", true);
    }

    public String normalizedBrowserName() {
        return browserName.trim().toLowerCase(Locale.ROOT);
    }
}
