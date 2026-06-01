package com.example.e2e.core.auth.oidc;

import com.example.e2e.core.config.ConfigurationException;
import com.example.e2e.core.config.FrameworkConfig;
import com.example.e2e.core.config.OidcHandlerType;
import com.microsoft.playwright.Browser;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PluggableOidcAuthBootstrapperTest {
    @TempDir
    Path tempDir;

    @Test
    void savedSessionHandlerProvidesStorageStateBeforeContextCreation() throws Exception {
        FrameworkConfig config = FrameworkConfig.from(
                Map.of(
                        "e2e.baseUrl", "http://localhost:3110",
                        "artifacts.dir", tempDir.toString(),
                        "e2e.auth.mode", "oidc",
                        "e2e.oidc.handler", "saved-session"
                ),
                Map.of()
        );

        OidcBootstrapPlan plan = new PluggableOidcAuthBootstrapper().prepare(config, "sample-scenario");
        Browser.NewContextOptions options = new Browser.NewContextOptions();
        plan.applyTo(options);

        assertNotNull(options.storageStatePath);
        assertTrue(Files.exists(options.storageStatePath));
        assertTrue(Files.readString(options.storageStatePath).contains("\"origin\": \"http://localhost:3110\""));
        assertTrue(Files.readString(options.storageStatePath).contains("\"sample-app-role\""));
    }

    @Test
    void apiTokenHandlerProvidesContextHeadersAndInitScript() {
        FrameworkConfig config = FrameworkConfig.from(
                Map.of(
                        "e2e.baseUrl", "http://localhost:3110",
                        "e2e.auth.mode", "oidc",
                        "e2e.oidc.handler", "api-token",
                        "e2e.oidc.apiToken", "token-123"
                ),
                Map.of()
        );

        OidcBootstrapPlan plan = new PluggableOidcAuthBootstrapper().prepare(config, "sample-scenario");
        Browser.NewContextOptions options = new Browser.NewContextOptions();
        plan.applyTo(options);

        assertEquals("Bearer token-123", options.extraHTTPHeaders.get("Authorization"));
        assertTrue(plan.initScript().contains("sample-app-role"));
    }

    @Test
    void duplicateHandlerRegistrationFailsFast() {
        OidcHandler first = new StubHandler();
        OidcHandler duplicate = new StubHandler();

        ConfigurationException exception = assertThrows(ConfigurationException.class, () ->
                new OidcHandlerRegistry(List.of(first, duplicate))
        );

        assertTrue(exception.getMessage().contains("Duplicate OIDC handler registration for 'saved-session'"));
    }

    private static final class StubHandler implements OidcHandler {
        @Override
        public OidcHandlerType type() {
            return OidcHandlerType.SAVED_SESSION;
        }

        @Override
        public OidcBootstrapPlan bootstrap(OidcBootstrapContext context) {
            return OidcBootstrapPlan.baseline();
        }
    }
}
