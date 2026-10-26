package io.casehub.pages.playbook.runtime;

import java.util.ArrayDeque;
import java.util.Deque;

class ActivationQueue {

    private final int maxSize;
    private final Deque<PendingActivation> pending = new ArrayDeque<>();

    ActivationQueue(int maxSize) {
        this.maxSize = maxSize;
    }

    synchronized boolean offer(PendingActivation activation) {
        if (pending.size() >= maxSize) return false;
        return pending.offerLast(activation);
    }

    synchronized PendingActivation poll() {
        return pending.pollFirst();
    }

    synchronized PendingActivation peek() {
        return pending.peekFirst();
    }

    synchronized int size() {
        return pending.size();
    }
}
