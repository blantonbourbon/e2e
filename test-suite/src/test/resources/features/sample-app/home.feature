@sample-app
Feature: Sample app home

  Scenario: Guest user increments the sample counter
    Given the sample app is open
    Then the sample app should show guest mode
    And the sample counter should show "0"
    When the user increments the sample counter
    Then the sample counter should show "1"

  @oidc
  Scenario: OIDC saved session opens authenticated sample app
    Given the sample app is open
    Then the sample app should show authenticated mode
    And the sample counter should show "0"
    When the user increments the sample counter
    Then the sample counter should show "1"

  @diagnostic-failure
  Scenario: Diagnostic assertion failure preserves artifacts
    Given the sample app is open
    Then the sample counter should show "99"
