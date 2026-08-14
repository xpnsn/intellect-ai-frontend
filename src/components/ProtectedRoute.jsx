import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export default function ProtectedRoute({ children, requireVerified = true }) {
        const { token, isVerified, bootstrapping } = useAuth();
        const location = useLocation();

        if (bootstrapping) {
                return (
                        <div className="flex h-screen items-center justify-center">
                                <div className="overline text-neutral-500">Loading…</div>
                        </div>
                );
        }

        if (!token) {
                return <Navigate to="/login" state={{ from: location.pathname }} replace />;
        }

        if (requireVerified && !isVerified) {
                return <Navigate to="/verify" replace />;
        }

        return children;
}
