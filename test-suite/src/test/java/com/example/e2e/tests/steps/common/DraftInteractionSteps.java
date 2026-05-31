package com.example.e2e.tests.steps.common;

import com.example.e2e.core.playwright.PlaywrightManager;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.AriaRole;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;

import java.util.Locale;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

public class DraftInteractionSteps {
    @When("the user clicks the {word} named {string}")
    public void theUserClicksTheRoleNamed(String role, String name) {
        page().getByRole(ariaRole(role), new Page.GetByRoleOptions().setName(name)).click();
    }

    @When("the user clicks the text {string}")
    public void theUserClicksTheText(String text) {
        page().getByText(text).click();
    }

    @When("the user clicks selector {string}")
    public void theUserClicksSelector(String selector) {
        page().locator(selector).click();
    }

    @When("the user fills the field labeled {string} with {string}")
    public void theUserFillsTheFieldLabeled(String label, String value) {
        page().getByLabel(label).fill(value);
    }

    @When("the user fills the field with placeholder {string} with {string}")
    public void theUserFillsTheFieldWithPlaceholder(String placeholder, String value) {
        page().getByPlaceholder(placeholder).fill(value);
    }

    @When("the user fills selector {string} with {string}")
    public void theUserFillsSelector(String selector, String value) {
        page().locator(selector).fill(value);
    }

    @Then("the {word} named {string} should be visible")
    public void theRoleNamedShouldBeVisible(String role, String name) {
        assertThat(page().getByRole(ariaRole(role), new Page.GetByRoleOptions().setName(name))).isVisible();
    }

    @Then("the text {string} should be visible")
    public void theTextShouldBeVisible(String text) {
        assertThat(page().getByText(text)).isVisible();
    }

    @Then("selector {string} should be visible")
    public void selectorShouldBeVisible(String selector) {
        assertThat(page().locator(selector)).isVisible();
    }

    private Page page() {
        return PlaywrightManager.page();
    }

    private AriaRole ariaRole(String role) {
        return AriaRole.valueOf(role.replace("-", "_").toUpperCase(Locale.ROOT));
    }
}
