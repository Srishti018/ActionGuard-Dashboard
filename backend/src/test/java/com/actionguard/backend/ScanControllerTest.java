
package com.actionguard.backend;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.boot.test.context.SpringBootTest;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class ScanControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void rejectsEmptyRepositoryUrl() throws Exception {
        mockMvc.perform(post("/api/scan")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"repoUrl\":\"\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void rejectsNonGitHubUrl() throws Exception {
        mockMvc.perform(post("/api/scan")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"repoUrl\":\"https://example.com/test/repo\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void rejectsHttpGitHubUrl() throws Exception {
        mockMvc.perform(post("/api/scan")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"repoUrl\":\"http://github.com/user/repo\"}"))
                .andExpect(status().isBadRequest());
    }
}
