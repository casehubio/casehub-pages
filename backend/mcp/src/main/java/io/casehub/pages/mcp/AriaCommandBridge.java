package io.casehub.pages.mcp;

import io.casehub.pages.push.EventBroadcaster;
import io.casehub.pages.push.PushRequest;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

public class AriaCommandBridge {

    private final EventBroadcaster broadcaster;
    private final Map<String, CompletableFuture<PushRequest.CommandResult>> pending = new ConcurrentHashMap<>();
    private final long timeoutMs;

    public AriaCommandBridge(EventBroadcaster broadcaster, long timeoutMs) {
        this.broadcaster = broadcaster;
        this.timeoutMs = timeoutMs;
    }

    public AriaCommandBridge(EventBroadcaster broadcaster) {
        this(broadcaster, 10_000);
    }

    public record CommandPayload(String id, String action, Object target, String value,
                                 Map<String, Object> state, Integer timeout) {}

    public PushRequest.CommandResult send(String action, Object target, String value,
                                          Map<String, Object> state, Integer timeout) {
        var id = UUID.randomUUID().toString();
        var future = new CompletableFuture<PushRequest.CommandResult>();
        pending.put(id, future);

        try {
            var payload = new CommandPayload(id, action, target, value, state, timeout);
            broadcaster.broadcast("scenario/cmd-" + id, payload);
            return future.get(timeoutMs, TimeUnit.MILLISECONDS);
        } catch (TimeoutException e) {
            throw new AriaCommandException("Command timed out after " + timeoutMs + "ms: " + action);
        } catch (Exception e) {
            throw new AriaCommandException("Command failed: " + e.getMessage(), e);
        } finally {
            pending.remove(id);
        }
    }

    public void handleResult(PushRequest.CommandResult result) {
        var future = pending.get(result.id());
        if (future != null) {
            future.complete(result);
        }
    }

    public int pendingCount() {
        return pending.size();
    }
}
