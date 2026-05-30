Feature: Migration demo catalog

  Background:
    Given the visitor signs in as a standard visitor

  Scenario: Visitor opens the catalog from the home page
    When the visitor opens the catalog
    Then the catalog should show Backpack

  Scenario: Visitor opens product details from the catalog
    When the visitor opens the catalog
    And the visitor opens the Backpack product
    Then the Backpack product details should be shown
    And the add to cart action should be available
