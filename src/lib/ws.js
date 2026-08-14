import { Client } from "@stomp/stompjs";

const WS_BASE = process.env.REACT_APP_INTELLECT_WS_URL || "ws://localhost:8080/ws";

/**
 * Build a native-WebSocket STOMP client for IntellectAI.
 * Token goes as ?token=<jwt> query param, checked once at handshake.
 * Server @SendToUser destinations resolve to `/user/queue/questions` on subscribe.
 */
export function createStompClient({ token, onMessage, onError, onConnect, onClose }) {
        const brokerURL = `${WS_BASE}?token=${encodeURIComponent(token)}`;
        const client = new Client({
                brokerURL,
                reconnectDelay: 0, // don't auto-reconnect; the token gate matters
                heartbeatIncoming: 10000,
                heartbeatOutgoing: 10000,
                debug: () => {},
        });

        client.onConnect = (frame) => {
                client.subscribe("/user/queue/questions", (msg) => {
                        try {
                                const body = msg.body ? JSON.parse(msg.body) : null;
                                onMessage?.(body);
                        } catch (e) {
                                onMessage?.(msg.body);
                        }
                });
                onConnect?.(frame);
        };

        client.onStompError = (frame) => {
                onError?.(frame.headers?.message || "STOMP error", frame);
        };

        client.onWebSocketError = (evt) => {
                onError?.("WebSocket connection failed", evt);
        };

        client.onWebSocketClose = (evt) => {
                onClose?.(evt);
        };

        return client;
}

export function send(client, destination, body) {
        if (!client || !client.connected) return false;
        client.publish({
                destination,
                body: JSON.stringify(body),
                headers: { "content-type": "application/json" },
        });
        return true;
}

/**
 * Classify a payload received on /user/queue/questions:
 *   - "regular-result" → QuizResult (has resultID)
 *   - "ai-feedback"    → AI mode feedback (has nextQuestion OR topicCompleted OR new AI-service fields)
 *   - "question"       → next QuestionDto (has title + options)
 *   - "unknown"
 */
export function classifyPayload(payload) {
        if (!payload || typeof payload !== "object") return "unknown";
        if (payload.resultID) return "regular-result";
        // AI feedback: detect on any of the new-shape keys since `nextQuestion` may be null on completion.
        if (
                "nextQuestion" in payload ||
                "topicCompleted" in payload ||
                "newDifficulty" in payload ||
                "conceptAccuracy" in payload
        )
                return "ai-feedback";
        if (payload.title && Array.isArray(payload.options)) return "question";
        return "unknown";
}
