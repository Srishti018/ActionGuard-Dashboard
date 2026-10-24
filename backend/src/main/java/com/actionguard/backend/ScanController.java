
package com.actionguard.backend;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.File;
import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.stream.Stream;
import java.util.Comparator;
@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "http://localhost:5173")
public class ScanController {

    private static final String SCANNER_DIR =
        "C:\\Users\\srish\\OneDrive\\Documents\\actionguard\\ActionGaurd";

    private static final String PYTHON =
        "C:\\Python313\\python.exe";

    private final ObjectMapper objectMapper = new ObjectMapper();

    public record ScanRequest(String repoUrl) {}

    @PostMapping(
        value = "/scan",
        consumes = MediaType.APPLICATION_JSON_VALUE,
        produces = MediaType.APPLICATION_JSON_VALUE
    )
    public ResponseEntity<String> scan(
        @RequestBody ScanRequest request
    ) throws Exception {

        String repoUrl = validateGitHubUrl(request.repoUrl());

        Path tempParent = Files.createTempDirectory("actionguard-");
        Path cloneDir = tempParent.resolve("repository");

        try {
            // Download the repository without running its scripts.
            ProcessResult clone = runCommand(
                new ProcessBuilder(
                    "git",
                    "clone",
                    "--depth", "1",
                    "--no-recurse-submodules",
                    "--",
                    repoUrl,
                    cloneDir.toString()
                ).directory(tempParent.toFile()),
                120
            );

            if (clone.exitCode() != 0) {
                throw new RuntimeException(
                    "Could not clone repository: " + clone.stderr()
                );
            }

            // Scan the downloaded repository, not the scanner's fixtures.
            ProcessResult scan = runCommand(
                new ProcessBuilder(
                    PYTHON,
                    "-u",
                    "-m", "actionguard.cli",
                    cloneDir.toString(),
                    "--json",
                    "--fail-on", "CRITICAL"
                ).directory(new File(SCANNER_DIR)),
                60
            );

            // A nonzero exit code is expected when the threshold is met.
            if (scan.stdout().isBlank()) {
                throw new RuntimeException(
                    "Scanner returned no JSON. " + scan.stderr()
                );
            }

            // Validate JSON before returning it to React.
            objectMapper.readTree(scan.stdout());

            return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_JSON)
                .body(scan.stdout());

        } finally {
            // Remove the downloaded repository after scanning.
            deleteDirectory(tempParent);
        }
    }

    private String validateGitHubUrl(String rawUrl) {
    if (rawUrl == null || rawUrl.isBlank()) {
        throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST,
            "Please enter a GitHub repository URL."
        );
    }

    try {
        URI uri = URI.create(rawUrl.trim());
        String path = uri.getPath();

        if (!"https".equalsIgnoreCase(uri.getScheme())
            || !"github.com".equalsIgnoreCase(uri.getHost())
            || uri.getUserInfo() != null
            || uri.getPort() != -1
            || path == null
            || !path.matches(
                "/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+(?:\\.git)?/?"
            )) {
            throw new IllegalArgumentException();
        }

        String cleanPath = path.replaceAll("/+$", "");

        if (cleanPath.endsWith(".git")) {
            cleanPath = cleanPath.substring(
                0, cleanPath.length() - 4
            );
        }

        return "https://github.com" + cleanPath + ".git";

    } catch (IllegalArgumentException e) {
        throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST,
            "Invalid GitHub URL. Use https://github.com/owner/repository"
        );
    }
}
    private ProcessResult runCommand(
        ProcessBuilder builder,
        long timeoutSeconds
    ) throws Exception {

        builder.redirectErrorStream(false);
        Process process = builder.start();

        CompletableFuture<String> stdout =
            CompletableFuture.supplyAsync(
                () -> readStream(process.getInputStream())
            );

        CompletableFuture<String> stderr =
            CompletableFuture.supplyAsync(
                () -> readStream(process.getErrorStream())
            );

        boolean completed = process.waitFor(
            timeoutSeconds, TimeUnit.SECONDS
        );

        if (!completed) {
            process.destroyForcibly();
            throw new RuntimeException(
                "Command timed out after " + timeoutSeconds + " seconds."
            );
        }

        return new ProcessResult(
            process.exitValue(),
            stdout.get(10, TimeUnit.SECONDS),
            stderr.get(10, TimeUnit.SECONDS)
        );
    }

    private String readStream(java.io.InputStream stream) {
        try {
            return new String(
                stream.readAllBytes(),
                StandardCharsets.UTF_8
            );
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
    }

    private void deleteDirectory(Path directory) throws IOException {
    if (directory == null || !Files.exists(directory)) {
        return;
    }

    try (var paths = Files.walk(directory)) {
        paths.sorted(Comparator.reverseOrder())
             .forEach(path -> {
                 try {
                     Files.deleteIfExists(path);
                 } catch (IOException e) {
                     System.err.println(
                         "Could not delete temporary file: "
                         + path + " - " + e.getMessage()
                     );
                 }
             });
    }
}

    private record ProcessResult(
        int exitCode,
        String stdout,
        String stderr
    ) {}
}
