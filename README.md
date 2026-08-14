# IntellectAI — Frontend

A React client for **IntellectAI**, built to give the backend below
something to actually click through and demo — not the focus of this
project. It was put together with AI assistance rather than hand-crafted,
since the goal here was to exercise and showcase the backend systems, not
to build a polished frontend. If you're looking at this repo, the
interesting parts are:

- **[intellect-ai](https://github.com/xpnsn/intellect-ai)** — Spring Boot
  backend: auth, quiz CRUD, WebSocket-based real-time quiz delivery
- **IntellectAI AI Service** — FastAPI microservice sitting behind the
  Spring Boot backend: concept-roadmap generation, mastery-driven
  adaptive difficulty, RAG over uploaded documents (link it here once
  that repo's public)

This app is the client that talks to both.

## Features exercised

- **Auth** — sign up, login, OTP verification, JWT-based session,
  protected routes
- **Manual quiz builder** — create/edit/delete quizzes and questions
  against the Spring Boot CRUD API
- **AI adaptive tutor** — start a topic, get questions targeting one
  concept at a time, see live mastery/accuracy per concept, watch
  difficulty escalate (Easy → Medium → Hard) once a concept's roadmap is
  cleared, and a completion screen once the whole topic is mastered
- **RAG mode** — upload a PDF mid-session and switch the tutor to
  generating questions grounded in that document instead of the model's
  own knowledge
- **Real-time delivery** — the AI tutor flow runs over a STOMP/WebSocket
  connection rather than polling, so questions and evaluation feedback
  stream back live

## Running it

```bash
yarn install
cp .env.example .env   # point at your running backend + AI service
yarn start
```

| Variable | Purpose |
|---|---|
| `REACT_APP_INTELLECT_API_URL` | Spring Boot backend base URL |
| `REACT_APP_INTELLECT_WS_URL` | Spring Boot WebSocket endpoint |

Requires the Spring Boot backend (and, for AI/RAG features, the FastAPI
service behind it) running and reachable at those URLs.

## Stack

React (Create React App), Tailwind CSS, shadcn/ui + Radix primitives,
TanStack Query, Axios, @stomp/stompjs.
