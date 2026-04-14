package com.example.e2e.core.auth.oidc;

import com.example.e2e.core.config.RuntimeConfiguration;

import java.util.Optional;

@FunctionalInterface
public interface ApiTokenSupplier {
    Optional<ApiTokenMaterial> load(RuntimeConfiguration configuration);
}
