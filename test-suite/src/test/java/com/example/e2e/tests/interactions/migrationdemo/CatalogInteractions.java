package com.example.e2e.tests.interactions.migrationdemo;

import com.microsoft.playwright.Page;

import static org.junit.jupiter.api.Assertions.assertTrue;

public class CatalogInteractions {
    public void openCatalog() {
        MigrationDemoApp.page().locator("[data-testid='catalog-link']").click();
    }

    public void assertCatalogShows(String productName) {
        Page page = MigrationDemoApp.page();
        assertTrue(page.url().contains("catalog.html"),
                () -> "Expected catalog URL but was '%s'".formatted(page.url()));
        assertTrue(page.locator("[data-testid='catalog-heading']").isVisible(),
                "Expected catalog heading to be visible");
        assertTrue(page.locator("[data-testid='product-" + MigrationDemoApp.productSlug(productName) + "']").isVisible(),
                () -> "Expected catalog to show product '%s'".formatted(productName));
    }

    public void openProduct(String productName) {
        MigrationDemoApp.page()
                .locator("[data-testid='product-" + MigrationDemoApp.productSlug(productName) + "']")
                .click();
    }

    public void assertProductDetailsShownFor(String productName) {
        Page page = MigrationDemoApp.page();
        String productSlug = MigrationDemoApp.productSlug(productName);
        String productTitle = page.locator("[data-testid='product-title']").textContent();

        assertTrue(page.url().contains("product-" + productSlug + ".html"),
                () -> "Expected product URL for '%s' but was '%s'".formatted(productName, page.url()));
        assertTrue(productTitle.contains(productName),
                () -> "Expected product title to contain '%s' but was '%s'".formatted(productName, productTitle));
    }

    public void assertAddToCartAvailable() {
        assertTrue(MigrationDemoApp.page().locator("[data-testid='add-to-cart']").isVisible(),
                "Expected add to cart action to be visible");
    }
}
