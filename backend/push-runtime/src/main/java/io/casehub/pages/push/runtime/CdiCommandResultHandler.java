package io.casehub.pages.push.runtime;

import io.casehub.pages.push.CommandResultHandler;
import io.casehub.pages.push.PushRequest;
import io.quarkus.arc.DefaultBean;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Event;
import jakarta.inject.Inject;

import java.util.function.Consumer;

@ApplicationScoped
@DefaultBean
public class CdiCommandResultHandler implements CommandResultHandler {

    private final Consumer<PushRequest.CommandResult> sink;

    @Inject
    public CdiCommandResultHandler(Event<PushRequest.CommandResult> event) {
        this(event::fire);
    }

    CdiCommandResultHandler(Consumer<PushRequest.CommandResult> sink) {
        this.sink = sink;
    }

    @Override
    public void handle(PushRequest.CommandResult result) {
        sink.accept(result);
    }
}
