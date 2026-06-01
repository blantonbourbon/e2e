package com.example.e2e.tests.runner.sampleapp;

import org.junit.platform.suite.api.IncludeEngines;
import org.junit.platform.suite.api.SelectClasspathResource;
import org.junit.platform.suite.api.Suite;

@Suite
@IncludeEngines("cucumber")
@SelectClasspathResource("features/sample-app")
public class SampleAppRunCucumberTest {
}
