package com.example.e2e.tests.steps.sampleapp;

import com.example.e2e.core.playwright.PlaywrightManager;
import com.microsoft.playwright.Page;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

public class SampleAppSteps {
    @Given("the sample app is open")
    public void theSampleAppIsOpen() {
        page().navigate("/");
    }

    @Then("the sample app should show guest mode")
    public void theSampleAppShouldShowGuestMode() {
        assertThat(page().getByTestId("session-state")).containsText("Guest session");
    }

    @Then("the sample app should show authenticated mode")
    public void theSampleAppShouldShowAuthenticatedMode() {
        assertThat(page().getByTestId("session-state")).containsText("Authenticated as standard visitor");
    }

    @Then("the sample counter should show {string}")
    public void theSampleCounterShouldShow(String value) {
        assertThat(page().getByTestId("counter-value")).containsText(value);
    }

    @When("the user increments the sample counter")
    public void theUserIncrementsTheSampleCounter() {
        page().getByTestId("increment-counter").click();
    }

    private Page page() {
        return PlaywrightManager.page();
    }
}
