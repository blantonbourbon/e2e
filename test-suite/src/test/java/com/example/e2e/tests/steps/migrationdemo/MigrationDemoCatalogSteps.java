package com.example.e2e.tests.steps.migrationdemo;

import com.example.e2e.tests.interactions.migrationdemo.CatalogInteractions;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;

public class MigrationDemoCatalogSteps {
    private final CatalogInteractions catalog = new CatalogInteractions();

    @When("the user opens the catalog")
    public void theUserOpensTheCatalog() {
        catalog.openCatalog();
    }

    @When("the user opens the {string} product")
    public void theUserOpensTheProduct(String productName) {
        catalog.openProduct(productName);
    }

    @Then("the catalog should show {string}")
    public void theCatalogShouldShow(String productName) {
        catalog.assertCatalogShows(productName);
    }

    @Then("the product details page should be shown for {string}")
    public void theProductDetailsPageShouldBeShownFor(String productName) {
        catalog.assertProductDetailsShownFor(productName);
    }

    @Then("the add to cart action should be available")
    public void theAddToCartActionShouldBeAvailable() {
        catalog.assertAddToCartAvailable();
    }
}
