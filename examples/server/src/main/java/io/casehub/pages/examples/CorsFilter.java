package io.casehub.pages.examples;

import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerResponseContext;
import org.jboss.resteasy.reactive.server.ServerResponseFilter;

public class CorsFilter {

    @ServerResponseFilter
    public void addCorsHeaders(ContainerRequestContext request, ContainerResponseContext response) {
        String origin = request.getHeaderString("Origin");
        if (origin != null) {
            response.getHeaders().putSingle("Access-Control-Allow-Origin", origin);
            response.getHeaders().putSingle("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
            response.getHeaders().putSingle("Access-Control-Allow-Headers", "Content-Type");
        }
    }
}