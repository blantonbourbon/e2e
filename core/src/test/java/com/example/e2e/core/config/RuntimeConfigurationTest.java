package com.example.e2e.core.config;

import org.junit.jupiter.api.Test;

import java.net.URI;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RuntimeConfigurationTest {
    @Test
    void loadsBaseUrlFromEnvironmentWhenValid() {
        RuntimeConfiguration configuration = RuntimeConfiguration.load(
            ConfigurationSource.of(
                Map.of(),
                Map.of("E2E_BASE_URL", "https://demo.example.test")
            )
        );

        assertEquals(URI.create("https://demo.example.test"), configuration.baseUrl());
        assertEquals(AuthMode.BASELINE, configuration.authMode());
    }

    @Test
    void systemPropertyOverridesEnvironmentBaseUrl() {
        RuntimeConfiguration configuration = RuntimeConfiguration.load(
            ConfigurationSource.of(
                Map.of("e2e.baseUrl", "http://localhost:3110"),
                Map.of("E2E_BASE_URL", "https://ignored.example.test")
            )
        );

        assertEquals(URI.create("http://localhost:3110"), configuration.baseUrl());
    }

    @Test
    void failsFastWhenBaseUrlIsMissing() {
        ConfigurationException exception = assertThrows(
            ConfigurationException.class,
            () -> RuntimeConfiguration.load(ConfigurationSource.of(Map.of(), Map.of()))
        );

        assertTrue(exception.getMessage().contains("E2E_BASE_URL"));
        assertTrue(exception.getMessage().contains("e2e.baseUrl"));
    }

    @Test
    void failsFastWhenBaseUrlIsInvalid() {
        ConfigurationException exception = assertThrows(
            ConfigurationException.class,
            () -> RuntimeConfiguration.load(
                ConfigurationSource.of(Map.of(), Map.of("E2E_BASE_URL", "ftp://demo.example.test"))
            )
        );

        assertTrue(exception.getMessage().contains("E2E_BASE_URL"));
        assertTrue(exception.getMessage().contains("http"));
    }

    @Test
    void loadsOidcModeWhenHandlerIsConfigured() {
        RuntimeConfiguration configuration = RuntimeConfiguration.load(
            ConfigurationSource.of(
                Map.of(
                    "e2e.baseUrl", "http://localhost:3110",
                    "e2e.auth.mode", "oidc",
                    "e2e.oidc.handler", "saved-session"
                ),
                Map.of()
            )
        );

        assertEquals(AuthMode.OIDC, configuration.authMode());
        assertEquals(OidcHandlerType.SAVED_SESSION, configuration.oidc().orElseThrow().handler());
    }

    @Test
    void failsFastWhenOidcModeIsMissingHandler() {
        ConfigurationException exception = assertThrows(
            ConfigurationException.class,
            () -> RuntimeConfiguration.load(
                ConfigurationSource.of(
                    Map.of(
                        "e2e.baseUrl", "http://localhost:3110",
                        "e2e.auth.mode", "oidc"
                    ),
                    Map.of()
                )
            )
        );

        assertTrue(exception.getMessage().contains("E2E_OIDC_HANDLER"));
        assertTrue(exception.getMessage().contains("e2e.oidc.handler"));
    }

    @Test
    void failsFastWhenAuthModeIsInvalid() {
        ConfigurationException exception = assertThrows(
            ConfigurationException.class,
            () -> RuntimeConfiguration.load(
                ConfigurationSource.of(
                    Map.of(
                        "e2e.baseUrl", "http://localhost:3110",
                        "e2e.auth.mode", "mystery"
                    ),
                    Map.of()
                )
            )
        );

        assertTrue(exception.getMessage().contains("E2E_AUTH_MODE"));
        assertTrue(exception.getMessage().contains("baseline"));
        assertTrue(exception.getMessage().contains("oidc"));
    }

    @Test
    void failsFastWhenOidcHandlerIsInvalid() {
        ConfigurationException exception = assertThrows(
            ConfigurationException.class,
            () -> RuntimeConfiguration.load(
                ConfigurationSource.of(
                    Map.of(
                        "e2e.baseUrl", "http://localhost:3110",
                        "e2e.auth.mode", "oidc",
                        "e2e.oidc.handler", "browser-magic"
                    ),
                    Map.of()
                )
            )
        );

        assertTrue(exception.getMessage().contains("E2E_OIDC_HANDLER"));
        assertTrue(exception.getMessage().contains("saved-session"));
        assertTrue(exception.getMessage().contains("api-token"));
    }
}
