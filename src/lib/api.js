import axios from "axios";

const API_BASE = process.env.REACT_APP_INTELLECT_API_URL || "http://localhost:8080";

// Extract a human-readable message from IntellectAI's CustomErrorResponse shape,
// gracefully falling back for other body types.
export function parseApiError(err, fallback = "Something went wrong") {
        if (!err) return fallback;
        const res = err.response;
        if (!res) return err.message || fallback;
        const data = res.data;
        if (!data) return `${res.status} ${res.statusText || ""}`.trim() || fallback;
        if (typeof data === "string") return data || fallback;
        // ApiResponse shape (OTP endpoints)
        if (data.message && typeof data.message === "string") return data.message;
        // CustomErrorResponse shape
        if (data.errors && typeof data.errors === "object") {
                const values = Object.values(data.errors);
                if (values.length) return values.join(". ");
        }
        if (data.error) return data.error;
        if (data.title) return data.title;
        return fallback;
}

const client = axios.create({
        baseURL: API_BASE,
        timeout: 20000,
});

client.interceptors.request.use((config) => {
        const token = localStorage.getItem("intellect_token");
        if (token) {
                config.headers = config.headers || {};
                config.headers["Authorization"] = `Bearer ${token}`;
        }
        return config;
});

export const authApi = {
        signUp: (payload) =>
                client.post("/sign-up", payload, {
                        headers: { "Content-Type": "application/json" },
                        transformResponse: [(d) => d], // keep raw JWT string
                }),
        login: (payload) =>
                client.post("/login", payload, {
                        headers: { "Content-Type": "application/json" },
                        transformResponse: [(d) => d], // keep raw JWT string
                }),
        generateOtp: () => client.get("/generate-otp"),
        validateOtp: (otp) => client.post(`/validate-otp/${encodeURIComponent(otp)}`),
};

export const userApi = {
        profile: () => client.get("/user/profile"),
        byUsername: (username) => client.get(`/user/${encodeURIComponent(username)}`),
};

export const quizApi = {
        list: () => client.get("/quiz"),
        create: (payload) => client.post("/quiz", payload),
        getById: (id) => client.get(`/quiz/${id}`),
        update: (id, payload) => client.post(`/quiz/update/${id}`, payload),
        remove: (id) => client.delete(`/quiz/${id}`),
};

export const questionApi = {
        create: (payload) => client.post("/question", payload),
        byQuiz: (quizId) => client.get(`/question/quiz/${quizId}`),
        remove: (id) => client.delete(`/question/${id}`),
};

/**
 * Document upload for AI RAG questions.
 * Backend: `POST /documents/upload` (multipart) with form fields `session_id` + `file`.
 * Returns `{ session_id, document_id, filename, chunks_indexed }`.
 * There is no list/delete endpoint yet — the frontend tracks uploads in memory.
 */
export const documentApi = {
        upload: (sessionId, file) => {
                const form = new FormData();
                form.append("session_id", sessionId);
                form.append("file", file);
                return client.post("/documents/upload", form, {
                        headers: { "Content-Type": "multipart/form-data" },
                });
        },
};

export { API_BASE };
export default client;
