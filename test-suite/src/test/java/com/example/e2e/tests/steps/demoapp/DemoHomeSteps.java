package com.example.e2e.tests.steps.demoapp;

import com.example.e2e.core.playwright.PlaywrightManager;
import io.cucumber.java.en.Then;

import static org.junit.jupiter.api.Assertions.assertTrue;

public class DemoHomeSteps {
    @Then("the get started link should be visible")
    public void theGetStartedLinkShouldBeVisible() {
        boolean visible = PlaywrightManager.page()
                .locator("text=Get started")
                .first()
                .isVisible();
        assertTrue(visible, "Expected Playwright documentation landing page to show the Get started link");
    }
}
