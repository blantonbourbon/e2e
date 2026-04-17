package app1.steps;

import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;

import static org.junit.jupiter.api.Assertions.assertEquals;

public class App1Steps {
    private String frameworkMarker;

    @When("I resolve the shared framework marker")
    public void iResolveTheSharedFrameworkMarker() {
        frameworkMarker = com.example.e2e.core.FrameworkMetadata.moduleName();
    }

    @Then("the shared framework marker should be {string}")
    public void theSharedFrameworkMarkerShouldBe(String expectedFrameworkMarker) {
        assertEquals(expectedFrameworkMarker, frameworkMarker);
    }
}
