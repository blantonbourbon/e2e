package com.example.e2e.core.artifacts;

import java.util.Locale;
import java.util.Objects;

public final class ArtifactNaming {
    private ArtifactNaming() {
    }

    public static String scenarioArtifactId(String scenarioId, String scenarioName) {
        String rawValue = hasText(scenarioId) ? scenarioId : scenarioName;
        String sanitized = sanitize(rawValue);
        return sanitized.isBlank() ? "scenario" : sanitized;
    }

    public static String sanitize(String value) {
        Objects.requireNonNull(value, "value must not be null");
        return value.toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("(^-|-$)", "");
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
