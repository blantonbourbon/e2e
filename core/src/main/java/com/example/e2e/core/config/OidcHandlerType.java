package com.example.e2e.core.config;

import java.util.Arrays;
import java.util.Locale;
import java.util.stream.Collectors;

public enum OidcHandlerType {
    SAVED_SESSION,
    API_TOKEN;

    public static OidcHandlerType parse(String value) {
        if (value == null || value.isBlank()) {
            throw new ConfigurationException(
                    "OIDC mode requires an OIDC handler. Set e2e.oidc.handler or E2E_OIDC_HANDLER to one of: "
                            + supportedValues()
            );
        }

        String normalized = value.trim().replace('-', '_').toUpperCase(Locale.ROOT);
        try {
            return OidcHandlerType.valueOf(normalized);
        } catch (IllegalArgumentException exception) {
            throw new ConfigurationException(
                    "Unsupported OIDC handler '%s'. Supported values: %s"
                            .formatted(value, supportedValues()),
                    exception
            );
        }
    }

    public String configValue() {
        return name().toLowerCase(Locale.ROOT).replace('_', '-');
    }

    private static String supportedValues() {
        return Arrays.stream(values())
                .map(OidcHandlerType::configValue)
                .collect(Collectors.joining(", "));
    }
}
