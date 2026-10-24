
package com.actionguard.backend;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.CrossOrigin;
@RestController
@CrossOrigin(origins = "http://localhost:5173")

public class HealthController {

    @GetMapping("/api/health")
    public String health() {
        return "ActionGuard backend is running!";
    }
}