package com.example.e2e.core.config;

import java.util.Arrays;
import java.util.Locale;
import java.util.stream.Collectors;

public enum AuthMode {
    BASELINE,
    OIDC;

    public static AuthMode parse(String value) {
        if (value == null || value.isBlank()) {
            return BASELINE;
        }

        String normalized = value.trim().replace('-', '_').toUpperCase(Locale.ROOT);
        try {
            return AuthMode.valueOf(normalized);
        } catch (IllegalArgumentException exception) {
            throw new ConfigurationException(
                    "Unsupported auth mode '%s'. Supported values: %s"
                            .formatted(value, supportedValues()),
                    exception
            );
        }
    }

    private static String supportedValues() {
        return Arrays.stream(values())
                .map(value -> value.name().toLowerCase(Locale.ROOT).replace('_', '-'))
                .collect(Collectors.joining(", "));
    }
}
