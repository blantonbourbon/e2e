import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class CoreSmokeTest {
    @Test
    void coreModuleIsConfigured() {
        assertEquals("core", com.example.e2e.core.FrameworkMetadata.moduleName());
    }
}
