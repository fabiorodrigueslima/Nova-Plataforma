import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { formatarData } from "../utils/FormatarData";
import { resolverUrlMidia } from "../utils/mediaUrl";
import "../styles/style.css";

export default function Notificacoes() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");
      const { data } = await api.get("/notifications");
      setItems(data.items || []);
      setUnread(data.unread || 0);
    } catch (requestError) {
      setError(requestError.response?.data?.erro || "Não foi possível carregar as notificações.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function read(notification) {
    if (!notification.lidaEm) {
      await api.patch(`/notifications/${notification.id}/read`);
      setItems((current) => current.map((item) => item.id === notification.id ? { ...item, lidaEm: new Date().toISOString() } : item));
      setUnread((value) => Math.max(0, value - 1));
    }
    if (notification.postId) navigate(`/feed?post=${notification.postId}`);
  }

  async function readAll() {
    await api.patch("/notifications/read-all");
    const now = new Date().toISOString();
    setItems((current) => current.map((item) => ({ ...item, lidaEm: item.lidaEm || now })));
    setUnread(0);
  }

  return (
    <main className="notifications-page">
      <section className="notifications-card">
        <header className="notifications-header">
          <div><button className="explorar-voltar" onClick={() => navigate("/feed")}>← Voltar</button><h1>Notificações</h1><p>{unread ? `${unread} não lida${unread === 1 ? "" : "s"}` : "Você está em dia."}</p></div>
          {unread > 0 && <button className="notifications-read-all" onClick={readAll}>Marcar todas como lidas</button>}
        </header>
        {loading && <p className="explorar-vazio">Carregando notificações...</p>}
        {error && <div className="notifications-error" role="alert">{error}<button onClick={load}>Tentar novamente</button></div>}
        {!loading && !error && items.length === 0 && <p className="explorar-vazio">Suas interações aparecerão aqui.</p>}
        <div className="notifications-list">
          {items.map((item) => <button key={item.id} className={`notification-item ${item.lidaEm ? "" : "unread"}`} onClick={() => read(item)}>
            <span className="notification-avatar">{item.ator?.foto ? <img src={resolverUrlMidia(item.ator.foto)} alt="" /> : item.ator?.nome?.charAt(0) || "P"}</span>
            <span><strong>{item.ator?.nome || "Usuário removido"}</strong> {item.mensagem}<small>{formatarData(item.criadoEm)}</small></span>
          </button>)}
        </div>
      </section>
    </main>
  );
}
