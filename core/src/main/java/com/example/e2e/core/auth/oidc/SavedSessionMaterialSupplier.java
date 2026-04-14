package com.example.e2e.core.auth.oidc;

import com.example.e2e.core.config.RuntimeConfiguration;

import java.util.Optional;

@FunctionalInterface
public interface SavedSessionMaterialSupplier {
    Optional<SavedSessionMaterial> load(RuntimeConfiguration configuration);
}
