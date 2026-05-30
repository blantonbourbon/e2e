package com.example.e2e.tests.interactions.migrationdemo;

import com.example.e2e.core.playwright.PlaywrightManager;
import com.microsoft.playwright.Page;

import java.net.URL;
import java.util.Objects;

final class MigrationDemoApp {
    private MigrationDemoApp() {
    }

    static Page page() {
        return PlaywrightManager.page();
    }

    static String pageUrl(String fileName) {
        URL resource = MigrationDemoApp.class.getResource("/migrationdemo-app/" + fileName);
        return Objects.requireNonNull(resource, "Missing migration demo app resource: " + fileName)
                .toExternalForm();
    }

    static String productSlug(String productName) {
        return productName.toLowerCase().replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
    }
}
