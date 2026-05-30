package com.example.e2e.tests.interactions.migrationdemo;

import com.microsoft.playwright.Page;

import static org.junit.jupiter.api.Assertions.assertTrue;

public class AuthInteractions {
    public void signInAs(String role) {
        if (!"standard visitor".equals(role)) {
            throw new IllegalArgumentException("Unsupported migration demo role: " + role);
        }

        Page page = MigrationDemoApp.page();
        page.navigate(MigrationDemoApp.pageUrl("index.html"));
        page.evaluate("localStorage.clear()");
        page.locator("[data-testid='username']").fill("standard");
        page.locator("[data-testid='password']").fill("password");
        page.locator("[data-testid='sign-in']").click();

        String welcomeMessage = page.locator("[data-testid='welcome-message']").textContent();
        assertTrue(welcomeMessage.contains(role),
                () -> "Expected welcome message to contain '%s' but was '%s'".formatted(role, welcomeMessage));
    }
}
