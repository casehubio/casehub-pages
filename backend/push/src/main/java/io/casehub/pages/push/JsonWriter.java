package io.casehub.pages.push;

@FunctionalInterface
public interface JsonWriter {

    String toJson(Object value) throws Exception;
}
