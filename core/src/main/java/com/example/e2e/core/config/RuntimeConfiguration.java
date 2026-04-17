package com.example.e2e.core.config;

import java.net.URI;
import java.net.URISyntaxException;
import java.nio.file.InvalidPathException;
import java.nio.file.Path;
import java.util.Objects;
import java.util.Optional;

public record RuntimeConfiguration(URI baseUrl, Optional<Path> storageStatePath) {
    private static final String BASE_URL_PROPERTY = "e2e.baseUrl";
    private static final String BASE_URL_ENVIRONMENT = "E2E_BASE_URL";
    private static final String STORAGE_STATE_PATH_PROPERTY = "e2e.auth.storageStatePath";
    private static final String STORAGE_STATE_PATH_ENVIRONMENT = "E2E_AUTH_STORAGE_STATE_PATH";

    public RuntimeConfiguration {
        Objects.requireNonNull(baseUrl, "baseUrl");
        storageStatePath = Objects.requireNonNull(storageStatePath, "storageStatePath");
    }

    public static RuntimeConfiguration load() {
        return load(ConfigurationSource.system());
    }

    public static RuntimeConfiguration load(ConfigurationSource source) {
        ConfigurationSource.ResolvedValue baseUrlValue = source.resolve(BASE_URL_PROPERTY, BASE_URL_ENVIRONMENT);
        URI baseUrl = parseBaseUrl(baseUrlValue);

        Optional<Path> storageStatePath = parseStorageStatePath(
            source.resolve(STORAGE_STATE_PATH_PROPERTY, STORAGE_STATE_PATH_ENVIRONMENT)
        );

        return new RuntimeConfiguration(baseUrl, storageStatePath);
    }

    private static URI parseBaseUrl(ConfigurationSource.ResolvedValue baseUrlValue) {
        if (baseUrlValue == null) {
            throw new ConfigurationException(
                "Missing base URL configuration. Set "
                    + BASE_URL_PROPERTY
                    + " or "
                    + BASE_URL_ENVIRONMENT
                    + " to an absolute http(s) URL."
            );
        }

        String rawValue = normalized(baseUrlValue.value());
        if (rawValue.isEmpty()) {
            throw new ConfigurationException(
                "Invalid base URL from "
                    + baseUrlValue.key()
                    + ": value is blank. Set "
                    + BASE_URL_PROPERTY
                    + " or "
                    + BASE_URL_ENVIRONMENT
                    + " to an absolute http(s) URL."
            );
        }

        try {
            URI uri = new URI(rawValue);
            String scheme = uri.getScheme();
            if (!uri.isAbsolute() || scheme == null || !(scheme.equals("http") || scheme.equals("https"))) {
                throw invalidBaseUrl(baseUrlValue);
            }
            return uri;
        } catch (URISyntaxException exception) {
            throw invalidBaseUrl(baseUrlValue);
        }
    }

    private static Optional<Path> parseStorageStatePath(ConfigurationSource.ResolvedValue storageStatePathValue) {
        if (storageStatePathValue == null) {
            return Optional.empty();
        }

        String rawValue = normalized(storageStatePathValue.value());
        if (rawValue.isEmpty()) {
            throw new ConfigurationException(
                "Invalid storage state path from "
                    + storageStatePathValue.key()
                    + ": value is blank. Set "
                    + STORAGE_STATE_PATH_PROPERTY
                    + " or "
                    + STORAGE_STATE_PATH_ENVIRONMENT
                    + " to the Playwright storage state file path."
            );
        }

        try {
            return Optional.of(Path.of(rawValue));
        } catch (InvalidPathException exception) {
            throw new ConfigurationException(
                "Invalid storage state path from "
                    + storageStatePathValue.key()
                    + ": '"
                    + storageStatePathValue.value()
                    + "'. Use "
                    + STORAGE_STATE_PATH_PROPERTY
                    + " or "
                    + STORAGE_STATE_PATH_ENVIRONMENT
                    + " with a valid file path."
            );
        }
    }

    private static ConfigurationException invalidBaseUrl(ConfigurationSource.ResolvedValue baseUrlValue) {
        return new ConfigurationException(
            "Invalid base URL from "
                + baseUrlValue.key()
                + ": '"
                + baseUrlValue.value()
                + "'. Use "
                + BASE_URL_PROPERTY
                + " or "
                + BASE_URL_ENVIRONMENT
                + " with an absolute http(s) URL."
        );
    }

    private static String normalized(String value) {
        return value == null ? "" : value.trim();
    }
}
