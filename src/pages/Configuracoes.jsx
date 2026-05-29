import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { useNotification } from "../context/notificationStore";
import "../styles/style.css";

export default function Configuracoes() {
  const navigate = useNavigate();
  const dialog = useNotification();

  function sair() {
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
    navigate("/login");
  }

  async function excluirConta() {
    const motivo = await dialog.prompt({
      type: "danger",
      title: "Excluir conta",
      message:
        "Essa ação remove sua conta, publicações, comentários e vínculos na plataforma. Para continuar, você pode informar o motivo da exclusão.",
      placeholder: "Conte rapidamente o motivo da exclusão da conta...",
      confirmText: "Continuar",
      cancelText: "Cancelar",
    });

    if (motivo === null) return;

    const confirmado = await dialog.confirm({
      type: "danger",
      title: "Confirmar exclusão definitiva",
      message:
        "A exclusão da conta é permanente e não poderá ser desfeita. Deseja realmente excluir sua conta?",
      confirmText: "Excluir conta",
      cancelText: "Cancelar",
    });

    if (!confirmado) return;

    try {
      await api.delete("/conta", { data: { motivo } });

      localStorage.removeItem("token");
      localStorage.removeItem("usuario");

      await dialog.notify({
        type: "success",
        title: "Conta excluída",
        message: "Sua conta foi excluída com sucesso.",
      });

      navigate("/login");
    } catch (error) {
      dialog.notify({
        type: "danger",
        title: "Conta não excluída",
        message: error.response?.data?.erro || "Erro ao excluir conta.",
      });
    }
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

          <button type="button" className="danger" onClick={excluirConta}>
            Excluir conta
          </button>
        </div>
      </section>
    </main>
  );
}
