package com.example.e2e.core.config;

import org.junit.jupiter.api.Test;

import java.net.URI;
import java.nio.file.Path;
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
        assertTrue(configuration.storageStatePath().isEmpty());
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
    void loadsStorageStatePathFromConfigurationWhenProvided() {
        RuntimeConfiguration configuration = RuntimeConfiguration.load(
            ConfigurationSource.of(
                Map.of(
                    "e2e.baseUrl", "http://localhost:3110",
                    "e2e.auth.storageStatePath", "playwright/.auth/user.json"
                ),
                Map.of()
            )
        );

        assertEquals(Path.of("playwright/.auth/user.json"), configuration.storageStatePath().orElseThrow());
    }

    @Test
    void systemPropertyOverridesEnvironmentStorageStatePath() {
        RuntimeConfiguration configuration = RuntimeConfiguration.load(
            ConfigurationSource.of(
                Map.of(
                    "e2e.baseUrl", "http://localhost:3110",
                    "e2e.auth.storageStatePath", "playwright/.auth/local.json"
                ),
                Map.of(
                    "E2E_AUTH_STORAGE_STATE_PATH", "playwright/.auth/env.json"
                )
            )
        );

        assertEquals(Path.of("playwright/.auth/local.json"), configuration.storageStatePath().orElseThrow());
    }

    @Test
    void failsFastWhenStorageStatePathIsBlank() {
        ConfigurationException exception = assertThrows(
            ConfigurationException.class,
            () -> RuntimeConfiguration.load(
                ConfigurationSource.of(
                    Map.of("e2e.baseUrl", "http://localhost:3110"),
                    Map.of("E2E_AUTH_STORAGE_STATE_PATH", "   ")
                )
            )
        );

        assertTrue(exception.getMessage().contains("E2E_AUTH_STORAGE_STATE_PATH"));
        assertTrue(exception.getMessage().contains("e2e.auth.storageStatePath"));
    }
}
