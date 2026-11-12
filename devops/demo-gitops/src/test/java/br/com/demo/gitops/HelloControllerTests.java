package br.com.demo.gitops;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest
public class HelloControllerTests {

    @Autowired
    private MockMvc mockMvc;

    @Test
    public void deveRetornarSaudacaoComSucesso() throws Exception {
        mockMvc.perform(get("/hello"))
                .andExpect(status().isOk())
                .andExpect(content().string("Hello from GitOps Demo!"));
    }

    @Test
    public void deveRetornar404ParaRotaInexistente() throws Exception {
        mockMvc.perform(get("/rota-que-nao-existe"))
                .andExpect(status().isNotFound());
    }
    
}
