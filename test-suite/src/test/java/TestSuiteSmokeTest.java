import io.qameta.allure.Allure;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class TestSuiteSmokeTest {
    @Test
    void testSuiteModuleDependsOnCore() {
        String moduleName = com.example.e2e.core.FrameworkMetadata.moduleName();

        Allure.step("Resolve the public framework marker from :core", () ->
            assertEquals("core", moduleName)
        );
        Allure.attachment("dependency-proof.txt", "Resolved core module marker: " + moduleName);
    }
}
