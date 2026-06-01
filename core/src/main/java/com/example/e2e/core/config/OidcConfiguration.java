package com.example.e2e.core.config;

import java.nio.file.Path;

public record OidcConfiguration(
        OidcHandlerType handlerType,
        Path storageStatePath,
        String apiToken
) {
}
