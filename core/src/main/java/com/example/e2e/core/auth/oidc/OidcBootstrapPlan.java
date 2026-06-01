package com.example.e2e.core.auth.oidc;

import com.microsoft.playwright.Browser;
import com.microsoft.playwright.BrowserContext;

import java.nio.file.Path;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

public record OidcBootstrapPlan(
        String description,
        Path storageStatePath,
        Map<String, String> extraHttpHeaders,
        String initScript
) {
    public static OidcBootstrapPlan baseline() {
        return new OidcBootstrapPlan("baseline auth mode", null, Map.of(), null);
    }

    public OidcBootstrapPlan {
        extraHttpHeaders = extraHttpHeaders == null
                ? Map.of()
                : Collections.unmodifiableMap(new LinkedHashMap<>(extraHttpHeaders));
    }

    public void applyTo(Browser.NewContextOptions contextOptions) {
        if (storageStatePath != null) {
            contextOptions.setStorageStatePath(storageStatePath);
        }
        if (!extraHttpHeaders.isEmpty()) {
            contextOptions.setExtraHTTPHeaders(extraHttpHeaders);
        }
    }

    public void applyTo(BrowserContext context) {
        if (initScript != null && !initScript.isBlank()) {
            context.addInitScript(initScript);
        }
    }
}
