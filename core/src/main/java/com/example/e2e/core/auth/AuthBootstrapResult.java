package com.example.e2e.core.auth;

import com.example.e2e.core.auth.oidc.OidcBootstrapResult;
import com.example.e2e.core.config.AuthMode;

import java.util.Objects;
import java.util.Optional;

public record AuthBootstrapResult(AuthMode mode, Optional<OidcBootstrapResult> oidc) {
    public AuthBootstrapResult {
        Objects.requireNonNull(mode, "mode");
        oidc = Objects.requireNonNull(oidc, "oidc");
    }

    public static AuthBootstrapResult baseline() {
        return new AuthBootstrapResult(AuthMode.BASELINE, Optional.empty());
    }

    public static AuthBootstrapResult oidc(OidcBootstrapResult result) {
        return new AuthBootstrapResult(AuthMode.OIDC, Optional.of(Objects.requireNonNull(result, "result")));
    }
}
