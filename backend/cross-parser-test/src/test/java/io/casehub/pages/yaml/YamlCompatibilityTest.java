package io.casehub.pages.yaml;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;
import org.junit.jupiter.api.Test;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class YamlCompatibilityTest {

    private static final Path FIXTURES = Path.of("../../test/cross-parser/fixtures");
    private static final Path OUTPUT = Path.of("../../test/cross-parser/output");
    private final ObjectMapper yamlMapper = new ObjectMapper(new YAMLFactory());

    @Test
    void roundTrippedYamlParsesIdenticallyWithJackson() throws IOException {
        assertTrue(Files.isDirectory(FIXTURES), "Fixtures directory not found: " + FIXTURES.toAbsolutePath());
        assertTrue(Files.isDirectory(OUTPUT), "Output directory not found — run TS tests first: " + OUTPUT.toAbsolutePath());

        File[] fixtures = FIXTURES.toFile().listFiles((dir, name) -> name.endsWith(".yaml"));
        assertTrue(fixtures != null && fixtures.length > 0, "No YAML fixtures found");

        for (File fixture : fixtures) {
            File roundTripped = OUTPUT.resolve(fixture.getName()).toFile();
            assertTrue(roundTripped.exists(),
                "Round-tripped file missing for " + fixture.getName() + " — run TS tests first");

            JsonNode original = yamlMapper.readTree(fixture);
            JsonNode fromYamlNpm = yamlMapper.readTree(roundTripped);

            assertEquals(original, fromYamlNpm,
                "Jackson parse mismatch for " + fixture.getName() +
                "\nOriginal:      " + original +
                "\nRound-tripped: " + fromYamlNpm);
        }
    }
}
