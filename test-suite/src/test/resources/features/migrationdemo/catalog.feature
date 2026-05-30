Feature: Migration demo catalog

  Background:
    Given the user is signed in as "standard visitor"

  Scenario: Visitor opens the catalog from the home page
    When the user opens the catalog
    Then the catalog should show "Backpack"

  Scenario Outline: Visitor opens product details from the catalog
    When the user opens the catalog
    And the user opens the "<product>" product
    Then the product details page should be shown for "<product>"
    And the add to cart action should be available

    Examples:
      | product  |
      | Backpack |
