package io.casehub.pages.push;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PushRequestTest {

    @Test
    void parse_subscribe_with_since() {
        PushRequest req = PushRequest.parse("{\"op\":\"subscribe\",\"id\":\"r0\",\"dataset\":\"sessions\",\"since\":\"seq-5\"}");
        assertInstanceOf(PushRequest.Subscribe.class, req);
        PushRequest.Subscribe s = (PushRequest.Subscribe) req;
        assertEquals("sessions", s.dataset());
        assertEquals("seq-5", s.since());
    }

    @Test
    void parse_subscribe_without_since() {
        PushRequest req = PushRequest.parse("{\"op\":\"subscribe\",\"id\":\"r0\",\"dataset\":\"sessions\"}");
        assertInstanceOf(PushRequest.Subscribe.class, req);
        assertNull(((PushRequest.Subscribe) req).since());
    }

    @Test
    void parse_subscribe_without_dataset_throws() {
        assertThrows(NullPointerException.class,
                () -> PushRequest.parse("{\"op\":\"subscribe\",\"id\":\"r0\"}"));
    }

    @Test
    void parse_unsubscribe() {
        PushRequest req = PushRequest.parse("{\"op\":\"unsubscribe\",\"id\":\"r0\",\"dataset\":\"sessions\"}");
        assertInstanceOf(PushRequest.Unsubscribe.class, req);
        assertEquals("sessions", ((PushRequest.Unsubscribe) req).dataset());
    }

    @Test
    void parse_unsubscribe_without_dataset_throws() {
        assertThrows(NullPointerException.class,
                () -> PushRequest.parse("{\"op\":\"unsubscribe\",\"id\":\"r0\"}"));
    }

    @Test
    void parse_listen() {
        PushRequest req = PushRequest.parse("{\"op\":\"listen\",\"id\":\"r0\",\"topics\":[\"debate:abc\",\"file:/x\"]}");
        assertInstanceOf(PushRequest.Listen.class, req);
        assertEquals(List.of("debate:abc", "file:/x"), ((PushRequest.Listen) req).topics());
    }

    @Test
    void parse_unlisten() {
        PushRequest req = PushRequest.parse("{\"op\":\"unlisten\",\"id\":\"r0\",\"topics\":[\"debate:abc\"]}");
        assertInstanceOf(PushRequest.Unlisten.class, req);
        assertEquals(List.of("debate:abc"), ((PushRequest.Unlisten) req).topics());
    }

    @Test
    void parse_unknown_op_throws() {
        assertThrows(IllegalArgumentException.class,
                () -> PushRequest.parse("{\"op\":\"unknown\"}"));
    }

    @Test
    void parse_malformed_json_throws() {
        assertThrows(IllegalArgumentException.class,
                () -> PushRequest.parse("not json"));
    }

    @Test
    void parse_missing_op_throws() {
        assertThrows(IllegalArgumentException.class,
                () -> PushRequest.parse("{\"dataset\":\"x\"}"));
    }

    @Test
    void parse_listen_with_null_topic_throws() {
        assertThrows(IllegalArgumentException.class,
                () -> PushRequest.parse("{\"op\":\"listen\",\"id\":\"r0\",\"topics\":[null,\"valid\"]}"));
    }

    // Task 3: Wire protocol correlation layer tests

    @Test
    void parse_subscribe_with_id_extracts_id() {
        PushRequest req = PushRequest.parse("{\"op\":\"subscribe\",\"id\":\"r1\",\"dataset\":\"sessions\"}");
        assertInstanceOf(PushRequest.Subscribe.class, req);
        assertEquals("r1", req.id());
    }

    @Test
    void parse_unsubscribe_with_id_extracts_id() {
        PushRequest req = PushRequest.parse("{\"op\":\"unsubscribe\",\"id\":\"r2\",\"dataset\":\"sessions\"}");
        assertInstanceOf(PushRequest.Unsubscribe.class, req);
        assertEquals("r2", req.id());
    }

    @Test
    void parse_listen_with_id_extracts_id() {
        PushRequest req = PushRequest.parse("{\"op\":\"listen\",\"id\":\"r3\",\"topics\":[\"debate:abc\"]}");
        assertInstanceOf(PushRequest.Listen.class, req);
        assertEquals("r3", req.id());
    }

    @Test
    void parse_unlisten_with_id_extracts_id() {
        PushRequest req = PushRequest.parse("{\"op\":\"unlisten\",\"id\":\"r4\",\"topics\":[\"debate:abc\"]}");
        assertInstanceOf(PushRequest.Unlisten.class, req);
        assertEquals("r4", req.id());
    }

    @Test
    void parse_missing_id_throws() {
        assertThrows(IllegalArgumentException.class,
                () -> PushRequest.parse("{\"op\":\"subscribe\",\"dataset\":\"sessions\"}"));
    }

    @Test
    void parse_listen_with_since_map() {
        PushRequest req = PushRequest.parse("{\"op\":\"listen\",\"id\":\"r5\",\"topics\":[\"debate:abc\"],\"since\":{\"debate:abc\":42,\"debate:xyz\":100}}");
        assertInstanceOf(PushRequest.Listen.class, req);
        PushRequest.Listen listen = (PushRequest.Listen) req;
        assertEquals("r5", listen.id());
        assertEquals(java.util.Map.of("debate:abc", 42L, "debate:xyz", 100L), listen.since());
    }

    @Test
    void parse_listen_without_since_returns_empty_map() {
        PushRequest req = PushRequest.parse("{\"op\":\"listen\",\"id\":\"r6\",\"topics\":[\"debate:abc\"]}");
        assertInstanceOf(PushRequest.Listen.class, req);
        PushRequest.Listen listen = (PushRequest.Listen) req;
        assertEquals(java.util.Map.of(), listen.since());
    }

    @Test
    void parse_subscribe_with_string_since_still_works() {
        PushRequest req = PushRequest.parse("{\"op\":\"subscribe\",\"id\":\"r7\",\"dataset\":\"sessions\",\"since\":\"cursor-abc\"}");
        assertInstanceOf(PushRequest.Subscribe.class, req);
        PushRequest.Subscribe s = (PushRequest.Subscribe) req;
        assertEquals("r7", s.id());
        assertEquals("cursor-abc", s.since());
    }

    @Test
    void parse_command_result_ok() {
        PushRequest req = PushRequest.parse("{\"op\":\"command-result\",\"id\":\"cmd-1\",\"ok\":true}");
        assertInstanceOf(PushRequest.CommandResult.class, req);
        PushRequest.CommandResult result = (PushRequest.CommandResult) req;
        assertEquals("cmd-1", result.id());
        assertTrue(result.ok());
        assertNull(result.error());
    }

    @Test
    void parse_command_result_with_error() {
        PushRequest req = PushRequest.parse("{\"op\":\"command-result\",\"id\":\"cmd-2\",\"ok\":false,\"error\":\"Element not found\"}");
        assertInstanceOf(PushRequest.CommandResult.class, req);
        PushRequest.CommandResult result = (PushRequest.CommandResult) req;
        assertEquals("cmd-2", result.id());
        assertFalse(result.ok());
        assertEquals("Element not found", result.error());
    }

    @Test
    void command_result_op_returns_correct_value() {
        PushRequest req = PushRequest.parse("{\"op\":\"command-result\",\"id\":\"cmd-3\",\"ok\":true}");
        assertEquals("command-result", req.op());
    }

    @Test
    void parse_with_since_before_op_field_order_independence() {
        PushRequest req = PushRequest.parse("{\"since\":{\"debate:abc\":50},\"op\":\"listen\",\"id\":\"r8\",\"topics\":[\"debate:abc\"]}");
        assertInstanceOf(PushRequest.Listen.class, req);
        PushRequest.Listen listen = (PushRequest.Listen) req;
        assertEquals("r8", listen.id());
        assertEquals(java.util.Map.of("debate:abc", 50L), listen.since());
    }

    @Test
    void parse_command_result_with_result_payload() {
        PushRequest req = PushRequest.parse("{\"op\":\"command-result\",\"id\":\"cmd-4\",\"ok\":true,\"error\":null,\"result\":{\"caseId\":\"C-001\",\"status\":\"OPEN\"}}");
        assertInstanceOf(PushRequest.CommandResult.class, req);
        PushRequest.CommandResult cr = (PushRequest.CommandResult) req;
        assertTrue(cr.ok());
        assertNotNull(cr.result());
        assertEquals("C-001", cr.result().get("caseId"));
        assertEquals("OPEN", cr.result().get("status"));
    }

    @Test
    void parse_command_result_without_result_has_null() {
        PushRequest               req = PushRequest.parse("{\"op\":\"command-result\",\"id\":\"cmd-5\",\"ok\":false,\"error\":\"not found\"}");
        PushRequest.CommandResult cr  = (PushRequest.CommandResult) req;
        assertNull(cr.result());
    }

    @Test
    void parse_executor_register() {
        PushRequest req = PushRequest.parse("{\"op\":\"executor-register\",\"id\":\"r1\",\"name\":\"helpdesk\",\"actions\":[\"create-ticket\",\"resolve-ticket\"]}");
        assertInstanceOf(PushRequest.ExecutorRegister.class, req);
        PushRequest.ExecutorRegister reg = (PushRequest.ExecutorRegister) req;
        assertEquals("r1", reg.id());
        assertEquals("helpdesk", reg.name());
        assertEquals(List.of("create-ticket", "resolve-ticket"), reg.actions());
        assertEquals("executor-register", reg.op());
    }

    @Test
    void parse_executor_register_without_actions() {
        PushRequest req = PushRequest.parse("{\"op\":\"executor-register\",\"id\":\"r2\",\"name\":\"browser\"}");
        assertInstanceOf(PushRequest.ExecutorRegister.class, req);
        assertEquals(List.of(), ((PushRequest.ExecutorRegister) req).actions());
    }

    @Test
    void parse_executor_register_without_name_throws() {
        assertThrows(NullPointerException.class,
                     () -> PushRequest.parse("{\"op\":\"executor-register\",\"id\":\"r3\"}"));
    }

    @Test
    void parse_step_result_ok() {
        PushRequest req = PushRequest.parse("{\"op\":\"step-result\",\"id\":\"sr1\",\"sessionId\":\"s-001\",\"stepName\":\"create-ticket\",\"ok\":true,\"result\":{\"ticketId\":\"T-001\"}}");
        assertInstanceOf(PushRequest.StepResult.class, req);
        PushRequest.StepResult sr = (PushRequest.StepResult) req;
        assertEquals("sr1", sr.id());
        assertEquals("s-001", sr.sessionId());
        assertEquals("create-ticket", sr.stepName());
        assertTrue(sr.ok());
        assertNull(sr.error());
        assertEquals("T-001", sr.result().get("ticketId"));
        assertEquals("step-result", sr.op());
    }

    @Test
    void parse_step_result_failure() {
        PushRequest            req = PushRequest.parse("{\"op\":\"step-result\",\"id\":\"sr2\",\"sessionId\":\"s-001\",\"stepName\":\"verify\",\"ok\":false,\"error\":\"await timed out\"}");
        PushRequest.StepResult sr  = (PushRequest.StepResult) req;
        assertFalse(sr.ok());
        assertEquals("await timed out", sr.error());
        assertNull(sr.result());
    }

    @Test
    void parse_step_result_without_session_throws() {
        assertThrows(NullPointerException.class,
                     () -> PushRequest.parse("{\"op\":\"step-result\",\"id\":\"sr3\",\"stepName\":\"x\",\"ok\":true}"));
    }

    @Test
    void parse_step_result_without_step_name_throws() {
        assertThrows(NullPointerException.class,
                     () -> PushRequest.parse("{\"op\":\"step-result\",\"id\":\"sr4\",\"sessionId\":\"s-001\",\"ok\":true}"));
    }


}
