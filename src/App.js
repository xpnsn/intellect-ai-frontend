import { useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/Layout";

import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import VerifyOtp from "@/pages/VerifyOtp";
import Dashboard from "@/pages/Dashboard";
import QuizBuilder from "@/pages/QuizBuilder";
import PlayQuiz from "@/pages/PlayQuiz";
import AiTutor from "@/pages/AiTutor";
import Profile from "@/pages/Profile";

function App() {
        useEffect(() => {
                document.title = "Intellect.AI";
        }, []);
        return (
                <AuthProvider>
                        <BrowserRouter>
                                <Routes>
                                        <Route path="/" element={<Landing />} />
                                        <Route path="/login" element={<Login />} />
                                        <Route path="/signup" element={<Signup />} />
                                        <Route
                                                path="/verify"
                                                element={
                                                        <ProtectedRoute requireVerified={false}>
                                                                <VerifyOtp />
                                                        </ProtectedRoute>
                                                }
                                        />
                                        <Route
                                                element={
                                                        <ProtectedRoute>
                                                                <Layout />
                                                        </ProtectedRoute>
                                                }
                                        >
                                                <Route path="/dashboard" element={<Dashboard />} />
                                                <Route path="/quiz/:id/edit" element={<QuizBuilder />} />
                                                <Route path="/quiz/new" element={<QuizBuilder />} />
                                                <Route path="/tutor" element={<AiTutor />} />
                                                <Route path="/profile" element={<Profile />} />
                                                <Route path="/profile/:username" element={<Profile />} />
                                        </Route>
                                        <Route
                                                path="/play/:id"
                                                element={
                                                        <ProtectedRoute>
                                                                <PlayQuiz />
                                                        </ProtectedRoute>
                                                }
                                        />
                                        <Route path="*" element={<Navigate to="/" replace />} />
                                </Routes>
                                <Toaster richColors position="top-right" />
                        </BrowserRouter>
                </AuthProvider>
        );
}

export default App;
