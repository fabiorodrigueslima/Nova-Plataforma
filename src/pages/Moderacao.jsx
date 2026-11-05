import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiActivity, FiArchive, FiFlag, FiShield, FiTrash2, FiUserX } from "react-icons/fi";
import api from "../services/api";
import { useNotification } from "../context/notificationStore";
import { formatarData } from "../utils/FormatarData";
import { resolverUrlMidia } from "../utils/mediaUrl";
import "../styles/style.css";

const FILTROS = [
  { valor: "pendente", rotulo: "Pendentes" },
  { valor: "resolvida", rotulo: "Resolvidas" },
  { valor: "rejeitada", rotulo: "Arquivadas" },
];

const ROTULO_ACAO = {
  remover_post: "Publicação removida",
  suspender_usuario: "Usuário suspenso",
  arquivar: "Arquivada sem ação",
};

function Avatar({ usuario }) {
  return (
    <span className="mod-avatar">
      {usuario?.foto ? <img src={resolverUrlMidia(usuario.foto)} alt="" /> : usuario?.nome?.charAt(0) || "?"}
    </span>
  );
}

function CartaoDenuncia({ denuncia, onResolvida }) {
  const dialog = useNotification();
  const navigate = useNavigate();
  const [dias, setDias] = useState("7");
  const [enviando, setEnviando] = useState(false);
  const pendente = denuncia.status === "pendente" || denuncia.status === "em_analise";
  const conteudo = denuncia.post?.conteudo ?? denuncia.conteudo_denunciado;
  const suspensoAtivo = denuncia.denunciado?.suspenso_ate && new Date(denuncia.denunciado.suspenso_ate) > new Date();

  async function resolver(acao) {
    const textos = {
      remover_post: ["Remover publicação", "A publicação será apagada e todas as denúncias sobre ela serão resolvidas."],
      suspender_usuario: ["Suspender usuário", `${denuncia.denunciado?.nome} ficará ${dias} dia(s) sem acesso e será desconectado agora.`],
      arquivar: ["Arquivar denúncia", "A denúncia será encerrada sem nenhuma ação sobre o conteúdo."],
    };
    const [title, message] = textos[acao];
    const ok = await dialog.confirm({ type: acao === "arquivar" ? "info" : "danger", title, message, confirmText: title, cancelText: "Cancelar" });
    if (!ok) return;
    try {
      setEnviando(true);
      const { data } = await api.post(`/admin/denuncias/${denuncia.id}/resolver`, { acao, dias: Number(dias) });
      dialog.notify({ type: "success", title: "Feito", message: data.mensagem });
      onResolvida();
    } catch (error) {
      dialog.notify({ type: "danger", title: "Não foi possível concluir", message: error.response?.data?.erro || "Tente novamente." });
    } finally {
      setEnviando(false);
    }
  }

  async function reativar() {
    const ok = await dialog.confirm({ type: "info", title: "Remover suspensão", message: `${denuncia.denunciado?.nome} poderá entrar novamente.`, confirmText: "Remover suspensão", cancelText: "Cancelar" });
    if (!ok) return;
    try {
      await api.post(`/admin/usuarios/${denuncia.denunciado.id}/reativar`);
      dialog.notify({ type: "success", title: "Feito", message: "Suspensão removida." });
      onResolvida();
    } catch (error) {
      dialog.notify({ type: "danger", title: "Não foi possível concluir", message: error.response?.data?.erro || "Tente novamente." });
    }
  }

  return (
    <article className={`mod-card ${pendente ? "" : "resolvida"}`}>
      <header className="mod-card-header">
        <button type="button" className="mod-user" onClick={() => denuncia.denunciado && navigate(`/perfil/${denuncia.denunciado.id}`)}>
          <Avatar usuario={denuncia.denunciado} />
          <span>
            <strong>{denuncia.denunciado?.nome || "Usuário removido"}</strong>
            <small>
              {denuncia.post || denuncia.post_removido ? "Publicação denunciada" : "Perfil denunciado"} · {formatarData(denuncia.criado_em)}
            </small>
          </span>
        </button>
        {suspensoAtivo && <span className="mod-badge danger">Suspenso até {new Date(denuncia.denunciado.suspenso_ate).toLocaleDateString("pt-BR")}</span>}
        {!pendente && denuncia.acao && <span className="mod-badge">{ROTULO_ACAO[denuncia.acao]}</span>}
      </header>

      <div className="mod-motivo">
        <FiFlag aria-hidden="true" />
        <p>
          <strong>Motivo:</strong> {denuncia.motivo}
          <small> — denunciado por {denuncia.denunciante?.nome || "usuário removido"}</small>
        </p>
      </div>

      {(conteudo || denuncia.post?.imagem) && (
        <blockquote className="mod-conteudo">
          {denuncia.post_removido && <span className="mod-removido">Publicação já removida · cópia guardada</span>}
          {conteudo && <p>{conteudo}</p>}
          {denuncia.post?.imagem && denuncia.post.tipo_arquivo?.startsWith("image/") && (
            <img src={resolverUrlMidia(denuncia.post.imagem)} alt="Mídia da publicação denunciada" />
          )}
        </blockquote>
      )}

      {pendente ? (
        <footer className="mod-acoes">
          {denuncia.post && (
            <button type="button" className="mod-btn danger" disabled={enviando} onClick={() => resolver("remover_post")}>
              <FiTrash2 aria-hidden="true" /> Remover publicação
            </button>
          )}
          {denuncia.denunciado && (
            <span className="mod-suspender">
              <select value={dias} onChange={(e) => setDias(e.target.value)} aria-label="Dias de suspensão">
                <option value="1">1 dia</option>
                <option value="3">3 dias</option>
                <option value="7">7 dias</option>
                <option value="30">30 dias</option>
              </select>
              <button type="button" className="mod-btn warning" disabled={enviando} onClick={() => resolver("suspender_usuario")}>
                <FiUserX aria-hidden="true" /> Suspender
              </button>
            </span>
          )}
          <button type="button" className="mod-btn" disabled={enviando} onClick={() => resolver("arquivar")}>
            <FiArchive aria-hidden="true" /> Arquivar
          </button>
        </footer>
      ) : (
        <footer className="mod-acoes resolvida">
          <small>
            Resolvida por {denuncia.resolvido_por?.nome || "equipe"} {denuncia.resolvido_em ? `· ${formatarData(denuncia.resolvido_em)}` : ""}
          </small>
          {suspensoAtivo && (
            <button type="button" className="mod-btn" onClick={reativar}>Remover suspensão</button>
          )}
        </footer>
      )}
    </article>
  );
}

function Metricas() {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    api.get("/admin/metricas")
      .then(({ data }) => setDados(data))
      .catch((error) => setErro(error.response?.data?.erro || "Não foi possível carregar as métricas."));
  }, []);

  if (erro) return <div className="notifications-error" role="alert">{erro}</div>;
  if (!dados) return <p className="notifications-loading">Calculando métricas...</p>;

  const maxTema = Math.max(1, ...dados.temas_30d.map((t) => t.posts));
  const retencao = dados.retencao_semana;
  const cards = [
    { rotulo: "Usuários", valor: dados.usuarios.total, detalhe: `+${dados.usuarios.novos_7d} nos últimos 7 dias` },
    { rotulo: "Ativos hoje", valor: dados.usuarios.ativos_24h, detalhe: "entraram nas últimas 24h" },
    { rotulo: "Ativos na semana", valor: dados.usuarios.ativos_7d, detalhe: "entraram nos últimos 7 dias" },
    {
      rotulo: "Voltaram",
      valor: retencao.percentual === null ? "—" : `${retencao.percentual}%`,
      detalhe: retencao.coorte ? `${retencao.voltaram} de ${retencao.coorte} cadastrados há 1–2 semanas` : "sem cadastros há 1–2 semanas",
    },
    { rotulo: "Publicações", valor: dados.atividade_7d.posts, detalhe: "nos últimos 7 dias" },
    { rotulo: "Comentários", valor: dados.atividade_7d.comentarios, detalhe: "nos últimos 7 dias" },
    { rotulo: "Curtidas", valor: dados.atividade_7d.curtidas, detalhe: "nos últimos 7 dias" },
    { rotulo: "Denúncias pendentes", valor: dados.denuncias_pendentes, detalhe: `${dados.usuarios.suspensos} usuário(s) suspenso(s)` },
  ];

  return (
    <div className="mod-metricas">
      <div className="mod-kpis">
        {cards.map((card) => (
          <div className="mod-kpi" key={card.rotulo}>
            <span>{card.rotulo}</span>
            <strong>{card.valor}</strong>
            <small>{card.detalhe}</small>
          </div>
        ))}
      </div>
      <section className="mod-temas">
        <h2>Temas mais publicados (30 dias)</h2>
        {dados.temas_30d.length === 0 && <p className="notifications-loading">Ainda sem publicações no período.</p>}
        {dados.temas_30d.map((t) => (
          <div className="mod-tema" key={t.tema}>
            <span>{t.tema}</span>
            <div className="mod-barra"><span style={{ width: `${(t.posts / maxTema) * 100}%` }} /></div>
            <strong>{t.posts}</strong>
          </div>
        ))}
      </section>
    </div>
  );
}

export default function Moderacao() {
  const navigate = useNavigate();
  const [aba, setAba] = useState("denuncias");
  const [filtro, setFiltro] = useState("pendente");
  const [denuncias, setDenuncias] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    try {
      setCarregando(true);
      setErro("");
      const { data } = await api.get("/admin/denuncias", { params: { status: filtro } });
      setDenuncias(Array.isArray(data) ? data : []);
    } catch (error) {
      setErro(error.response?.data?.erro || "Não foi possível carregar as denúncias.");
    } finally {
      setCarregando(false);
    }
  }, [filtro]);

  useEffect(() => {
    if (aba === "denuncias") carregar();
  }, [aba, carregar]);

  return (
    <main className="notifications-page">
      <section className="notifications-card mod-container">
        <button className="explorar-voltar" onClick={() => navigate("/feed")}>← Voltar</button>
        <header className="notifications-header">
          <div className="notifications-title">
            <span className="notifications-title-icon" aria-hidden="true"><FiShield /></span>
            <div>
              <h1>Moderação</h1>
              <p>Denúncias da comunidade e saúde da plataforma.</p>
            </div>
          </div>
        </header>

        <nav className="mod-tabs" aria-label="Seções do painel">
          <button type="button" className={aba === "denuncias" ? "active" : ""} onClick={() => setAba("denuncias")}>
            <FiFlag aria-hidden="true" /> Denúncias
          </button>
          <button type="button" className={aba === "metricas" ? "active" : ""} onClick={() => setAba("metricas")}>
            <FiActivity aria-hidden="true" /> Métricas
          </button>
        </nav>

        {aba === "metricas" ? (
          <Metricas />
        ) : (
          <>
            <div className="mod-filtros" role="tablist" aria-label="Filtrar denúncias">
              {FILTROS.map((f) => (
                <button key={f.valor} type="button" role="tab" aria-selected={filtro === f.valor} className={filtro === f.valor ? "active" : ""} onClick={() => setFiltro(f.valor)}>
                  {f.rotulo}
                </button>
              ))}
            </div>
            {carregando && <p className="notifications-loading">Carregando denúncias...</p>}
            {erro && <div className="notifications-error" role="alert">{erro}<button onClick={carregar}>Tentar novamente</button></div>}
            {!carregando && !erro && denuncias.length === 0 && (
              <div className="notifications-empty">
                <span className="notifications-empty-icon" aria-hidden="true"><FiShield /></span>
                <strong>{filtro === "pendente" ? "Nenhuma denúncia pendente" : "Nada por aqui ainda"}</strong>
                <p>{filtro === "pendente" ? "A comunidade está tranquila. Novas denúncias aparecem aqui." : "Denúncias tratadas aparecem nesta lista."}</p>
              </div>
            )}
            <div className="mod-lista">
              {!carregando && denuncias.map((d) => <CartaoDenuncia key={d.id} denuncia={d} onResolvida={carregar} />)}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
