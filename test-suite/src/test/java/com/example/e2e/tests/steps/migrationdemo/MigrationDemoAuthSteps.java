package com.example.e2e.tests.steps.migrationdemo;

import com.example.e2e.tests.interactions.migrationdemo.AuthInteractions;
import io.cucumber.java.en.Given;

public class MigrationDemoAuthSteps {
    private final AuthInteractions auth = new AuthInteractions();

    @Given("the user is signed in as {string}")
    public void theUserIsSignedInAs(String role) {
        auth.signInAs(role);
    }
}
