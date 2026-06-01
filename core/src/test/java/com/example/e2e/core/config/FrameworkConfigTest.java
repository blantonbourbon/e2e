package com.example.e2e.core.config;

import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class FrameworkConfigTest {
    @Test
    void loadsBaseUrlFromMissionSystemProperty() {
        FrameworkConfig config = FrameworkConfig.from(
                Map.of("e2e.baseUrl", "http://localhost:3110"),
                Map.of()
        );

        assertEquals("http://localhost:3110", config.baseUrl());
        assertEquals(AuthMode.BASELINE, config.authMode());
    }

    @Test
    void loadsBaseUrlFromMissionEnvironmentVariable() {
        FrameworkConfig config = FrameworkConfig.from(
                Map.of(),
                Map.of("E2E_BASE_URL", "https://demo.example.test")
        );

        assertEquals("https://demo.example.test", config.baseUrl());
    }

    @Test
    void missionSystemPropertyOverridesLegacyBaseUrl() {
        Map<String, String> properties = new HashMap<>();
        properties.put("e2e.baseUrl", "http://localhost:3110");
        properties.put("base.url", "https://playwright.dev");

        FrameworkConfig config = FrameworkConfig.from(properties, Map.of());

        assertEquals("http://localhost:3110", config.baseUrl());
    }

    @Test
    void rejectsHostlessHttpUrlBeforePlaywrightStarts() {
        ConfigurationException exception = assertThrows(ConfigurationException.class, () ->
                FrameworkConfig.from(Map.of("e2e.baseUrl", "https:/demo.example.test"), Map.of())
        );

        assertEquals(
                "Invalid base URL 'https:/demo.example.test'. Set e2e.baseUrl, E2E_BASE_URL, or legacy base.url to an absolute http(s) URL with a host.",
                exception.getMessage()
        );
    }

    @Test
    void rejectsUnsupportedBaseUrlScheme() {
        ConfigurationException exception = assertThrows(ConfigurationException.class, () ->
                FrameworkConfig.from(Map.of("e2e.baseUrl", "file:///tmp/demo.html"), Map.of())
        );

        assertEquals(
                "Invalid base URL 'file:///tmp/demo.html'. Set e2e.baseUrl, E2E_BASE_URL, or legacy base.url to an absolute http(s) URL with a host.",
                exception.getMessage()
        );
    }

    @Test
    void loadsOidcHandlerFromMissionInputs() {
        FrameworkConfig config = FrameworkConfig.from(
                Map.of(
                        "e2e.baseUrl", "http://localhost:3110",
                        "e2e.auth.mode", "oidc",
                        "e2e.oidc.handler", "saved-session"
                ),
                Map.of()
        );

        assertEquals(AuthMode.OIDC, config.authMode());
        assertEquals(OidcHandlerType.SAVED_SESSION, config.oidc().handlerType());
    }

    @Test
    void oidcModeRequiresHandler() {
        ConfigurationException exception = assertThrows(ConfigurationException.class, () ->
                FrameworkConfig.from(
                        Map.of(
                                "e2e.baseUrl", "http://localhost:3110",
                                "e2e.auth.mode", "oidc"
                        ),
                        Map.of()
                )
        );

        assertEquals(
                "OIDC mode requires an OIDC handler. Set e2e.oidc.handler or E2E_OIDC_HANDLER to one of: saved-session, api-token",
                exception.getMessage()
        );
    }
}
