package com.example.e2e.core.auth.oidc;

import java.util.Objects;

public record ApiTokenMaterial(String token, String storageKey, String headerName) {
    public ApiTokenMaterial {
        Objects.requireNonNull(token, "token");
        Objects.requireNonNull(storageKey, "storageKey");
        Objects.requireNonNull(headerName, "headerName");
    }
}
