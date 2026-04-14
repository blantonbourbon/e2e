package com.example.e2e.core.auth.oidc;

import java.util.Map;
import java.util.Objects;

public record SavedSessionMaterial(String subject, Map<String, String> localStorageEntries) {
    public SavedSessionMaterial {
        Objects.requireNonNull(subject, "subject");
        localStorageEntries = Map.copyOf(Objects.requireNonNull(localStorageEntries, "localStorageEntries"));
    }
}
