package io.casehub.pages.playbook.runtime;

import java.util.List;
import java.util.concurrent.ConcurrentLinkedDeque;

class ActivationLog {

    private final int maxSize;
    private final ConcurrentLinkedDeque<ActivationRecord> records =
            new ConcurrentLinkedDeque<>();

    ActivationLog(int maxSize) {
        this.maxSize = maxSize;
    }

    void record(ActivationRecord entry) {
        records.addFirst(entry);
        while (records.size() > maxSize) {
            records.removeLast();
        }
    }

    List<ActivationRecord> recent(int limit) {
        return records.stream().limit(limit).toList();
    }

    List<ActivationRecord> forPlaybook(String name, int limit) {
        return records.stream()
                .filter(r -> r.playbookName().equals(name))
                .limit(limit)
                .toList();
    }
}
