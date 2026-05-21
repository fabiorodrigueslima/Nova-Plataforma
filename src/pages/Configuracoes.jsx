import { useNavigate } from "react-router-dom";
import "../styles/style.css";

export default function Configuracoes() {
  const navigate = useNavigate();

  function sair() {
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
    navigate("/login");
  }

  return (
    <main className="config-page">
      <section className="config-container">
        <button
          type="button"
          className="config-back"
          onClick={() => navigate("/feed")}
        >
          Voltar para o feed
        </button>

        <header className="config-header">
          <span>Conta</span>
          <h1>Configurações</h1>
          <p>Gerencie dados básicos da sua conta no PostFan.</p>
        </header>

        <div className="config-actions">
          <button type="button" onClick={() => navigate("/editar-perfil")}>
            Editar perfil
          </button>

          <button type="button" onClick={() => navigate("/privacidade")}>
            Privacidade
          </button>

          <button type="button" className="danger" onClick={sair}>
            Sair da conta
          </button>
        </div>
      </section>
    </main>
  );
}
