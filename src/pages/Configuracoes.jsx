import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { resolverUrlMidia } from "../utils/mediaUrl";
import api from "../services/api";
import { useNotification } from "../context/notificationStore";
import { useAuth } from "../context/AuthContext";
import "../styles/style.css";

export default function Configuracoes() {
  const navigate = useNavigate();
  const dialog = useNotification();
  const { sair: encerrarSessao } = useAuth();
  const [bloqueados, setBloqueados] = useState([]);
  const [carregandoBloqueados, setCarregandoBloqueados] = useState(true);

  useEffect(() => {
    api.get("/bloqueios")
      .then(({ data }) => setBloqueados(Array.isArray(data) ? data : []))
      .catch(() => setBloqueados([]))
      .finally(() => setCarregandoBloqueados(false));
  }, []);

  async function desbloquear(usuario) {
    try {
      await api.post(`/usuarios/${usuario.id}/bloquear`);
      setBloqueados((lista) => lista.filter((item) => item.id !== usuario.id));
      dialog.notify({ type: "success", title: "Usuário desbloqueado", message: `${usuario.nome} foi desbloqueado.` });
    } catch (error) {
      dialog.notify({ type: "danger", title: "Não foi possível desbloquear", message: error.response?.data?.erro || "Tente novamente." });
    }
  }

  async function sair() {
    await encerrarSessao();
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

        <section className="config-bloqueados" aria-labelledby="titulo-bloqueados">
          <h2 id="titulo-bloqueados">Usuários bloqueados</h2>
          <p>Quem você bloqueia não vê suas publicações, não comenta e não manda mensagens para você.</p>
          {carregandoBloqueados ? (
            <p className="config-bloqueados-vazio">Carregando...</p>
          ) : bloqueados.length === 0 ? (
            <p className="config-bloqueados-vazio">Você não bloqueou ninguém.</p>
          ) : (
            <ul>
              {bloqueados.map((usuario) => (
                <li key={usuario.id}>
                  <span className="mod-avatar">
                    {usuario.foto ? <img src={resolverUrlMidia(usuario.foto)} alt="" /> : usuario.nome?.charAt(0)}
                  </span>
                  <strong>{usuario.nome}</strong>
                  <button type="button" onClick={() => desbloquear(usuario)}>Desbloquear</button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </section>
    </main>
  );
}
