import { useNavigate } from "react-router-dom";
import bgImg from "@/assets/bg-gradient.jpg";

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundImage: `url(${bgImg})`, backgroundSize: "cover", backgroundPosition: "center" }}>
      <div className="text-center">
        <h1 className="text-6xl font-black text-white mb-4">404</h1>
        <p className="text-blue-300 text-lg mb-6">Ukurasa haukupatikana</p>
        <button onClick={() => navigate("/")} className="btn-primary px-8 py-3 font-bold">
          Rudi Nyumbani
        </button>
      </div>
    </div>
  );
}
