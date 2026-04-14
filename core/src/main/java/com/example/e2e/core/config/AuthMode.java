package com.example.e2e.core.config;

import java.util.Arrays;
import java.util.Locale;
import java.util.stream.Collectors;

public enum AuthMode {
    BASELINE,
    OIDC;

    static AuthMode parse(ConfigurationSource.ResolvedValue resolvedValue) {
        String value = normalized(resolvedValue.value());

        for (AuthMode mode : values()) {
            if (mode.externalValue().equals(value)) {
                return mode;
            }
        }

        throw new ConfigurationException(
            "Invalid auth mode from "
                + resolvedValue.key()
                + ": '"
                + resolvedValue.value()
                + "'. Use e2e.auth.mode or E2E_AUTH_MODE with one of: "
                + supportedValues()
                + "."
        );
    }

    private static String normalized(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }

    private String externalValue() {
        return name().toLowerCase(Locale.ROOT);
    }

    private static String supportedValues() {
        return Arrays.stream(values())
            .map(AuthMode::externalValue)
            .collect(Collectors.joining(", "));
    }
}
