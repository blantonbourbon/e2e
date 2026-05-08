package com.example.e2e.tests.steps.common;

import com.example.e2e.core.playwright.PlaywrightManager;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;

import static org.junit.jupiter.api.Assertions.assertTrue;

public class CommonNavigationSteps {
    @Given("the user opens the relative path {string}")
    public void theUserOpensTheRelativePath(String path) {
        PlaywrightManager.page().navigate(path);
    }

    @Then("the page title should contain {string}")
    public void thePageTitleShouldContain(String expectedTitle) {
        String title = PlaywrightManager.page().title();
        assertTrue(title.contains(expectedTitle),
                () -> "Expected title to contain '%s' but was '%s'".formatted(expectedTitle, title));
    }
}
